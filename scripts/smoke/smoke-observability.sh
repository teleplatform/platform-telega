#!/bin/bash
# Smoke Test: Observability + Explain/Trace UX (Layer G)
# Tests explain decisions and receipt generation

set -e

echo "🧪 Smoke Test: Observability + Explain/Trace UX (Layer G)"
echo "========================================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test G-Smoke-1: Explain Decision
echo ""
echo "Test G-Smoke-1: Explain Decision"
echo "-------------------------------"

cat > /tmp/test_explain.js << 'EOF'
import { ObservabilityService } from '../src/core/observability/observabilityService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { BackpressureHandler } from '../src/core/backpressure/backpressure.js';
import { LeaseManager } from '../src/core/recovery/leaseManager.js';

console.log("Testing explain decision functionality...");

// Create services with minimal configuration
const usageLedger = new UsageLedger();
const backpressureHandler = new BackpressureHandler({ maxQueueDepth: 100, maxActiveJobs: 10 });
const leaseManager = new LeaseManager(30000, 10000); // Disable interval for testing

// Create observability service
const observabilityService = ObservabilityService.create(usageLedger, backpressureHandler, leaseManager);

const sessionId = 'test-session-explain';
const jobId = 'test-job-explain';

// Add some trace events to explain
const eventId = observabilityService.explainService.addTraceEvent({
  eventType: 'budget_exceeded',
  sessionId,
  jobId,
  metadata: {
    costSoFar: 2000000, // 2 Teletons
    budget: 1000000,    // 1 Teleton
    reason: 'budget_limit_exceeded'
  }
});

// Get explanation
const explanation = observabilityService.getDecisionExplanation(sessionId, jobId);
console.log(`✓ Decision: ${explanation.decision}`);
console.log(`✓ Rule: ${explanation.rule}`);
console.log(`✓ Reason code: ${explanation.reasonCode}`);
console.log(`✓ Human summary: ${explanation.humanSummary}`);
console.log(`✓ Evidence trace IDs: ${explanation.evidence.traceIds?.length || 0}`);
console.log(`✓ Suggested fixes: ${explanation.suggestedFix.length}`);

// Verify expectations for budget exceeded case
if (explanation.decision === 'deny' && explanation.rule === 'budget') {
  console.log("✓ Correctly identified budget denial");
} else {
  console.log(`✗ Expected budget denial, got ${explanation.rule}`);
  process.exit(1);
}

if (explanation.humanSummary.includes('budget') || explanation.humanSummary.includes('cost')) {
  console.log("✓ Human summary mentions budget/cost");
} else {
  console.log("✗ Human summary doesn't mention budget/cost");
  process.exit(1);
}

if (explanation.suggestedFix.length > 0) {
  console.log("✓ Provided suggested fixes");
} else {
  console.log("✗ No suggested fixes provided");
  process.exit(1);
}

// Test normal case (no denial)
const sessionIdNormal = 'normal-session';
const normalExplanation = observabilityService.getDecisionExplanation(sessionIdNormal);
console.log(`✓ Normal decision: ${normalExplanation.decision}`);
console.log(`✓ Normal rule: ${normalExplanation.rule}`);

if (normalExplanation.decision === 'allow' && normalExplanation.rule === 'system_normal') {
  console.log("✓ Correctly identified normal case");
} else {
  console.log(`✗ Expected normal case, got ${normalExplanation.decision}/${normalExplanation.rule}`);
  process.exit(1);
}

console.log("✓ Test G-Smoke-1 PASSED: Explain decision working correctly");
EOF

if npx tsx /tmp/test_explain.js; then
  echo -e "${GREEN}✓ Test G-Smoke-1 PASSED${NC}: Explain decision working correctly"
else
  echo -e "${RED}✗ Test G-Smoke-1 FAILED${NC}: Explain decision issues"
  rm -f /tmp/test_explain.js
  exit 1
fi

rm -f /tmp/test_explain.js

# Test G-Smoke-2: Receipt Generation
echo ""
echo "Test G-Smoke-2: Receipt Generation"
echo "-----------------------------------"

cat > /tmp/test_receipt.js << 'EOF'
import { ObservabilityService } from '../src/core/observability/observabilityService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { BackpressureHandler } from '../src/core/backpressure/backpressure.js';
import { LeaseManager } from '../src/core/recovery/leaseManager.js';

console.log("Testing receipt generation functionality...");

// Create services
const usageLedger = new UsageLedger();
const backpressureHandler = new BackpressureHandler({ maxQueueDepth: 100, maxActiveJobs: 10 });
const leaseManager = new LeaseManager(30000, 10000); // Disable interval for testing

// Create observability service
const observabilityService = ObservabilityService.create(usageLedger, backpressureHandler, leaseManager);

const sessionId = 'test-session-receipt';

// Record some usage to create a meaningful receipt
usageLedger.recordEntry({
  subject: 'user-123',
  sessionId,
  jobId: 'job-1',
  stepId: 'step-1',
  kind: 'model',
  units: 1500, // 1500 tokens
  unitType: 'tokens',
  costMicros: 1250, // Calculated cost
  idempotencyKey: 'model-usage-1',
  metadata: {
    model: 'gpt-4',
    inputTokens: 1000,
    outputTokens: 500
  }
});

usageLedger.recordEntry({
  subject: 'user-123',
  sessionId,
  jobId: 'job-1',
  stepId: 'step-2',
  kind: 'tool',
  units: 1, // 1 tool call
  unitType: 'calls',
  costMicros: 1000, // Tool call cost
  idempotencyKey: 'tool-call-1',
  metadata: {
    toolKind: 'net.fetch',
    url: 'https://api.example.com'
  }
});

usageLedger.recordEntry({
  subject: 'user-123',
  sessionId,
  jobId: 'job-1',
  stepId: 'step-3',
  kind: 'storage',
  units: 1048576, // 1 MB
  unitType: 'bytes',
  costMicros: 500, // Storage cost
  idempotencyKey: 'storage-usage-1',
  metadata: {
    bytes: 1048576,
    tier: 'hot',
    ttlSeconds: 86400 // 1 day
  }
});

// Generate receipt
const receipt = observabilityService.generateReceipt(sessionId);
console.log(`✓ Receipt generated for session: ${receipt.sessionId}`);
console.log(`✓ Total cost: ${receipt.totalCostMicros} micros`);
console.log(`✓ Breakdown:`);
console.log(`  - Model: ${receipt.breakdown.model.costMicros} micros (${receipt.breakdown.model.tokensIn} in, ${receipt.breakdown.model.tokensOut} out)`);
console.log(`  - Tools: ${receipt.breakdown.tools.costMicros} micros (${receipt.breakdown.tools.count} calls)`);
console.log(`  - Storage: ${receipt.breakdown.storage.costMicros} micros (${receipt.breakdown.storage.bytes} bytes)`);

// Verify receipt structure
if (receipt.totalCostMicros > 0) {
  console.log("✓ Receipt has positive total cost");
} else {
  console.log("✗ Receipt has zero or negative total cost");
  process.exit(1);
}

if (receipt.ledgerRefs.length > 0) {
  console.log(`✓ Receipt has ${receipt.ledgerRefs.length} ledger references`);
} else {
  console.log("✗ Receipt has no ledger references");
  process.exit(1);
}

if (receipt.integrity.sumMatchesTotal) {
  console.log("✓ Receipt integrity check passed");
} else {
  console.log("✗ Receipt integrity check failed");
  process.exit(1);
}

// Verify cost breakdown matches total
const breakdownTotal = 
  receipt.breakdown.model.costMicros +
  receipt.breakdown.tools.costMicros +
  receipt.breakdown.storage.costMicros +
  receipt.breakdown.compute.costMicros;

if (breakdownTotal === receipt.totalCostMicros) {
  console.log("✓ Breakdown sums to total cost");
} else {
  console.log(`✗ Breakdown (${breakdownTotal}) doesn't match total (${receipt.totalCostMicros})`);
  process.exit(1);
}

// Verify tool details
if (receipt.breakdown.tools.details.length > 0) {
  console.log(`✓ Tool details provided: ${receipt.breakdown.tools.details.length} kinds`);
} else {
  console.log("✗ No tool details provided");
  process.exit(1);
}

console.log("✓ Test G-Smoke-2 PASSED: Receipt generation working correctly");
EOF

if npx tsx /tmp/test_receipt.js; then
  echo -e "${GREEN}✓ Test G-Smoke-2 PASSED${NC}: Receipt generation working correctly"
else
  echo -e "${RED}✗ Test G-Smoke-2 FAILED${NC}: Receipt generation issues"
  rm -f /tmp/test_receipt.js
  exit 1
fi

rm -f /tmp/test_receipt.js

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Layer G Smoke Tests PASSED! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Observability features working:"
echo "  ✓ Explain decisions with human-readable summaries"
echo "  ✓ Receipt generation with detailed cost breakdowns"
echo "  ✓ Integrity verification of cost accounting"
echo "  ✓ Suggested fixes for common issues"
echo "  ✓ Trace event correlation for diagnostics"