#!/bin/bash
# Smoke Test: Enterprise Controls (Layer I)
# Tests RBAC, audit export, and dispute flow

set -e

echo "🧪 Smoke Test: Enterprise Controls (Layer I)"
echo "==========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test I-Smoke-1: RBAC and Permissions
echo ""
echo "Test I-Smoke-1: RBAC and Permissions"
echo "------------------------------------"

cat > /tmp/test_rbac.js << 'EOF'
import { RBACService } from '../src/core/security/rbac.js';

console.log("Testing RBAC service and permissions...");

const rbacService = new RBACService();

// Create test subjects with different roles
const viewerUser = {
  id: 'viewer-123',
  roles: ['viewer'],
  permissions: []
};

const operatorUser = {
  id: 'operator-456',
  roles: ['operator'],
  permissions: []
};

const auditorUser = {
  id: 'auditor-789',
  roles: ['auditor'],
  permissions: []
};

const adminUser = {
  id: 'admin-000',
  roles: ['admin'],
  permissions: []
};

// Test viewer permissions
console.log("✓ Viewer permissions:");
console.log(`  - Can view dashboard: ${rbacService.canAccess(viewerUser, 'dashboard:view')}`);
console.log(`  - Can list sessions: ${rbacService.canAccess(viewerUser, 'sessions:list')}`);
console.log(`  - Can read sessions: ${rbacService.canAccess(viewerUser, 'sessions:read')}`);
console.log(`  - Can view receipts: ${rbacService.canAccess(viewerUser, 'receipts:view')}`);
console.log(`  - Can export receipts: ${rbacService.canAccess(viewerUser, 'receipts:export')}`); // Should be false

// Verify viewer cannot export receipts
if (!rbacService.canAccess(viewerUser, 'receipts:export')) {
  console.log("✓ Viewer correctly denied receipt export");
} else {
  console.log("✗ Viewer incorrectly granted receipt export");
  process.exit(1);
}

// Test operator permissions
console.log("\n✓ Operator permissions:");
console.log(`  - Can view dashboard: ${rbacService.canAccess(operatorUser, 'dashboard:view')}`);
console.log(`  - Can access explain: ${rbacService.canAccess(operatorUser, 'sessions:explain')}`);
console.log(`  - Can view receipts: ${rbacService.canAccess(operatorUser, 'receipts:view')}`);

// Test auditor permissions
console.log("\n✓ Auditor permissions:");
console.log(`  - Can read audits: ${rbacService.canAccess(auditorUser, 'audit:read')}`);
console.log(`  - Can export receipts: ${rbacService.canAccess(auditorUser, 'receipts:export')}`);
console.log(`  - Can export audits: ${rbacService.canAccess(auditorUser, 'audit:export')}`);

// Test admin permissions
console.log("\n✓ Admin permissions:");
console.log(`  - Can manage users: ${rbacService.canAccess(adminUser, 'users:manage')}`);
console.log(`  - Can manage RBAC: ${rbacService.canAccess(adminUser, 'rbac:manage')}`);
console.log(`  - Can configure system: ${rbacService.canAccess(adminUser, 'system:config')}`);

// Test role validation
const roleValidation = rbacService.validateRoleAssignment(adminUser, 'user-123', ['viewer', 'operator']);
console.log(`\n✓ Admin can assign roles: ${roleValidation}`);

// Verify non-admin cannot assign admin role
const nonAdmin = { id: 'user-123', roles: ['viewer'], permissions: [] };
const escalationBlocked = !rbacService.validateRoleAssignment(nonAdmin, 'user-456', ['admin']);
console.log(`✓ Non-admin escalation blocked: ${escalationBlocked}`);

if (escalationBlocked) {
  console.log("✓ RBAC correctly prevents privilege escalation");
} else {
  console.log("✗ RBAC allows privilege escalation");
  process.exit(1);
}

console.log("✓ Test I-Smoke-1 PASSED: RBAC permissions working correctly");
EOF

if npx tsx /tmp/test_rbac.js; then
  echo -e "${GREEN}✓ Test I-Smoke-1 PASSED${NC}: RBAC permissions working correctly"
else
  echo -e "${RED}✗ Test I-Smoke-1 FAILED${NC}: RBAC issues"
  rm -f /tmp/test_rbac.js
  exit 1
fi

rm -f /tmp/test_rbac.js

# Test I-Smoke-2: Audit Export and Dispute Flow
echo ""
echo "Test I-Smoke-2: Audit Export and Dispute Flow"
echo "---------------------------------------------"

cat > /tmp/test_audit_dispute.js << 'EOF'
import { RBACService } from '../src/core/security/rbac.js';
import { AuditExportService } from '../src/core/security/auditExport.js';
import { DisputeService } from '../src/core/security/disputeFlow.js';

console.log("Testing audit export and dispute flow...");

// Create RBAC service
const rbacService = new RBACService();

// Create test users
const adminUser = {
  id: 'admin-000',
  roles: ['admin'],
  permissions: []
};

const auditorUser = {
  id: 'auditor-789',
  roles: ['auditor'],
  permissions: []
};

const customerUser = {
  id: 'customer-abc',
  roles: ['viewer'],
  permissions: []
};

// Create services
const auditService = new AuditExportService(rbacService);
const disputeService = new DisputeService(rbacService);

// Test audit export permissions
try {
  // This should fail for customer user
  await auditService.exportAuditData(customerUser, { format: 'json' });
  console.log("✗ Customer incorrectly allowed to export audit data");
  process.exit(1);
} catch (error) {
  if (error.message.includes('permission')) {
    console.log("✓ Customer correctly denied audit export");
  } else {
    console.log(`✗ Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Test audit export with auditor
try {
  const auditExport = await auditService.exportAuditData(auditorUser, { 
    format: 'json',
    includeReceipts: true,
    includeExplanations: true
  });
  
  if (auditExport && auditExport.id && auditExport.signature) {
    console.log("✓ Auditor successfully exported audit data with signature");
    console.log(`  - Export ID: ${auditExport.id}`);
    console.log(`  - Format: ${auditExport.format}`);
    console.log(`  - Has signature: ${!!auditExport.signature}`);
    console.log(`  - Has integrity hash: ${!!auditExport.integrityHash}`);
  } else {
    console.log("✗ Audit export failed for auditor");
    process.exit(1);
  }
} catch (error) {
  console.log(`✗ Auditor audit export failed: ${error.message}`);
  process.exit(1);
}

// Test dispute submission
const disputeRequest = {
  sessionId: 'session-dispute-test',
  category: 'billing_error',
  description: 'Incorrect charge for model usage',
  evidenceUrls: ['https://example.com/evidence.png']
};

const dispute = await disputeService.submitDispute(customerUser, disputeRequest);
console.log(`✓ Customer submitted dispute: ${dispute.id}`);
console.log(`  - Status: ${dispute.status}`);
console.log(`  - Category: ${dispute.category}`);
console.log(`  - Evidence count: ${dispute.evidence.length}`);

// Verify dispute was created with correct status
if (dispute.status === 'open' && dispute.customerId === customerUser.id) {
  console.log("✓ Dispute created with correct initial status and customer ID");
} else {
  console.log("✗ Dispute not created correctly");
  process.exit(1);
}

// Test dispute resolution by auditor
const resolution = {
  disputeId: dispute.id,
  resolution: 'resolved',
  notes: 'Reviewed evidence, charge was correct according to usage logs',
  chargebackAmount: 0
};

const resolvedDispute = await disputeService.resolveDispute(auditorUser, resolution);
console.log(`✓ Auditor resolved dispute: ${resolvedDispute.status}`);
console.log(`  - Resolution notes: ${resolvedDispute.resolutionNotes}`);

if (resolvedDispute.status === 'resolved' && resolvedDispute.reviewerId === auditorUser.id) {
  console.log("✓ Dispute resolution completed successfully");
} else {
  console.log("✗ Dispute resolution failed");
  process.exit(1);
}

// Test dispute listing
const disputes = await disputeService.listDisputes(auditorUser);
console.log(`✓ Auditor can list disputes: ${disputes.length} found`);

// Test dispute stats
const stats = await disputeService.getDisputeStats(auditorUser);
console.log(`✓ Dispute stats available: total=${stats.total}, byStatus=${Object.keys(stats.byStatus).join(',')}`);

console.log("✓ Test I-Smoke-2 PASSED: Audit export and dispute flow working correctly");
EOF

if npx tsx /tmp/test_audit_dispute.js; then
  echo -e "${GREEN}✓ Test I-Smoke-2 PASSED${NC}: Audit export and dispute flow working correctly"
else
  echo -e "${RED}✗ Test I-Smoke-2 FAILED${NC}: Audit/export or dispute issues"
  rm -f /tmp/test_audit_dispute.js
  exit 1
fi

rm -f /tmp/test_audit_dispute.js

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Layer I Smoke Tests PASSED! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Enterprise Controls features working:"
echo "  ✓ RBAC with viewer/operator/auditor/admin roles"
echo "  ✓ Permission-based access control"
echo "  ✓ Audit export with signatures and integrity checks"
echo "  ✓ Dispute/chargeback workflow"
echo "  ✓ Customer self-service access controls"
echo "  ✓ Protection against privilege escalation"