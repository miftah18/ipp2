# Supabase Migration Guide - Hierarchical Admin System

## Overview
Sistem admin hierarki sudah siap diimplementasikan di Supabase Anda. Panduan ini menjelaskan langkah-langkah untuk apply migration dan setup awal.

## Step-by-Step Setup

### 1. Execute Migration SQL di Supabase SQL Editor

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Masuk ke **SQL Editor** (atau **SQL** di sidebar)
4. Buat query baru dengan klik **+ New Query**
5. Copy-paste seluruh SQL dari file: `supabase/migrations/20260417_add_hierarchical_admin.sql`
6. Klik **Run** untuk execute

### 2. Verifikasi Migration Berhasil

Setelah SQL selesai execute, verifikasi dengan menjalankan queries ini di SQL Editor:

```sql
-- Check org_units columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'org_units' 
ORDER BY ordinal_position;

-- Check user_roles columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- Check functions created
SELECT routinename 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public'
AND (routinename LIKE 'get_descendants%' 
  OR routinename LIKE 'can_manage%'
  OR routinename LIKE 'can_assign%');

-- Check views
SELECT table_name 
FROM information_schema.tables 
WHERE table_type = 'VIEW' 
AND table_schema = 'public'
AND table_name = 'hierarchy_info';
```

**Expected Results:**
- `org_units` harus punya kolom `hierarchy_level` (int)
- `user_roles` harus punya kolom `org_unit_id` (uuid), `managed_org_units` (uuid[])
- 3 functions harus ada: `get_descendants`, `can_manage_user`, `can_assign_admin_role`
- View `hierarchy_info` harus ada

### 3. Verify Scripts (Optional)

Jika ingin automatic verification, jalankan script:

```bash
cd /vercel/share/v0-project
node --env-file-if-exists=/vercel/share/.env.project scripts/verify-setup.js
```

### 4. Initial Data Setup

Jika belum punya data org_units, setup struktur organisasi dasar:

```sql
-- Insert pusat (hierarchy_level akan auto-calculated oleh trigger jika ada)
INSERT INTO public.org_units (name, type, parent_id)
VALUES ('Pengurus Pusat', 'pusat', NULL);

-- Get the pusat ID (replace with actual ID)
SELECT id FROM public.org_units WHERE type = 'pusat' LIMIT 1;

-- Insert wilayah (replace PUSAT_ID dengan actual ID)
INSERT INTO public.org_units (name, type, parent_id)
VALUES 
  ('Wilayah Jawa Barat', 'wilayah', 'PUSAT_ID'),
  ('Wilayah Jawa Timur', 'wilayah', 'PUSAT_ID'),
  ('Wilayah Sumatera', 'wilayah', 'PUSAT_ID');

-- Check inserted data
SELECT id, name, type, parent_id, hierarchy_level FROM public.org_units ORDER BY hierarchy_level;
```

### 5. Assign Admin to Org Units

Untuk user yang sudah ada, assign admin role dengan org_unit:

```sql
-- Find existing users first
SELECT user_id, email FROM public.user_roles LIMIT 5;

-- Update super admin (no org_unit_id = super admin pusat)
UPDATE public.user_roles 
SET role = 'admin', org_unit_id = NULL
WHERE user_id = 'YOUR_SUPER_ADMIN_USER_ID';

-- Assign regional admin (replace with actual IDs)
UPDATE public.user_roles 
SET role = 'admin', org_unit_id = 'WILAYAH_ID'
WHERE user_id = 'REGIONAL_ADMIN_USER_ID';

-- Verify assignments
SELECT ur.user_id, ur.role, ou.name as org_unit_name, ou.type
FROM public.user_roles ur
LEFT JOIN public.org_units ou ON ur.org_unit_id = ou.id
WHERE ur.role IN ('admin', 'moderator');
```

## Key Features Implemented

✅ **Hierarchical Structure:** Pusat → Wilayah → Kabupaten → Kecamatan → Ranting
✅ **Automatic Hierarchy Level Calculation** (dapat diimplementasikan via trigger)
✅ **Permission Functions:** can_manage_user, can_assign_admin_role, get_descendants
✅ **RLS Policies:** Enforce permissions di database level
✅ **Hierarchy View:** hierarchy_info untuk mudah check permissions

## Database Schema

### org_units table
```
- id (uuid, pk)
- name (text)
- type (text: pusat, wilayah, kabupaten, kecamatan, ranting)
- parent_id (uuid, fk to org_units)
- hierarchy_level (int) - Auto-calculated berdasarkan parent-child
- deskripsi, alamat, email, telepon (text)
```

### user_roles table
```
- user_id (uuid, pk, fk to auth.users)
- role (app_role: admin, moderator, user)
- org_unit_id (uuid, fk to org_units) - NULL = super admin pusat
- managed_org_units (uuid[]) - Array of unit IDs yang bisa dikelola
- hierarchy_level (int) - Mirrored dari org_units
```

## Application Code

Semua application code sudah siap:
- ✅ `src/utils/hierarchyPermissions.ts` - Authorization utilities
- ✅ `src/contexts/AuthContext.tsx` - Enhanced dengan hierarchy data
- ✅ `src/pages/ManajemenUser.tsx` - User management dengan filters
- ✅ `src/pages/StrukturOrganisasi.tsx` - Org structure dengan filters
- ✅ `src/components/dashboard/OrgUnitFormDialog.tsx` - Form dengan validation
- ✅ API routes untuk backend validation

## Troubleshooting

### "Function does not exist" error
- Pastikan sudah execute seluruh SQL migration
- Cek apakah functions dibuat di schema `public`

### "Column does not exist" error
- Verify bahwa migration sudah dijalankan dengan cek columns di SQL Editor
- Jalankan kembali ALTER TABLE statements

### RLS Policy errors
- Pastikan Anda login dengan user yang punya role admin
- Check RLS policies di table settings

## Next Steps

1. ✅ Execute SQL migration di Supabase
2. ✅ Verify schema dengan verification queries
3. ✅ Setup initial org_units data
4. ✅ Assign admins ke org units
5. Test aplikasi: create users, assign roles, manage org units
6. Monitor RLS policies enforcement

## Additional Notes

- Migration file tersimpan di: `supabase/migrations/20260417_add_hierarchical_admin.sql`
- Verification script ada di: `scripts/verify-setup.js`
- Migration runner script ada di: `scripts/run-migration.js`
- Dokumentasi lengkap ada di: `HIERARCHY_IMPLEMENTATION.md`

Untuk pertanyaan atau issues, lihat `HIERARCHY_IMPLEMENTATION.md` untuk detail teknis lengkap.
