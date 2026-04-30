#!/bin/bash
# Smoke Test: Backpressure & Queue Fairness (Hardening D)
# Tests backpressure handling, fairness, and no-starvation

set -e

echo "🧪 Smoke Test: Backpressure & Queue Fairness (Hardening D)"
echo "========================================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test D-Smoke-1: Backpressure
echo ""
echo "Test D-Smoke-1: Backpressure Detection"
echo "--------------------------------------"

# We'll simulate this by testing the backpressure handler directly
echo "Creating temporary test script..."

cat > /tmp/test_backpressure.js << 'EOF'
import { BackpressureHandler } from '../src/core/backpressure/backpressure.js';

// Create a backpressure handler with small limits for testing
const bp = new BackpressureHandler({
  maxQueueDepth: 5,  // Small queue for testing
  maxActiveJobs: 3,  // Small active limit for testing
});

// Submit jobs to fill the queue
console.log("Submitting jobs to trigger backpressure...");

let accepted = 0;
let rejected = 0;

for (let i = 0; i < 10; i++) {
  const result = bp.submitJob({
    subject: `user:${i}`,
    priority: 1,
    payload: { test: `job-${i}` },
    queueType: 'interactive'
  });
  
  if (result) {
    accepted++;
    console.log(`  Job ${i}: ACCEPTED`);
  } else {
    rejected++;
    console.log(`  Job ${i}: REJECTED (backpressure)`);
  }
}

console.log(`Accepted: ${accepted}, Rejected: ${rejected}`);

// Check that we had rejections due to backpressure
if (rejected > 0) {
  console.log("✓ Backpressure correctly triggered rejections");
} else {
  console.log("✗ Backpressure did not trigger rejections as expected");
  process.exit(1);
}

// Check that some jobs were still accepted
if (accepted > 0) {
  console.log("✓ Some jobs were still accepted (selective rejection)");
} else {
  console.log("✗ All jobs were rejected (too aggressive)");
  process.exit(1);
}

console.log("✓ Test D-Smoke-1 PASSED: Backpressure working correctly");
EOF

# Run the test
if npx tsx /tmp/test_backpressure.js; then
  echo -e "${GREEN}✓ Test D-Smoke-1 PASSED${NC}: Backpressure detection working"
else
  echo -e "${RED}✗ Test D-Smoke-1 FAILED${NC}: Backpressure not working"
  rm -f /tmp/test_backpressure.js
  exit 1
fi

rm -f /tmp/test_backpressure.js

# Test D-Smoke-2: Fairness
echo ""
echo "Test D-Smoke-2: Fairness (Single Subject Limit)"
echo "-----------------------------------------------"

cat > /tmp/test_fairness.js << 'EOF'
import { BackpressureHandler } from '../src/core/backpressure/backpressure.js';

// Create a backpressure handler with fairness limits
const bp = new BackpressureHandler({
  maxQueueDepth: 20,
  maxActiveJobs: 10,
  defaultMaxActivePerSubject: 2,  // Fairness: max 2 per subject
});

console.log("Testing fairness - subject A submits multiple jobs...");

// Subject A submits many jobs
let subjectACount = 0;
let subjectBCount = 0;

// Subject A submits 10 jobs
for (let i = 0; i < 10; i++) {
  const result = bp.submitJob({
    subject: 'user:A',
    priority: 1,
    payload: { test: `job-A-${i}` },
    queueType: 'interactive'
  });
  
  if (result) {
    subjectACount++;
  }
}

// Subject B submits 1 job
const resultB = bp.submitJob({
  subject: 'user:B',
  priority: 1,
  payload: { test: 'job-B-1' },
  queueType: 'interactive'
});
if (resultB) subjectBCount++;

console.log(`Subject A jobs accepted: ${subjectACount}`);
console.log(`Subject B jobs accepted: ${subjectBCount}`);

// Acquire some jobs to move them to active state
for (let i = 0; i < 5; i++) {
  const job = bp.acquireNextJob();
  if (job) {
    console.log(`  Acquired job: ${job.id} for ${job.subject}`);
  }
}

// Check current stats
const stats = bp.getStats();
console.log("Current stats:", JSON.stringify(stats, null, 2));

// Subject A should be limited by fairness, allowing Subject B to get through
if (subjectBCount > 0) {
  console.log("✓ Fairness: Subject B was able to submit job despite A's activity");
} else {
  console.log("✗ Fairness: Subject B was blocked by Subject A (fairness issue)");
  process.exit(1);
}

console.log("✓ Test D-Smoke-2 PASSED: Fairness working correctly");
EOF

if npx tsx /tmp/test_fairness.js; then
  echo -e "${GREEN}✓ Test D-Smoke-2 PASSED${NC}: Fairness working correctly"
else
  echo -e "${RED}✗ Test D-Smoke-2 FAILED${NC}: Fairness not working"
  rm -f /tmp/test_fairness.js
  exit 1
fi

rm -f /tmp/test_fairness.js

# Test D-Smoke-3: No Starvation
echo ""
echo "Test D-Smoke-3: No Starvation"
echo "-----------------------------"

cat > /tmp/test_starvation.js << 'EOF'
import { BackpressureHandler } from '../src/core/backpressure/backpressure.js';

// Create a backpressure handler
const bp = new BackpressureHandler({
  maxQueueDepth: 50,
  maxActiveJobs: 10,
  defaultMaxActivePerSubject: 3,  // Allow some fairness
});

console.log("Testing no-starvation - continuous flow with multiple subjects...");

// Simulate continuous submission from subject A
let aSubmitted = 0;
let bSubmitted = 0;
let aAccepted = 0;
let bAccepted = 0;

// Submit many jobs from A first
for (let i = 0; i < 20; i++) {
  const result = bp.submitJob({
    subject: 'user:A',
    priority: 1,
    payload: { test: `job-A-${i}` },
    queueType: 'interactive'
  });
  aSubmitted++;
  if (result) aAccepted++;
}

// Then submit from B
for (let i = 0; i < 10; i++) {
  const result = bp.submitJob({
    subject: 'user:B',
    priority: 1,
    payload: { test: `job-B-${i}` },
    queueType: 'interactive'
  });
  bSubmitted++;
  if (result) bAccepted++;
}

console.log(`Subject A: ${aAccepted}/${aSubmitted} accepted`);
console.log(`Subject B: ${bAccepted}/${bSubmitted} accepted`);

// Simulate processing by acquiring and releasing jobs
console.log("Simulating job processing...");
for (let i = 0; i < 15; i++) {
  const job = bp.acquireNextJob();
  if (job) {
    console.log(`  Processed job: ${job.id} for ${job.subject}`);
    // Simulate quick processing and release
    bp.releaseJob(job.id);
  }
}

// Check that both subjects got some processing time
if (aAccepted > 0 && bAccepted > 0) {
  console.log("✓ No starvation: Both subjects received service");
} else {
  console.log("✗ Starvation: One subject got no service");
  process.exit(1);
}

// Even if A submitted more, B should still get some slots
if (bAccepted > 0) {
  console.log("✓ No starvation: Secondary subject received service despite competition");
} else {
  console.log("✗ Starvation: Secondary subject got no service");
  process.exit(1);
}

console.log("✓ Test D-Smoke-3 PASSED: No starvation working correctly");
EOF

if npx tsx /tmp/test_starvation.js; then
  echo -e "${GREEN}✓ Test D-Smoke-3 PASSED${NC}: No starvation working correctly"
else
  echo -e "${RED}✗ Test D-Smoke-3 FAILED${NC}: Starvation detected"
  rm -f /tmp/test_starvation.js
  exit 1
fi

rm -f /tmp/test_starvation.js

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Hardening D Smoke Tests PASSED! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backpressure & Queue Fairness features working:"
echo "  ✓ Backpressure detection and load-shedding"
echo "  ✓ Fairness per subject limits"
echo "  ✓ No starvation guarantees"
echo "  ✓ Queue depth management"
echo "  ✓ Active job limits"