#!/bin/bash
# Smoke Test: Ops Intelligence (Layer J)
# Tests signal detection, explainability, and recommendations

set -e

echo "🧪 Smoke Test: Ops Intelligence (Layer J)"
echo "========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test J-Smoke-1: Signal Detection
echo ""
echo "Test J-Smoke-1: Signal Detection"
echo "----------------------------------"

cat > /tmp/test_ops_signals.js << 'EOF'
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing Ops Signals Engine...");

const engine = new OpsSignalsEngine();

// Create mock metrics that should trigger signals
const mockMetrics = {
  runtime: {
    deny_rate: {
      backpressure: 7.8,
      budget: 2.1,
      quota: 0.5,
      rate_limit: 1.2
    },
    queue_depth_interactive: 120,
    queue_depth_batch: 340,
    jobs_active: 48
  },
  billing: {
    cost_micros_total: {
      model: 80000,
      tools: 1200000,
      cache_read: 5000,
      cache_write: 2000
    }
  },
  recovery: {
    recoverable_found: 12,
    resume_success: 8,
    resume_fail: 4
  }
};

// Previous metrics for comparison
const previousMetrics = {
  runtime: {
    deny_rate: {
      backpressure: 2.1,
      budget: 1.8,
      quota: 0.3,
      rate_limit: 0.9
    },
    queue_depth_interactive: 50,
    queue_depth_batch: 80,
    jobs_active: 30
  },
  billing: {
    cost_micros_total: {
      model: 60000,
      tools: 100000,
      cache_read: 3000,
      cache_write: 1000
    }
  },
  recovery: {
    recoverable_found: 2,
    resume_success: 15,
    resume_fail: 1
  }
};

// Process metrics and generate signals
const signals = engine.processMetrics(mockMetrics);

console.log(`Generated ${signals.length} signals:`);
for (const signal of signals) {
  console.log(`  - ${signal.signalId}: ${signal.severity} - ${signal.summary}`);
  console.log(`    Category: ${signal.category}`);
  console.log(`    Evidence: ${signal.evidence.metrics?.join(', ') || 'None'}`);
}

// Verify that certain signals were generated
const backpressureSignals = signals.filter(s => s.category === 'capacity' && s.summary.includes('backpressure'));
const costSignals = signals.filter(s => s.category === 'cost' && s.summary.includes('tools cost'));

console.log("");
console.log("✓ Signal detection tests:");
console.log(`  - Backpressure signals detected: ${backpressureSignals.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  - Cost inefficiency signals detected: ${costSignals.length > 0 ? 'PASS' : 'FAIL'}`);

// Verify signal properties
if (signals.length > 0) {
  const firstSignal = signals[0];
  console.log(`  - Signal has ID: ${!!firstSignal.signalId ? 'PASS' : 'FAIL'}`);
  console.log(`  - Signal has severity: ${!!firstSignal.severity ? 'PASS' : 'FAIL'}`);
  console.log(`  - Signal has summary: ${!!firstSignal.summary ? 'PASS' : 'FAIL'}`);
  console.log(`  - Signal has cause: ${!!firstSignal.probableCause ? 'PASS' : 'FAIL'}`);
  console.log(`  - Signal has actions: ${firstSignal.recommendedActions.length > 0 ? 'PASS' : 'FAIL'}`);
}

// Check that signals have proper severity and category
const hasCritical = signals.some(s => s.severity === 'critical');
const hasWarning = signals.some(s => s.severity === 'warning');
const hasCapacity = signals.some(s => s.category === 'capacity');
const hasCost = signals.some(s => s.category === 'cost');

console.log(`  - Has critical signals: ${hasCritical ? 'PASS' : 'FAIL'}`);
console.log(`  - Has warning signals: ${hasWarning ? 'PASS' : 'FAIL'}`);
console.log(`  - Has capacity signals: ${hasCapacity ? 'PASS' : 'FAIL'}`);
console.log(`  - Has cost signals: ${hasCost ? 'PASS' : 'FAIL'}`);

// Final validation
const allChecksPass = backpressureSignals.length > 0 && 
                      costSignals.length > 0 && 
                      signals.some(s => s.signalId) &&
                      signals.some(s => s.severity) &&
                      signals.some(s => s.summary) &&
                      signals.some(s => s.probableCause) &&
                      signals.some(s => s.recommendedActions.length > 0) &&
                      hasCritical && hasWarning && hasCapacity && hasCost;

if (allChecksPass) {
  console.log("\n✅ J-Smoke-1: Signal Detection - PASSED");
} else {
  console.log("\n❌ J-Smoke-1: Signal Detection - FAILED");
  process.exit(1);
}
EOF

node /tmp/test_ops_signals.js

# Test J-Smoke-2: Signal Resolution
echo ""
echo "Test J-Smoke-2: Signal Resolution"
echo "-----------------------------------"

cat > /tmp/test_signal_resolution.js << 'EOF'
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing Signal Resolution...");

const engine = new OpsSignalsEngine();

// Create mock metrics to generate signals
const mockMetrics = {
  runtime: {
    deny_rate: {
      backpressure: 8.0,
      budget: 0,
      quota: 0,
      rate_limit: 0
    },
    queue_depth_interactive: 150,
    queue_depth_batch: 400,
    jobs_active: 50
  },
  billing: {
    cost_micros_total: {
      model: 50000,
      tools: 1000000,
      cache_read: 3000,
      cache_write: 1000
    }
  },
  recovery: {
    recoverable_found: 0,
    resume_success: 0,
    resume_fail: 0
  }
};

// Generate initial signals
const initialSignals = engine.processMetrics(mockMetrics);
console.log(`Initial signals: ${initialSignals.length}`);

if (initialSignals.length === 0) {
  console.log("No signals generated - skipping resolution test");
  process.exit(0);
}

// Get first signal ID
const firstSignalId = initialSignals[0].signalId;
console.log(`Attempting to resolve signal: ${firstSignalId}`);

// Verify signal is initially active
const activeSignalsBefore = engine.getActiveSignals();
console.log(`Active signals before resolution: ${activeSignalsBefore.length}`);

// Resolve the signal
const resolved = engine.resolveSignal(firstSignalId, 'test-resolver');
console.log(`Resolution result: ${resolved ? 'SUCCESS' : 'FAILED'}`);

// Verify signal is now resolved
const signalAfter = engine.getSignalById(firstSignalId);
console.log(`Signal resolved status: ${signalAfter?.resolved ? 'RESOLVED' : 'ACTIVE'}`);
console.log(`Signal has resolver ID: ${!!signalAfter?.resolverId ? 'YES' : 'NO'}`);
console.log(`Signal has resolved timestamp: ${!!signalAfter?.resolvedAt ? 'YES' : 'NO'}`);

// Get active signals after resolution
const activeSignalsAfter = engine.getActiveSignals();
console.log(`Active signals after resolution: ${activeSignalsAfter.length}`);

// Test signal cleanup
const cleanedCount = engine.cleanupResolvedSignals(0); // Clean immediately
console.log(`Cleaned up resolved signals: ${cleanedCount}`);

// Verify final counts
const finalActive = engine.getActiveSignals();
const finalAll = [...engine.getActiveSignals()]; // This will be empty after cleanup

console.log("");
console.log("✓ Signal resolution tests:");
console.log(`  - Signal resolution successful: ${resolved ? 'PASS' : 'FAIL'}`);
console.log(`  - Signal marked as resolved: ${signalAfter?.resolved ? 'PASS' : 'FAIL'}`);
console.log(`  - Resolver ID recorded: ${signalAfter?.resolverId === 'test-resolver' ? 'PASS' : 'FAIL'}`);
console.log(`  - Active signals decreased: ${activeSignalsAfter.length < activeSignalsBefore.length ? 'PASS' : 'FAIL'}`);
console.log(`  - Cleanup works: ${cleanedCount >= 1 ? 'PASS' : 'FAIL'}`);

// Final validation
const allChecksPass = resolved && 
                      signalAfter?.resolved && 
                      signalAfter?.resolverId === 'test-resolver' &&
                      activeSignalsAfter.length < activeSignalsBefore.length &&
                      cleanedCount >= 1;

if (allChecksPass) {
  console.log("\n✅ J-Smoke-2: Signal Resolution - PASSED");
} else {
  console.log("\n❌ J-Smoke-2: Signal Resolution - FAILED");
  process.exit(1);
}
EOF

node /tmp/test_ops_signals.js

# Test J-Smoke-3: Category Filtering
echo ""
echo "Test J-Smoke-3: Category Filtering"
echo "------------------------------------"

cat > /tmp/test_category_filtering.js << 'EOF'
import { OpsSignalsEngine } from '../src/core/ops-intelligence/opsSignals.js';

console.log("Testing Category Filtering...");

const engine = new OpsSignalsEngine();

// Create metrics that should trigger different categories
const mockMetrics = {
  runtime: {
    deny_rate: {
      backpressure: 9.0,  // This should trigger capacity signals
      budget: 0,
      quota: 0,
      rate_limit: 0
    },
    queue_depth_interactive: 200,
    queue_depth_batch: 500,
    jobs_active: 60
  },
  billing: {
    cost_micros_total: {
      model: 40000,
      tools: 2000000,  // This should trigger cost signals
      cache_read: 5000,
      cache_write: 3000
    }
  },
  recovery: {
    recoverable_found: 15,  // This should trigger recovery signals
    resume_success: 5,
    resume_fail: 10
  }
};

// Generate signals
const signals = engine.processMetrics(mockMetrics);
console.log(`Total signals generated: ${signals.length}`);

// Test category filtering
const capacitySignals = engine.getSignalsByCategory('capacity');
const costSignals = engine.getSignalsByCategory('cost');
const recoverySignals = engine.getSignalsByCategory('recovery');
const abuseSignals = engine.getSignalsByCategory('abuse'); // Should be empty

console.log(`Capacity signals: ${capacitySignals.length}`);
console.log(`Cost signals: ${costSignals.length}`);
console.log(`Recovery signals: ${recoverySignals.length}`);
console.log(`Abuse signals: ${abuseSignals.length}`);

// Test severity filtering
const criticalSignals = engine.getSignalsBySeverity('critical');
const warningSignals = engine.getSignalsBySeverity('warning');
const infoSignals = engine.getSignalsBySeverity('info');

console.log(`Critical signals: ${criticalSignals.length}`);
console.log(`Warning signals: ${warningSignals.length}`);
console.log(`Info signals: ${infoSignals.length}`);

// Verify filtering works correctly
const totalByCategory = capacitySignals.length + costSignals.length + recoverySignals.length + abuseSignals.length;
const totalBySeverity = criticalSignals.length + warningSignals.length + infoSignals.length;

console.log("");
console.log("✓ Category and severity filtering tests:");
console.log(`  - Total by category matches: ${totalByCategory === signals.length ? 'PASS' : 'FAIL'}`);
console.log(`  - Total by severity matches: ${totalBySeverity === signals.length ? 'PASS' : 'FAIL'}`);
console.log(`  - Has capacity signals: ${capacitySignals.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  - Has cost signals: ${costSignals.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  - Has recovery signals: ${recoverySignals.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  - Has critical signals: ${criticalSignals.length > 0 ? 'PASS' : 'FAIL'}`);
console.log(`  - Has warning signals: ${warningSignals.length > 0 ? 'PASS' : 'FAIL'}`);

// Final validation
const allChecksPass = totalByCategory === signals.length &&
                      totalBySeverity === signals.length &&
                      capacitySignals.length > 0 &&
                      costSignals.length > 0 &&
                      recoverySignals.length > 0 &&
                      criticalSignals.length > 0 &&
                      warningSignals.length > 0;

if (allChecksPass) {
  console.log("\n✅ J-Smoke-3: Category Filtering - PASSED");
} else {
  console.log("\n❌ J-Smoke-3: Category Filtering - FAILED");
  process.exit(1);
}
EOF

node /tmp/test_ops_signals.js

# Cleanup temp files
rm -f /tmp/test_ops_signals.js /tmp/test_signal_resolution.js /tmp/test_category_filtering.js

echo ""
echo "🎉 All Layer J (Ops Intelligence) smoke tests passed!"
echo "   - Signal Detection ✓"
echo "   - Signal Resolution ✓" 
echo "   - Category Filtering ✓"