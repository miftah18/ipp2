-- ============================================================
-- ADD HIERARCHICAL ADMIN SYSTEM
-- ============================================================

-- 1. Add hierarchy level column to org_units
ALTER TABLE public.org_units ADD COLUMN hierarchy_level INT DEFAULT 0;

-- Update hierarchy levels based on parent_id
UPDATE public.org_units SET hierarchy_level = 0 WHERE parent_id IS NULL;
UPDATE public.org_units SET hierarchy_level = 1 WHERE parent_id IS NOT NULL AND hierarchy_level = 0;

-- 2. Add columns to user_roles for hierarchy management
ALTER TABLE public.user_roles 
ADD COLUMN org_unit_id UUID REFERENCES public.org_units(id) ON DELETE CASCADE,
ADD COLUMN managed_org_units UUID[] DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX idx_user_roles_org_unit ON public.user_roles(org_unit_id);

-- 3. Create hierarchy_info view for easy permission checking
CREATE OR REPLACE VIEW public.hierarchy_info AS
SELECT 
  ur.user_id,
  ur.role,
  ur.org_unit_id,
  ur.managed_org_units,
  ou.hierarchy_level,
  ou.parent_id,
  ou.level as org_level
FROM public.user_roles ur
LEFT JOIN public.org_units ou ON ur.org_unit_id = ou.id;

-- 4. Function to get all descendants of an org_unit
CREATE OR REPLACE FUNCTION public.get_descendants(unit_id UUID)
RETURNS TABLE(descendant_id UUID, depth INT) AS $$
WITH RECURSIVE descendants AS (
  SELECT id, 0 as depth FROM public.org_units WHERE id = unit_id
  UNION ALL
  SELECT ou.id, d.depth + 1 
  FROM public.org_units ou
  JOIN descendants d ON ou.parent_id = d.descendant_id
)
SELECT descendant_id, depth FROM descendants;
$$ LANGUAGE SQL STABLE;

-- 5. Function to check if user can manage another user
CREATE OR REPLACE FUNCTION public.can_manage_user(
  p_admin_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role app_role;
  v_admin_org_unit UUID;
  v_admin_managed_units UUID[];
  v_target_org_unit UUID;
  v_target_role app_role;
  v_admin_hierarchy_level INT;
  v_target_hierarchy_level INT;
BEGIN
  -- Get admin info
  SELECT role, org_unit_id, managed_org_units 
  INTO v_admin_role, v_admin_org_unit, v_admin_managed_units
  FROM public.user_roles
  WHERE user_id = p_admin_id
  LIMIT 1;

  -- Admin must have admin or moderator role
  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RETURN FALSE;
  END IF;

  -- Get target user info
  SELECT role, org_unit_id 
  INTO v_target_role, v_target_org_unit
  FROM public.user_roles
  WHERE user_id = p_target_user_id
  LIMIT 1;

  -- If admin is super admin (no org_unit_id), they can manage everyone at lower levels
  IF v_admin_org_unit IS NULL THEN
    -- Super admin can manage everyone except other super admins with admin role
    IF v_target_role = 'admin' AND v_target_org_unit IS NULL THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- Get hierarchy levels
  SELECT hierarchy_level INTO v_admin_hierarchy_level
  FROM public.org_units
  WHERE id = v_admin_org_unit;

  SELECT hierarchy_level INTO v_target_hierarchy_level
  FROM public.org_units
  WHERE id = v_target_org_unit;

  -- Admin can manage users in their own unit and descendant units
  IF v_target_org_unit = ANY(v_admin_managed_units) OR 
     v_target_org_unit = v_admin_org_unit THEN
    -- Can't manage admin at same or higher level (unless target is not admin)
    IF v_target_role = 'admin' AND v_target_hierarchy_level <= v_admin_hierarchy_level THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 6. Function to check if user can assign admin role at a specific unit
CREATE OR REPLACE FUNCTION public.can_assign_admin_role(
  p_admin_id UUID,
  p_target_org_unit_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role app_role;
  v_admin_org_unit UUID;
  v_admin_hierarchy_level INT;
  v_target_hierarchy_level INT;
  v_target_parent_id UUID;
BEGIN
  -- Get admin info
  SELECT role, org_unit_id 
  INTO v_admin_role, v_admin_org_unit
  FROM public.user_roles
  WHERE user_id = p_admin_id
  LIMIT 1;

  -- Must be admin role
  IF v_admin_role != 'admin' THEN
    RETURN FALSE;
  END IF;

  -- Super admin (no org_unit) can assign to any unit
  IF v_admin_org_unit IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Get target and admin hierarchy info
  SELECT hierarchy_level, parent_id 
  INTO v_target_hierarchy_level, v_target_parent_id
  FROM public.org_units
  WHERE id = p_target_org_unit_id;

  SELECT hierarchy_level 
  INTO v_admin_hierarchy_level
  FROM public.org_units
  WHERE id = v_admin_org_unit;

  -- Admin can only assign roles at descendant units (strictly below their level)
  -- Check if p_target_org_unit_id is a descendant of v_admin_org_unit
  RETURN EXISTS (
    SELECT 1 FROM public.get_descendants(v_admin_org_unit) 
    WHERE descendant_id = p_target_org_unit_id AND depth > 0
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 7. Update RLS policies for user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR UPDATE TO authenticated 
  USING (public.can_manage_user(auth.uid(), user_id));

CREATE POLICY "Admins can assign roles" ON public.user_roles
  FOR INSERT TO authenticated 
  WITH CHECK (public.can_assign_admin_role(auth.uid(), org_unit_id));

-- 8. Update RLS policies for org_units to respect hierarchy
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update org units" ON public.org_units;
DROP POLICY IF EXISTS "Admins can delete org units" ON public.org_units;

CREATE POLICY "Admins can update org units they manage" ON public.org_units 
  FOR UPDATE TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND (
          ur.org_unit_id IS NULL OR -- Super admin
          ur.org_unit_id = public.org_units.id OR -- Own unit
          public.org_units.id = ANY(ur.managed_org_units) -- In managed units
        )
      )
    )
  );

CREATE POLICY "Admins can delete org units they manage" ON public.org_units 
  FOR DELETE TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND (
          ur.org_unit_id IS NULL OR -- Super admin
          ur.org_unit_id = public.org_units.id OR -- Own unit
          public.org_units.id = ANY(ur.managed_org_units) -- In managed units
        )
      )
    )
  );
