import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  canAssignRole,
  validateRoleAssignment,
  getAccessibleOrgUnits,
} from '@/utils/hierarchyPermissions';
import type { OrgUnit, UserWithHierarchy, UserRole } from '@/utils/hierarchyPermissions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { currentUserId, targetUserId, newRole } = req.body;

    if (!currentUserId || !targetUserId || !newRole) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch current user data
    const { data: currentUserRole, error: curError } = await supabase
      .from('user_roles')
      .select('role, org_unit_id, managed_org_units, hierarchy_level')
      .eq('user_id', currentUserId)
      .single();

    if (curError || !currentUserRole) {
      return res.status(400).json({ error: 'Current user not found' });
    }

    // Fetch target user data
    const { data: targetUserRole, error: tarError } = await supabase
      .from('user_roles')
      .select('role, org_unit_id, managed_org_units, hierarchy_level')
      .eq('user_id', targetUserId)
      .single();

    if (tarError) {
      return res.status(400).json({ error: 'Target user not found' });
    }

    // Fetch all org units
    const { data: orgUnits, error: orgError } = await supabase
      .from('org_units')
      .select('id, name, type, parent_id, hierarchy_level');

    if (orgError || !orgUnits) {
      return res.status(500).json({ error: 'Failed to fetch org units' });
    }

    // Build user data objects
    const currentUser: UserWithHierarchy = {
      id: currentUserId,
      email: currentUserId, // Would need auth users table for actual email
      role: (currentUserRole.role as UserRole) || 'user',
      org_unit_id: currentUserRole.org_unit_id,
      managed_org_units: currentUserRole.managed_org_units,
      hierarchy_level: currentUserRole.hierarchy_level,
    };

    const targetUser: UserWithHierarchy = {
      id: targetUserId,
      email: targetUserId,
      role: (targetUserRole?.role as UserRole) || 'user',
      org_unit_id: targetUserRole?.org_unit_id,
      managed_org_units: targetUserRole?.managed_org_units,
      hierarchy_level: targetUserRole?.hierarchy_level,
    };

    // Validate permission
    const validation = validateRoleAssignment(
      currentUser,
      targetUser,
      newRole as UserRole,
      orgUnits as OrgUnit[]
    );

    return res.status(200).json(validation);
  } catch (error) {
    console.error('Error validating role assignment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
