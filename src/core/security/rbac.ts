// RBAC Service - Enterprise Controls v1
// Role-based access control for enterprise security

export type UserRole = 
  | 'viewer'     // Read-only access to metrics and sessions
  | 'operator'   // Full access to mission control, session management
  | 'auditor'    // Access to audit logs, receipts, compliance data
  | 'admin';     // Full administrative access

export type Permission = 
  | 'dashboard:view'        // View dashboard metrics
  | 'sessions:list'         // List sessions
  | 'sessions:read'         // Read session details
  | 'sessions:explain'      // Access decision explanations
  | 'receipts:view'         // View cost receipts
  | 'receipts:export'       // Export receipts
  | 'audit:read'            // Read audit logs
  | 'audit:export'          // Export audit data
  | 'users:manage'          // Manage user accounts (admin only)
  | 'rbac:manage'           // Manage roles and permissions (admin only)
  | 'system:config';        // System configuration (admin only)

export type Subject = {
  id: string;
  roles: UserRole[];
  permissions?: Permission[]; // Explicit permissions (overrides role defaults)
  tenantId?: string;          // For multi-tenant environments
};

export type Resource = {
  type: string; // 'session', 'receipt', 'metric', 'audit_log', etc.
  id: string;
  ownerId?: string;           // User who owns this resource
  tenantId?: string;          // Tenant that owns this resource
};

export class RBACService {
  private rolePermissions: Map<UserRole, Permission[]> = new Map([
    ['viewer', [
      'dashboard:view',
      'sessions:list',
      'sessions:read',
      'receipts:view'
    ]],
    ['operator', [
      'dashboard:view',
      'sessions:list',
      'sessions:read',
      'sessions:explain',
      'receipts:view'
    ]],
    ['auditor', [
      'audit:read',
      'receipts:view',
      'receipts:export',
      'audit:export'
    ]],
    ['admin', [
      'dashboard:view',
      'sessions:list',
      'sessions:read',
      'sessions:explain',
      'receipts:view',
      'receipts:export',
      'audit:read',
      'audit:export',
      'users:manage',
      'rbac:manage',
      'system:config'
    ]]
  ]);
  
  /**
   * Check if a subject has permission to access a resource
   */
  canAccess(subject: Subject, action: Permission, resource?: Resource): boolean {
    // Check explicit permissions first
    if (subject.permissions && subject.permissions.includes(action)) {
      return true;
    }
    
    // Check role-based permissions
    for (const role of subject.roles) {
      const rolePerms = this.rolePermissions.get(role) || [];
      if (rolePerms.includes(action)) {
        // If resource exists, apply additional checks
        if (resource) {
          // For owner-specific resources, check ownership
          if (resource.ownerId && action.startsWith('receipts:') || action.startsWith('sessions:')) {
            return resource.ownerId === subject.id || this.hasAdminRole(subject);
          }
          
          // For tenant-specific resources, check tenant membership
          if (resource.tenantId && subject.tenantId) {
            return resource.tenantId === subject.tenantId || this.hasAdminRole(subject);
          }
        }
        
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get all permissions for a subject
   */
  getPermissions(subject: Subject): Permission[] {
    const permissions = new Set<Permission>();
    
    // Add explicit permissions
    if (subject.permissions) {
      subject.permissions.forEach(p => permissions.add(p));
    }
    
    // Add role-based permissions
    for (const role of subject.roles) {
      const rolePerms = this.rolePermissions.get(role) || [];
      rolePerms.forEach(p => permissions.add(p));
    }
    
    return Array.from(permissions);
  }
  
  /**
   * Check if subject has admin role
   */
  private hasAdminRole(subject: Subject): boolean {
    return subject.roles.includes('admin');
  }
  
  /**
   * Validate user assignment to roles
   */
  validateRoleAssignment(admin: Subject, targetUserId: string, roles: UserRole[]): boolean {
    // Only admins can assign roles
    if (!this.hasAdminRole(admin)) {
      return false;
    }
    
    // Admin role can only be assigned by another admin (prevent escalation)
    if (roles.includes('admin') && !admin.roles.includes('admin')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Add permission to user (admin only)
   */
  addPermission(admin: Subject, targetUserId: string, permission: Permission): boolean {
    if (!this.hasAdminRole(admin)) {
      return false;
    }
    
    // In a real system, this would update the user record
    // For now, just validate the permission is valid
    const allPermissions = Array.from(this.rolePermissions.values()).flat();
    return allPermissions.includes(permission) || 
           ['users:manage', 'rbac:manage', 'system:config'].includes(permission);
  }
  
  /**
   * Remove permission from user (admin only)
   */
  removePermission(admin: Subject, targetUserId: string, permission: Permission): boolean {
    if (!this.hasAdminRole(admin)) {
      return false;
    }
    
    return true; // Validation passed
  }
}