import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { canManageOrgUnit } from '@/utils/hierarchyPermissions';
import type { OrgUnit, UserRole } from '@/utils/hierarchyPermissions';

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
    const { userId, parentOrgUnitId, isEdit, orgUnitId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch user role data
    const { data: userRole, error: userError } = await supabase
      .from('user_roles')
      .select('role, org_unit_id, managed_org_units, hierarchy_level')
      .eq('user_id', userId)
      .single();

    if (userError || !userRole) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Fetch all org units
    const { data: orgUnits, error: orgError } = await supabase
      .from('org_units')
      .select('id, name, type, parent_id, hierarchy_level');

    if (orgError || !orgUnits) {
      return res.status(500).json({ error: 'Failed to fetch org units' });
    }

    let isValid = true;
    let reason = 'Valid';

    if (isEdit && orgUnitId) {
      // Check edit permission
      const editUnit = orgUnits.find(u => u.id === orgUnitId);
      if (!editUnit) {
        return res.status(400).json({ isValid: false, reason: 'Org unit not found' });
      }

      isValid = canManageOrgUnit(
        {
          id: userId,
          email: userId,
          role: (userRole.role as UserRole) || 'user',
          org_unit_id: userRole.org_unit_id,
          managed_org_units: userRole.managed_org_units,
          hierarchy_level: userRole.hierarchy_level,
        },
        orgUnitId,
        editUnit.hierarchy_level,
        orgUnits as OrgUnit[]
      );

      if (!isValid) {
        reason = 'You do not have permission to edit this org unit';
      }
    } else if (parentOrgUnitId) {
      // Check creation permission
      const parentUnit = orgUnits.find(u => u.id === parentOrgUnitId);
      if (!parentUnit) {
        return res.status(400).json({ isValid: false, reason: 'Parent org unit not found' });
      }

      isValid = canManageOrgUnit(
        {
          id: userId,
          email: userId,
          role: (userRole.role as UserRole) || 'user',
          org_unit_id: userRole.org_unit_id,
          managed_org_units: userRole.managed_org_units,
          hierarchy_level: userRole.hierarchy_level,
        },
        parentOrgUnitId,
        parentUnit.hierarchy_level,
        orgUnits as OrgUnit[]
      );

      if (!isValid) {
        reason = 'You do not have permission to create a unit under this parent';
      }
    }

    return res.status(200).json({ isValid, reason });
  } catch (error) {
    console.error('Error validating org unit:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
