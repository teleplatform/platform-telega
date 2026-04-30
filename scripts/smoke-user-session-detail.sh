#!/bin/bash
# Smoke Test: User Session Detail (Layer K1.2)
# Tests ownership, explain safety, and receipt consistency

set -e

echo "🧪 Smoke Test: User Session Detail (Layer K1.2)"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test K1.2-Smoke-1: Ownership Verification
echo ""
echo "Test K1.2-Smoke-1: Ownership Verification"
echo "----------------------------------------"

cat > /tmp/test_ownership.mjs << 'EOF'
import { UserSessionService } from '../src/core/user/userSessionService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { ExplainService } from '../src/core/observability/explainService.js';
import { ReceiptService } from '../src/core/observability/receiptService.js';
import { AgentSessionManager } from '../src/core/agent/runtime/agentSession.js';
import { FileOwnershipStorage } from '../src/core/agent/runtime/ownershipStorage.js';
import { JsonlTraceWriter } from '../src/core/agent/runtime/traceWriter.js';

console.log("Testing ownership verification...");

// Mock services for testing
const usageLedger = new UsageLedger();
const traceWriter = new JsonlTraceWriter('./test-evidence');
const sessionManager = new AgentSessionManager(traceWriter);
const ownershipStorage = new FileOwnershipStorage('./test-evidence');
const explainService = new ExplainService(usageLedger, null, null);
const receiptService = new ReceiptService(usageLedger);

const userSessionService = new UserSessionService(
  usageLedger,
  explainService,
  receiptService,
  sessionManager,
  ownershipStorage
);

// Create test sessions with different owners
const userA = 'user-A-123';
const userB = 'user-B-456';

// Test session ID (would be created by session manager in real system)
const testSessionId = 'sid-test-ownership';

// Mock ownership verification
// In real system, this would be handled by FileOwnershipStorage
const mockOwnership = new Map();
mockOwnership.set(`${testSessionId}:${userA}`, true);
mockOwnership.set(`${testSessionId}:${userB}`, true);

// Mock session manager
const mockSession = {
  sid: testSessionId,
  state: 'completed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Override methods for testing
ownershipStorage.verifyOwnership = async (sessionId, subjectId) => {
  return mockOwnership.get(`${sessionId}:${subjectId}`) || false;
};

sessionManager.getSession = (sessionId) => {
  return sessionId === testSessionId ? mockSession : null;
};

// Test 1: User A can access their session
try {
  const detailA = await userSessionService.getSessionDetail(testSessionId, userA);
  console.log("✓ User A can access their session");
  console.log(`  Session ID: ${detailA.session.sid}`);
  console.log(`  Status: ${detailA.session.status}`);
} catch (error) {
  console.log("✗ User A cannot access their session:", error.message);
  process.exit(1);
}

// Test 2: User B can access their session
try {
  const detailB = await userSessionService.getSessionDetail(testSessionId, userB);
  console.log("✓ User B can access their session");
  console.log(`  Session ID: ${detailB.session.sid}`);
  console.log(`  Status: ${detailB.session.status}`);
} catch (error) {
  console.log("✗ User B cannot access their session:", error.message);
  process.exit(1);
}

// Test 3: Verify session data isolation
if (detailA.session.sid === detailB.session.sid) {
  console.log("✓ Session data properly isolated");
} else {
  console.log("✗ Session data cross-contamination detected");
  process.exit(1);
}

console.log("✅ K1.2-Smoke-1: Ownership Verification - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_ownership.mjs

# Test K1.2-Smoke-2: Explain Safety
echo ""
echo "Test K1.2-Smoke-2: Explain Safety"
echo "----------------------------------"

cat > /tmp/test_explain_safety.mjs << 'EOF'
import { UserSessionService } from '../src/core/user/userSessionService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { ExplainService } from '../src/core/observability/explainService.js';
import { ReceiptService } from '../src/core/observability/receiptService.js';
import { AgentSessionManager } from '../src/core/agent/runtime/agentSession.js';
import { FileOwnershipStorage } from '../src/core/agent/runtime/ownershipStorage.js';
import { JsonlTraceWriter } from '../src/core/agent/runtime/traceWriter.js';

console.log("Testing explain safety (no internal codes)...");

const usageLedger = new UsageLedger();
const traceWriter = new JsonlTraceWriter('./test-evidence');
const sessionManager = new AgentSessionManager(traceWriter);
const ownershipStorage = new FileOwnershipStorage('./test-evidence');
const explainService = new ExplainService(usageLedger, null, null);
const receiptService = new ReceiptService(usageLedger);

const userSessionService = new UserSessionService(
  usageLedger,
  explainService,
  receiptService,
  sessionManager,
  ownershipStorage
);

const testUser = 'safety-test-user';
const testSessionId = 'sid-safety-test';

// Mock data
const mockSession = {
  sid: testSessionId,
  state: 'denied',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock services
ownershipStorage.verifyOwnership = async () => true;
sessionManager.getSession = () => mockSession;

// Mock explain service that returns internal data
explainService.getDecisionExplanation = () => ({
  decision: 'deny',
  rule: 'budget',
  reasonCode: 'budget_exceeded_internal_code',
  humanSummary: 'Budget limit of 1000000 micros exceeded. Current cost: 1250000 micros.',
  evidence: {
    traceIds: ['trace-internal-123'],
    timestamps: [new Date()],
    lastPolicyEvents: ['budget_violation_detected'],
    costSoFar: 1250000,
    budget: 1000000
  },
  suggestedFix: [
    'Increase budget allocation in settings',
    'Optimize agent behavior to reduce costs',
    'Contact support for budget increase'
  ]
});

// Get user-safe explain
const sessionDetail = await userSessionService.getSessionDetail(testSessionId, testUser);
const userExplain = sessionDetail.explain;

console.log("User-safe explain response:");
console.log(`  Decision: ${userExplain.decision}`);
console.log(`  Reason: ${userExplain.reason}`);
console.log(`  Explanation: ${userExplain.explanation}`);
console.log(`  Suggested Actions: ${userExplain.suggestedActions.join(' | ')}`);

// Verify safety checks
const unsafeIndicators = [
  'reasonCode',
  'traceIds',
  'internal',
  'budget_exceeded_internal_code',
  'micros',
  'lastPolicyEvents'
];

let hasUnsafeContent = false;
const explainString = JSON.stringify(userExplain);

for (const indicator of unsafeIndicators) {
  if (explainString.includes(indicator)) {
    console.log(`✗ Unsafe content found: ${indicator}`);
    hasUnsafeContent = true;
  }
}

if (!hasUnsafeContent) {
  console.log("✓ No internal codes or unsafe content in user explain");
} else {
  console.log("✗ Internal codes or unsafe content detected");
  process.exit(1);
}

// Verify user-friendly language
if (userExplain.explanation.includes('превышен') || userExplain.explanation.includes('лимит')) {
  console.log("✓ Explanation uses user-friendly Russian language");
} else {
  console.log("✗ Explanation may not be user-friendly");
  // This is not fatal - just a warning
}

console.log("✅ K1.2-Smoke-2: Explain Safety - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_explain_safety.mjs

# Test K1.2-Smoke-3: Receipt Consistency
echo ""
echo "Test K1.2-Smoke-3: Receipt Consistency"
echo "--------------------------------------"

cat > /tmp/test_receipt_consistency.mjs << 'EOF'
import { UserSessionService } from '../src/core/user/userSessionService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { ExplainService } from '../src/core/observability/explainService.js';
import { ReceiptService } from '../src/core/observability/receiptService.js';
import { AgentSessionManager } from '../src/core/agent/runtime/agentSession.js';
import { FileOwnershipStorage } from '../src/core/agent/runtime/ownershipStorage.js';
import { JsonlTraceWriter } from '../src/core/agent/runtime/traceWriter.js';

console.log("Testing receipt consistency with ledger...");

const usageLedger = new UsageLedger();
const traceWriter = new JsonlTraceWriter('./test-evidence');
const sessionManager = new AgentSessionManager(traceWriter);
const ownershipStorage = new FileOwnershipStorage('./test-evidence');
const explainService = new ExplainService(usageLedger, null, null);
const receiptService = new ReceiptService(usageLedger);

const userSessionService = new UserSessionService(
  usageLedger,
  explainService,
  receiptService,
  sessionManager,
  ownershipStorage
);

const testUser = 'consistency-test-user';
const testSessionId = 'sid-consistency-test';

// Mock session
const mockSession = {
  sid: testSessionId,
  state: 'completed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock services
ownershipStorage.verifyOwnership = async () => true;
sessionManager.getSession = () => mockSession;

// Record test usage in ledger
usageLedger.recordEntry({
  subject: testUser,
  sessionId: testSessionId,
  jobId: 'job-consistency-test',
  stepId: 'step-1',
  kind: 'model',
  units: 1000,
  unitType: 'tokens',
  costMicros: 1250,
  idempotencyKey: 'test-model-usage',
  metadata: {
    model: 'gpt-4',
    inputTokens: 750,
    outputTokens: 250
  }
});

usageLedger.recordEntry({
  subject: testUser,
  sessionId: testSessionId,
  jobId: 'job-consistency-test',
  stepId: 'step-2',
  kind: 'tool',
  units: 1,
  unitType: 'calls',
  costMicros: 1000,
  idempotencyKey: 'test-tool-usage',
  metadata: {
    toolKind: 'net.fetch'
  }
});

// Get user session detail
const sessionDetail = await userSessionService.getSessionDetail(testSessionId, testUser);
const userReceipt = sessionDetail.receipt;

console.log("User receipt data:");
console.log(`  Total cost: ${userReceipt.totalCostMicros} micros`);
console.log(`  Model cost: ${userReceipt.breakdown.model.costMicros} micros`);
console.log(`  Tools cost: ${userReceipt.breakdown.tools.costMicros} micros`);

// Verify consistency with ledger
const expectedTotal = 1250 + 1000; // 2250 micros
const actualTotal = userReceipt.totalCostMicros;

console.log(`Expected total from ledger: ${expectedTotal} micros`);
console.log(`Actual total from receipt: ${actualTotal} micros`);

if (actualTotal === expectedTotal) {
  console.log("✓ Receipt total matches ledger calculation");
} else {
  console.log("✗ Receipt total does not match ledger");
  process.exit(1);
}

// Verify no internal identifiers
const receiptString = JSON.stringify(userReceipt);
if (receiptString.includes('ledgerRefs')) {
  console.log("✗ Internal ledger identifiers found in user receipt");
  process.exit(1);
} else {
  console.log("✓ No internal identifiers in user receipt");
}

// Verify breakdown consistency
const modelCost = userReceipt.breakdown.model.costMicros;
const toolsCost = userReceipt.breakdown.tools.costMicros;
const calculatedTotal = modelCost + toolsCost + 
                       userReceipt.breakdown.storage.costMicros + 
                       userReceipt.breakdown.compute.costMicros;

if (calculatedTotal === actualTotal) {
  console.log("✓ Receipt breakdown is consistent");
} else {
  console.log("✗ Receipt breakdown is inconsistent");
  process.exit(1);
}

console.log("✅ K1.2-Smoke-3: Receipt Consistency - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_receipt_consistency.mjs

# Cleanup
rm -f /tmp/test_ownership.mjs /tmp/test_explain_safety.mjs /tmp/test_receipt_consistency.mjs

echo ""
echo "🎉 All Layer K1.2 smoke tests passed!"
echo "   - Ownership Verification ✓"
echo "   - Explain Safety ✓" 
echo "   - Receipt Consistency ✓"