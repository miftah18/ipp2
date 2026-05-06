# 🚀 Setup Instruksi - Sistem Admin Hierarki

## Status: Migration SQL Sudah Siap

Semua code untuk sistem admin hierarki sudah siap. Sekarang Anda tinggal execute SQL migration ke Supabase.

---

## Step 1: Execute SQL Migration di Supabase Dashboard

### Metode A: Via Supabase SQL Editor (Recommended - 2 menit)

1. **Buka Supabase Dashboard**
   - Kunjungi: https://supabase.com/dashboard
   - Pilih project Anda

2. **Buka SQL Editor**
   - Klik tab **"SQL Editor"** di sidebar kiri
   - Klik tombol **"New Query"**

3. **Copy-Paste SQL Migration**
   - Buka file: `supabase/migrations/20260417_add_hierarchical_admin.sql`
   - Copy seluruh isi file
   - Paste ke SQL Editor di Supabase

4. **Execute Query**
   - Klik tombol **"Run"** (atau Cmd+Enter)
   - Tunggu hingga selesai (seharusnya 30-60 detik)
   - Anda akan melihat pesan sukses di bagian Results

5. **Verify Migration**
   ```sql
   -- Run this to verify:
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'user_roles' 
   ORDER BY ordinal_position;
   ```
   Anda seharusnya melihat kolom baru: `org_unit_id`, `managed_org_units`

---

### Metode B: Via `psql` Command (Jika Anda familiar dengan CLI)

```bash
# Install psql jika belum ada
# macOS: brew install libpq
# Ubuntu/Debian: sudo apt-get install postgresql-client
# Windows: Download dari https://www.postgresql.org/download/windows/

# Execute migration
psql -h <YOUR_POSTGRES_HOST> \
     -U postgres \
     -d postgres \
     -f supabase/migrations/20260417_add_hierarchical_admin.sql
```

Dapatkan `YOUR_POSTGRES_HOST` dari Supabase Dashboard:
- Settings → Database → Connection String (lihat bagian "Host")

---

## Step 2: Verify Database Schema

Setelah migration sukses, verify bahwa schema sudah benar:

### Check user_roles table
```sql
\d user_roles
```

Should show columns:
- `org_unit_id` (UUID, nullable)
- `managed_org_units` (UUID[], array)
- `hierarchy_level` (INT)

### Check functions created
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('get_descendants', 'can_manage_user', 'can_assign_admin_role');
```

Should return 3 rows

### Check views created
```sql
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' AND table_name = 'hierarchy_info';
```

Should return 1 row

---

## Step 3: Setup Initial Admin Data (Optional)

Jika Anda belum memiliki super admin, jalankan:

```sql
-- Find your user ID dari Auth users
SELECT id, email FROM auth.users LIMIT 5;

-- Update your user to be super admin
-- Replace 'YOUR_USER_ID' dengan actual UUID dari hasil di atas
UPDATE public.user_roles 
SET role = 'admin', org_unit_id = NULL, hierarchy_level = 0
WHERE user_id = 'YOUR_USER_ID';

-- If user_roles entry doesn't exist, create it:
INSERT INTO public.user_roles (user_id, role, hierarchy_level)
VALUES ('YOUR_USER_ID', 'admin', 0)
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin', hierarchy_level = 0;
```

---

## Step 4: Test Application

1. **Start dev server**
   ```bash
   npm run dev
   ```

2. **Login dengan super admin account**
   - Seharusnya Anda lihat AuthContext loaded dengan `hierarchyLevel = 0`
   - Seharusnya Anda bisa akses Struktur Organisasi dan Manajemen User

3. **Check Console**
   ```javascript
   // Di browser DevTools Console, Anda seharusnya bisa jalankan:
   localStorage.setItem('debug', 'v0');
   // Then reload dan lihat logs di console
   ```

---

## Files Sudah Dibuat

### Core Application Code
- ✅ `src/utils/hierarchyPermissions.ts` - Permission checking functions
- ✅ `src/contexts/AuthContext.tsx` - Enhanced dengan hierarchy data
- ✅ `src/pages/ManajemenUser.tsx` - User management dengan permission filtering
- ✅ `src/pages/StrukturOrganisasi.tsx` - Org structure dengan permission filtering
- ✅ `src/components/dashboard/OrgUnitFormDialog.tsx` - Form dengan permission validation
- ✅ `src/pages/api/users/validate-role-assignment.ts` - Backend validation
- ✅ `src/pages/api/org-units/validate-creation.ts` - Backend validation

### Database
- ✅ `supabase/migrations/20260417_add_hierarchical_admin.sql` - Migration file

### Documentation
- ✅ `HIERARCHY_IMPLEMENTATION.md` - Technical documentation
- ✅ `QUICK_START.md` - Quick setup guide
- ✅ `SUPABASE_MIGRATION_GUIDE.md` - Detailed migration guide
- ✅ `EXECUTE_MIGRATION.txt` - Visual step-by-step guide

---

## Troubleshooting

### Error: "Column 'org_unit_id' does not exist"
→ Migration belum di-execute. Jalankan Step 1 terlebih dahulu.

### Error: "Function 'can_manage_user' does not exist"
→ Ada bagian dari migration yang failed. Check SQL Editor Results untuk error message.
→ Pastikan Anda menggunakan Super Admin role di Supabase untuk run migration.

### Error: "Permission denied for schema public"
→ Supabase user Anda mungkin tidak punya privilege cukup. 
→ Gunakan Service Role Key atau Super Admin account untuk execute migration.

### AuthContext tidak load org_unit_id
→ Check console.log di AuthContext.tsx untuk error messages
→ Verify kolom `org_unit_id` exists di database

---

## Next Steps (Jika sudah done dengan Setup)

1. ✅ Execute SQL migration
2. ✅ Verify schema dengan SQL queries di atas
3. ⬜ Setup initial super admin (optional)
4. ⬜ Test application with `npm run dev`
5. ⬜ Deploy ke Vercel dengan `git push`

---

## Useful SQL Queries untuk Testing

```sql
-- Check current admin assignments
SELECT ur.user_id, ur.role, ou.name, ur.hierarchy_level 
FROM public.user_roles ur
LEFT JOIN public.org_units ou ON ur.org_unit_id = ou.id
WHERE ur.role IN ('admin', 'moderator')
ORDER BY ur.hierarchy_level;

-- Check organization hierarchy
SELECT id, name, type, parent_id, hierarchy_level
FROM public.org_units
ORDER BY hierarchy_level, name;

-- Check managed units for an admin
SELECT user_id, managed_org_units 
FROM public.user_roles 
WHERE role = 'admin' AND managed_org_units IS NOT NULL;
```

---

## Support

Jika ada pertanyaan atau masalah:
1. Check console logs di browser DevTools
2. Check Supabase dashboard untuk error messages
3. Verify environment variables di Vercel project settings
4. Review HIERARCHY_IMPLEMENTATION.md untuk technical details

Selamat! 🎉
