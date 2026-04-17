/**
 * Utility functions untuk mengelola permissions berdasarkan hierarchy organisasi
 * 
 * Aturan:
 * 1. Admin hanya bisa manage unit organisasi di bawahnya (child units)
 * 2. Admin pusat bisa manage semua unit
 * 3. Only parent admin + super admin pusat bisa assign admin/moderator roles
 * 4. Moderator juga ikut hierarki (terikat ke satu unit)
 */

export type UserRole = 'admin' | 'moderator' | 'user';
export type OrgUnitType = 'pusat' | 'wilayah' | 'kabupaten' | 'kecamatan' | 'ranting';

export interface OrgUnit {
  id: string;
  name: string;
  type: OrgUnitType;
  parent_id: string | null;
  hierarchy_level: number;
}

export interface UserWithHierarchy {
  id: string;
  email: string;
  role: UserRole;
  org_unit_id: string | null;
  managed_org_units: string[] | null; // JSON array dari org unit IDs yang bisa dikelola
  hierarchy_level: number | null; // Level dari org unit yang dikaitkan
}

const HIERARCHY_LEVELS: Record<OrgUnitType, number> = {
  pusat: 0,
  wilayah: 1,
  kabupaten: 2,
  kecamatan: 3,
  ranting: 4,
};

/**
 * Check apakah user bisa manage org unit tertentu
 */
export function canManageOrgUnit(
  currentUser: UserWithHierarchy,
  targetOrgUnitId: string,
  targetOrgUnitLevel: number,
  allOrgUnits: OrgUnit[]
): boolean {
  // Super admin pusat bisa manage semua
  if (currentUser.role === 'admin' && currentUser.hierarchy_level === 0) {
    return true;
  }

  // User bukan admin tidak bisa manage apapun
  if (currentUser.role !== 'admin') {
    return false;
  }

  // Admin bisa manage unit yang ada di managed_org_units
  if (currentUser.managed_org_units?.includes(targetOrgUnitId)) {
    return true;
  }

  // Admin bisa manage child units dari unit yang mereka manage
  if (currentUser.managed_org_units && currentUser.managed_org_units.length > 0) {
    // Check apakah target unit adalah child dari salah satu managed units
    for (const managedUnitId of currentUser.managed_org_units) {
      if (isChildOf(targetOrgUnitId, managedUnitId, allOrgUnits)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check apakah user bisa assign/edit role untuk user lain
 * Only parent admin + super admin pusat yang bisa assign admin/moderator roles
 */
export function canAssignRole(
  currentUser: UserWithHierarchy,
  targetUser: UserWithHierarchy,
  targetRole: UserRole,
  allOrgUnits: OrgUnit[]
): boolean {
  // Super admin pusat bisa assign apapun
  if (currentUser.role === 'admin' && currentUser.hierarchy_level === 0) {
    return true;
  }

  // User bukan admin tidak bisa assign roles
  if (currentUser.role !== 'admin') {
    return false;
  }

  // Jika target role adalah 'user', parent admin bisa assign ke users di managed org unit
  if (targetRole === 'user') {
    if (targetUser.org_unit_id) {
      return canManageOrgUnit(
        currentUser,
        targetUser.org_unit_id,
        targetUser.hierarchy_level || 0,
        allOrgUnits
      );
    }
    return false;
  }

  // Jika target role adalah 'admin' atau 'moderator', hanya parent admin dari unit tersebut
  if (targetRole === 'admin' || targetRole === 'moderator') {
    if (!targetUser.org_unit_id) {
      return false;
    }

    const targetOrgUnit = allOrgUnits.find(ou => ou.id === targetUser.org_unit_id);
    if (!targetOrgUnit) {
      return false;
    }

    // Current user harus admin dari parent org unit
    if (currentUser.managed_org_units?.includes(targetOrgUnit.id)) {
      return true;
    }

    // atau jika target unit adalah child dari managed unit
    for (const managedUnitId of currentUser.managed_org_units || []) {
      if (isDirectChild(targetOrgUnit.id, managedUnitId, allOrgUnits)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get list org units yang bisa diakses oleh user
 */
export function getAccessibleOrgUnits(
  currentUser: UserWithHierarchy,
  allOrgUnits: OrgUnit[]
): OrgUnit[] {
  // Super admin pusat bisa akses semua
  if (currentUser.role === 'admin' && currentUser.hierarchy_level === 0) {
    return allOrgUnits;
  }

  // User biasa hanya bisa lihat org unit mereka sendiri
  if (currentUser.role === 'user' || currentUser.role === 'moderator') {
    if (currentUser.org_unit_id) {
      return allOrgUnits.filter(ou => ou.id === currentUser.org_unit_id);
    }
    return [];
  }

  // Admin bisa akses managed units + child units
  const accessible = new Set<string>();

  if (currentUser.managed_org_units) {
    for (const unitId of currentUser.managed_org_units) {
      accessible.add(unitId);
      // Tambah semua children
      const children = getChildren(unitId, allOrgUnits);
      children.forEach(child => accessible.add(child.id));
    }
  }

  return allOrgUnits.filter(ou => accessible.has(ou.id));
}

/**
 * Get list users yang bisa dikelola oleh current user
 */
export function getManageableUsers(
  currentUser: UserWithHierarchy,
  allUsers: UserWithHierarchy[],
  allOrgUnits: OrgUnit[]
): UserWithHierarchy[] {
  const accessibleOrgUnits = getAccessibleOrgUnits(currentUser, allOrgUnits);
  const accessibleUnitIds = new Set(accessibleOrgUnits.map(ou => ou.id));

  return allUsers.filter(user => {
    // Admin pusat bisa manage semua user
    if (currentUser.role === 'admin' && currentUser.hierarchy_level === 0) {
      return user.id !== currentUser.id; // Except themselves
    }

    // Hanya users yang berada di accessible org units
    if (user.org_unit_id && accessibleUnitIds.has(user.org_unit_id)) {
      return user.id !== currentUser.id; // Except themselves
    }

    return false;
  });
}

/**
 * Helper: Check apakah unitId adalah child dari parentId
 */
function isChildOf(
  unitId: string,
  parentId: string,
  allOrgUnits: OrgUnit[]
): boolean {
  const unit = allOrgUnits.find(ou => ou.id === unitId);
  if (!unit || !unit.parent_id) {
    return false;
  }

  if (unit.parent_id === parentId) {
    return true;
  }

  // Recursive check
  return isChildOf(unit.parent_id, parentId, allOrgUnits);
}

/**
 * Helper: Check apakah unitId adalah direct child dari parentId
 */
function isDirectChild(
  unitId: string,
  parentId: string,
  allOrgUnits: OrgUnit[]
): boolean {
  const unit = allOrgUnits.find(ou => ou.id === unitId);
  return unit?.parent_id === parentId;
}

/**
 * Helper: Get all children dari suatu org unit
 */
function getChildren(parentId: string, allOrgUnits: OrgUnit[]): OrgUnit[] {
  return allOrgUnits.filter(ou => ou.parent_id === parentId);
}

/**
 * Helper: Get all descendants dari suatu org unit (recursive)
 */
export function getDescendants(
  parentId: string,
  allOrgUnits: OrgUnit[]
): OrgUnit[] {
  const children = getChildren(parentId, allOrgUnits);
  let descendants: OrgUnit[] = [...children];

  for (const child of children) {
    descendants = [...descendants, ...getDescendants(child.id, allOrgUnits)];
  }

  return descendants;
}

/**
 * Get parent org unit
 */
export function getParent(
  orgUnitId: string,
  allOrgUnits: OrgUnit[]
): OrgUnit | undefined {
  const unit = allOrgUnits.find(ou => ou.id === orgUnitId);
  if (!unit || !unit.parent_id) {
    return undefined;
  }
  return allOrgUnits.find(ou => ou.id === unit.parent_id);
}

/**
 * Get ancestors (parent, grandparent, etc.) dari suatu org unit
 */
export function getAncestors(
  orgUnitId: string,
  allOrgUnits: OrgUnit[]
): OrgUnit[] {
  const parent = getParent(orgUnitId, allOrgUnits);
  if (!parent) {
    return [];
  }
  return [parent, ...getAncestors(parent.id, allOrgUnits)];
}

/**
 * Validate role assignment terhadap hierarchy
 * Returns { isValid: boolean, reason: string }
 */
export function validateRoleAssignment(
  currentUser: UserWithHierarchy,
  targetUser: UserWithHierarchy,
  newRole: UserRole,
  allOrgUnits: OrgUnit[]
): { isValid: boolean; reason: string } {
  // Check permission
  if (!canAssignRole(currentUser, targetUser, newRole, allOrgUnits)) {
    return {
      isValid: false,
      reason: 'Anda tidak memiliki izin untuk mengubah role user ini',
    };
  }

  // Additional validations
  if (newRole === 'admin' || newRole === 'moderator') {
    if (!targetUser.org_unit_id) {
      return {
        isValid: false,
        reason: `User harus dikaitkan dengan org unit terlebih dahulu sebelum diberikan role ${newRole}`,
      };
    }
  }

  return {
    isValid: true,
    reason: 'Valid',
  };
}
