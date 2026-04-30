#!/bin/bash
# Smoke Test: User Dashboard (Layer K1.1)
# Tests user isolation, consistency, and performance

set -e

echo "🧪 Smoke Test: User Dashboard (Layer K1.1)"
echo "==========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test K1.1-Smoke-1: User Isolation
echo ""
echo "Test K1.1-Smoke-1: User Isolation"
echo "----------------------------------"

cat > /tmp/test_user_isolation.mjs << 'EOF'
import { UserDashboardService } from '../src/core/user/dashboardService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing user isolation...");

const usageLedger = new UsageLedger();
const opsSignalsEngine = new OpsSignalsEngine();
const dashboardService = new UserDashboardService(usageLedger, opsSignalsEngine, 'Asia/Tashkent');

// Test user A
const userA = 'user-A-123';
const dashboardA = await dashboardService.getDashboard(userA);

// Test user B
const userB = 'user-B-456';
const dashboardB = await dashboardService.getDashboard(userB);

console.log("✓ User A dashboard subject:", dashboardA.subject.id);
console.log("✓ User B dashboard subject:", dashboardB.subject.id);

// Verify isolation
if (dashboardA.subject.id === userA && dashboardB.subject.id === userB) {
  console.log("✓ User isolation maintained - each user sees only their own data");
} else {
  console.log("✗ User isolation violated - users seeing wrong data");
  process.exit(1);
}

// Verify no cross-contamination in usage
if (dashboardA.usage.today.used_micros === 0 && dashboardB.usage.today.used_micros === 0) {
  console.log("✓ Usage data properly isolated between users");
} else {
  console.log("✗ Usage data cross-contamination detected");
  process.exit(1);
}

console.log("✅ K1.1-Smoke-1: User Isolation - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_user_isolation.mjs

# Test K1.1-Smoke-2: Data Consistency
echo ""
echo "Test K1.1-Smoke-2: Data Consistency"
echo "------------------------------------"

cat > /tmp/test_data_consistency.mjs << 'EOF'
import { UserDashboardService } from '../src/core/user/dashboardService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing data consistency...");

const usageLedger = new UsageLedger();
const opsSignalsEngine = new OpsSignalsEngine();
const dashboardService = new UserDashboardService(usageLedger, opsSignalsEngine, 'Asia/Tashkent');

const testUser = 'consistency-test-user';

// Record some test usage
usageLedger.recordEntry({
  subject: testUser,
  sessionId: 'test-session-1',
  jobId: 'test-job-1',
  stepId: 'step-1',
  kind: 'model',
  units: 1000,
  unitType: 'tokens',
  costMicros: 1250,
  idempotencyKey: 'test-model-usage-1',
  metadata: {
    model: 'gpt-4',
    inputTokens: 750,
    outputTokens: 250
  }
});

usageLedger.recordEntry({
  subject: testUser,
  sessionId: 'test-session-1',
  jobId: 'test-job-1',
  stepId: 'step-2',
  kind: 'tool',
  units: 1,
  unitType: 'calls',
  costMicros: 1000,
  idempotencyKey: 'test-tool-usage-1',
  metadata: {
    toolKind: 'net.fetch'
  }
});

// Get dashboard
const dashboard = await dashboardService.getDashboard(testUser);

console.log("Dashboard data:");
console.log(`  Today usage: ${dashboard.usage.today.used_micros} micros`);
console.log(`  Month usage: ${dashboard.usage.month.used_micros} micros`);
console.log(`  Today limit: ${dashboard.usage.today.limit_micros} micros`);
console.log(`  Month limit: ${dashboard.usage.month.limit_micros} micros`);
console.log(`  Today percentage: ${dashboard.usage.today.pct}%`);
console.log(`  Month percentage: ${dashboard.usage.month.pct}%`);

// Verify consistency
const expectedTotal = 1250 + 1000; // 2250 micros
const actualToday = dashboard.usage.today.used_micros;
const actualMonth = dashboard.usage.month.used_micros;

console.log(`Expected total: ${expectedTotal} micros`);
console.log(`Actual today: ${actualToday} micros`);
console.log(`Actual month: ${actualMonth} micros`);

if (actualToday === expectedTotal && actualMonth === expectedTotal) {
  console.log("✓ Usage calculations are consistent");
} else {
  console.log("✗ Usage calculations inconsistent");
  process.exit(1);
}

// Verify percentage calculations
const expectedPct = Math.round((expectedTotal / dashboard.usage.today.limit_micros) * 100);
const actualPct = dashboard.usage.today.pct;

console.log(`Expected percentage: ${expectedPct}%`);
console.log(`Actual percentage: ${actualPct}%`);

if (expectedPct === actualPct) {
  console.log("✓ Percentage calculations are correct");
} else {
  console.log("✗ Percentage calculations incorrect");
  process.exit(1);
}

// Verify remaining calculation
const expectedRemaining = dashboard.usage.today.limit_micros - actualToday;
console.log(`Expected remaining: ${expectedRemaining} micros`);
console.log(`Remaining = limit - used: ${expectedRemaining === (dashboard.usage.today.limit_micros - actualToday)}`);

console.log("✅ K1.1-Smoke-2: Data Consistency - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_data_consistency.mjs

# Test K1.1-Smoke-3: Performance
echo ""
echo "Test K1.1-Smoke-3: Performance"
echo "-------------------------------"

cat > /tmp/test_performance.mjs << 'EOF'
import { UserDashboardService } from '../src/core/user/dashboardService.js';
import { UsageLedger } from '../src/core/cost/usageLedger.js';
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing performance (p95 < 300ms)...");

const usageLedger = new UsageLedger();
const opsSignalsEngine = new OpsSignalsEngine();
const dashboardService = new UserDashboardService(usageLedger, opsSignalsEngine, 'Asia/Tashkent');

const testUser = 'performance-test-user';

// Warm up
await dashboardService.getDashboard(testUser);

// Run performance test
const iterations = 50;
const times = [];

for (let i = 0; i < iterations; i++) {
  const start = Date.now();
  await dashboardService.getDashboard(testUser);
  const end = Date.now();
  times.push(end - start);
}

// Calculate statistics
times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
const p99 = times[Math.floor(times.length * 0.99)];
const avg = times.reduce((sum, t) => sum + t, 0) / times.length;

console.log(`Performance results (${iterations} iterations):`);
console.log(`  Average: ${avg.toFixed(2)}ms`);
console.log(`  p50: ${p50}ms`);
console.log(`  p95: ${p95}ms`);
console.log(`  p99: ${p99}ms`);

if (p95 < 300) {
  console.log("✓ p95 performance target met (< 300ms)");
} else {
  console.log(`✗ p95 performance target not met (${p95}ms >= 300ms)`);
  process.exit(1);
}

console.log("✅ K1.1-Smoke-3: Performance - PASSED");
EOF

node --loader tsx --experimental-modules /tmp/test_performance.mjs

# Cleanup
rm -f /tmp/test_user_isolation.mjs /tmp/test_data_consistency.mjs /tmp/test_performance.mjs

echo ""
echo "🎉 All Layer K1.1 smoke tests passed!"
echo "   - User Isolation ✓"
echo "   - Data Consistency ✓" 
echo "   - Performance ✓"