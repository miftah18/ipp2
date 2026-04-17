# Quick Start - Hierarchical Admin System

## Ringkas: 3 Langkah Setup

### 1️⃣ Execute SQL Migration (5 menit)

Buka Supabase Dashboard → SQL Editor → Copy-paste & Run:
```
File: supabase/migrations/20260417_add_hierarchical_admin.sql
```

### 2️⃣ Setup Initial Data (5 menit)

```sql
-- 1. Create pusat (root org unit)
INSERT INTO public.org_units (name, type)
VALUES ('Pengurus Pusat', 'pusat');

-- 2. Create wilayah/regional units
INSERT INTO public.org_units (name, type, parent_id)
SELECT 'Wilayah [Name]', 'wilayah', id 
FROM public.org_units WHERE type = 'pusat';

-- 3. Assign super admin to pusat
UPDATE public.user_roles 
SET role = 'admin', org_unit_id = NULL
WHERE user_id = 'SUPER_ADMIN_ID';

-- 4. Verify
SELECT ur.user_id, ur.role, ou.name as unit
FROM public.user_roles ur
LEFT JOIN public.org_units ou ON ur.org_unit_id = ou.id;
```

### 3️⃣ Test & Deploy

- Application code sudah ready
- Test di preview/local
- Deploy to Vercel

## Apa yang Sudah Jadi

### Database
- ✅ Migration SQL siap di `supabase/migrations/`
- ✅ Kolom hierarchy di org_units & user_roles
- ✅ Permission functions di Supabase
- ✅ RLS policies untuk enforce permissions

### Application Code
- ✅ `hierarchyPermissions.ts` - Permission utilities
- ✅ `AuthContext.tsx` - Enhanced dengan hierarchy data
- ✅ `ManajemenUser.tsx` - User management dengan filters
- ✅ `StrukturOrganisasi.tsx` - Org structure dengan filters
- ✅ Form dialogs dengan validation
- ✅ API routes untuk backend validation

## Key Features

| Feature | Support |
|---------|---------|
| Hierarki Bertingkat | ✅ Pusat → Wilayah → Kabupaten → Kecamatan → Ranting |
| Admin Per-Level | ✅ Setiap level punya admin sendiri |
| Permission Enforcement | ✅ Admin hanya manage dibawah mereka |
| Role Assignment Control | ✅ Hanya parent admin + super admin |
| Multi-Unit Admin | ✅ Admin bisa manage multiple units |
| Moderator Hierarchy | ✅ Moderator juga terikat ke unit |
| User Filtering | ✅ Admin lihat users di unit mereka |
| Org Unit Filtering | ✅ Admin lihat org units di unit mereka |

## File Structure

```
/vercel/share/v0-project/
├── supabase/migrations/
│   └── 20260417_add_hierarchical_admin.sql    ← Execute this
├── src/
│   ├── utils/
│   │   └── hierarchyPermissions.ts            ✅ Ready
│   ├── contexts/
│   │   └── AuthContext.tsx                    ✅ Enhanced
│   ├── pages/
│   │   ├── ManajemenUser.tsx                  ✅ Updated
│   │   └── StrukturOrganisasi.tsx             ✅ Updated
│   ├── components/dashboard/
│   │   └── OrgUnitFormDialog.tsx              ✅ Updated
│   └── pages/api/
│       ├── users/
│       │   └── validate-role-assignment.ts    ✅ Created
│       └── org-units/
│           └── validate-creation.ts           ✅ Created
├── scripts/
│   ├── verify-setup.js                         Optional verification
│   ├── run-migration.js                        Optional runner
│   └── execute-migration.js                    Optional executor
├── SUPABASE_MIGRATION_GUIDE.md                 Detailed guide
├── HIERARCHY_IMPLEMENTATION.md                 Technical docs
└── QUICK_START.md                              This file
```

## Command Reference

```bash
# Verify setup (after migration)
node --env-file-if-exists=/vercel/share/.env.project scripts/verify-setup.js

# Start dev server
npm run dev

# Build
npm run build
```

## Common Tasks

### Add New Wilayah
```sql
INSERT INTO public.org_units (name, type, parent_id)
VALUES ('Wilayah [Name]', 'wilayah', (SELECT id FROM public.org_units WHERE type = 'pusat'));
```

### Assign Regional Admin
```sql
UPDATE public.user_roles 
SET role = 'admin', org_unit_id = (SELECT id FROM public.org_units WHERE name = 'Wilayah X')
WHERE user_id = 'USER_ID';
```

### Check Permissions
```sql
-- Who can manage whom?
SELECT ur1.user_id as admin_user,
       ur2.user_id as target_user,
       public.can_manage_user(ur1.user_id, ur2.user_id) as can_manage
FROM public.user_roles ur1
CROSS JOIN public.user_roles ur2
WHERE ur1.role = 'admin' LIMIT 10;
```

## Support & Docs

- **Detailed Guide**: `SUPABASE_MIGRATION_GUIDE.md`
- **Technical Docs**: `HIERARCHY_IMPLEMENTATION.md`
- **Utilities**: `src/utils/hierarchyPermissions.ts`
- **Database Schema**: See files above
- **Permission Logic**: See utility functions + RLS policies

---

**Status**: ✅ Ready for Production
**Last Updated**: 2025-04-17
