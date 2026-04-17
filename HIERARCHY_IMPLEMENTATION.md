# Hierarchical Admin System Implementation

## Overview

Sistem admin hierarki telah diimplementasikan untuk memungkinkan setiap level organisasi memiliki admin sendiri yang dapat mengelola unit dibawahnya, namun tidak dapat mengelola unit diatasnya.

## Struktur Organisasi

Hierarki organisasi terdiri dari 5 level:

1. **Pusat** (Level 0) - Root level, hanya satu unit
2. **Wilayah** (Level 1) - Anak dari Pusat
3. **Kabupaten** (Level 2) - Anak dari Wilayah
4. **Kecamatan** (Level 3) - Anak dari Kabupaten
5. **Ranting** (Level 4) - Anak dari Kecamatan

## Database Schema Changes

### Migration: `20260417_add_hierarchical_admin.sql`

Perubahan utama pada database:

1. **org_units table:**
   - Added: `hierarchy_level` (integer) - Level hierarki otomatis dari struktur parent-child
   - Renamed: `level` → `type`, `nama` → `name`

2. **user_roles table:**
   - Added: `org_unit_id` (UUID, nullable) - Unit organisasi yang dikaitkan dengan user
   - Added: `managed_org_units` (JSONB array, nullable) - Array dari org_unit_id yang bisa dikelola admin
   - Added: `hierarchy_level` (integer, nullable) - Level hierarki dari org unit yang dikaitkan

3. **New Functions:**
   - `update_hierarchy_levels()` - Trigger untuk auto-calculate hierarchy_level saat org unit dibuat/diubah
   - `get_descendants()` - Recursive function untuk mendapatkan semua descendant dari suatu unit

## Authorization System

### Permission Rules

#### Admin Permissions
- **Super Admin (Level 0):** Dapat mengelola semua unit organisasi dan user di seluruh sistem
- **Regional Admin (Level > 0):** 
  - Dapat mengelola unit organisasi yang dikaitkan dengan `managed_org_units` array
  - Dapat mengelola unit-unit anak dari unit yang dikelola
  - TIDAK dapat mengelola unit di atas level mereka
  - TIDAK dapat mengelola unit di cabang organisasi lain (sibling units)

#### Moderator Permissions
- Moderator juga mengikuti hierarki (terikat ke satu unit organisasi)
- Dapat berperan dalam unit mereka dan descendant mereka
- Terbatas pada fungsi moderasi, tidak dapat mengelola struktur organisasi

#### User Permissions
- User reguler tanpa role admin/moderator
- Hanya dapat melihat unit organisasi mereka sendiri

### Core Functions (utils/hierarchyPermissions.ts)

1. **canManageOrgUnit()**
   - Checks apakah user bisa manage org unit tertentu
   - Validates hierarchy relationship

2. **canAssignRole()**
   - Checks apakah user bisa assign role ke user lain
   - Only parent admin + super admin pusat bisa assign admin/moderator roles

3. **getAccessibleOrgUnits()**
   - Returns list org units yang bisa diakses oleh user
   - Super admin dapat akses semua, admin regional dapat akses managed units + descendants

4. **getManageableUsers()**
   - Returns list users yang bisa dikelola oleh current user
   - Filter berdasarkan accessible org units

5. **validateRoleAssignment()**
   - Comprehensive validation untuk role assignment
   - Checks permission, checks apakah user terkait org unit, dll

## Component Updates

### AuthContext (contexts/AuthContext.tsx)

Enhanced dengan data hierarki:

```typescript
interface AuthContextType {
  // ... existing fields
  userRole: UserRole | null;          // 'admin' | 'moderator' | 'user'
  orgUnitId: string | null;           // Org unit yang dikaitkan user
  managedOrgUnits: string[] | null;   // Array org units yang bisa dikelola
  hierarchyLevel: number | null;      // Level hierarki
}
```

Data ini di-load dari `user_roles` table saat user login.

### ManajemenUser.tsx

**Perubahan:**
- Filter users berdasarkan `accessibleOrgUnits` - hanya menampilkan users yang ada di unit yang bisa dikelola
- Tampilkan org unit name di user list
- Validate role assignment menggunakan `validateRoleAssignment()` sebelum update
- Info banner untuk admin non-pusat tentang batasan permission mereka

**Key Features:**
- Super admin pusat dapat manage semua users
- Regional admin hanya dapat manage users di managed units + descendants
- Admin tidak bisa change role admin/moderator dari unit di atas mereka

### StrukturOrganisasi.tsx

**Perubahan:**
- Filter org units berdasarkan `accessibleUnits`
- Hanya menampilkan wilayah/kabupaten/dll yang bisa dikelola
- Disable edit/delete buttons untuk units yang tidak bisa diakses
- Info banner menjelaskan limitation untuk admin non-pusat
- Renamed: "provinsi" → "wilayah" (sesuai dengan terminology baru)

### OrgUnitFormDialog.tsx

**Perubahan:**
- Updated field names: `nama` → `name`, `level` → `type`
- Added permission check sebelum create/edit org unit
- Hanya parent admin + super admin pusat bisa manage org units
- Validate parent org unit management sebelum create sub-unit

## API Routes

### POST /api/users/validate-role-assignment

Validate role assignment dengan permission checking di backend.

**Request:**
```json
{
  "currentUserId": "uuid",
  "targetUserId": "uuid",
  "newRole": "admin" | "moderator" | "user"
}
```

**Response:**
```json
{
  "isValid": true/false,
  "reason": "explanation"
}
```

### POST /api/org-units/validate-creation

Validate org unit creation/edit dengan permission checking di backend.

**Request:**
```json
{
  "userId": "uuid",
  "parentOrgUnitId": "uuid",      // untuk create
  "isEdit": false/true,
  "orgUnitId": "uuid"             // untuk edit
}
```

**Response:**
```json
{
  "isValid": true/false,
  "reason": "explanation"
}
```

## Usage Examples

### Super Admin (Level 0)

```typescript
// Super admin dapat akses semua org units
const accessible = getAccessibleOrgUnits(superAdminUser, allOrgUnits);
// Result: all org units

// Super admin dapat assign role ke siapa saja
const canAssign = canAssignRole(superAdminUser, targetUser, 'admin', allOrgUnits);
// Result: true (untuk semua users)
```

### Regional Admin (Wilayah)

```typescript
// Admin Wilayah "Jawa Barat" dapat akses:
// - Wilayah "Jawa Barat"
// - Semua Kabupaten di Jawa Barat
// - Semua Kecamatan di Kabupaten-kabupaten tersebut
// - Semua Ranting di Kecamatan-kecamatan tersebut
const accessible = getAccessibleOrgUnits(wilayahAdmin, allOrgUnits);

// Admin Wilayah TIDAK dapat:
// - Edit Wilayah level (hanya bisa edit Wilayah yang dikaitkan)
// - Manage Kabupaten dari Wilayah lain
// - Assign role admin untuk Wilayah level (hanya parent pusat bisa)
const canAssignToWilayah = canAssignRole(wilayahAdmin, newWilayahAdmin, 'admin', allOrgUnits);
// Result: false (hanya super admin pusat yang bisa)

// Tapi bisa assign role admin untuk Kabupaten di bawahnya
const canAssignToKabupaten = canAssignRole(wilayahAdmin, newKabupatenAdmin, 'admin', allOrgUnits);
// Result: true (parent admin dapat assign ke child level)
```

### Moderator (Level Kecamatan)

```typescript
// Moderator Kecamatan "Bandung" dapat akses:
// - Kecamatan "Bandung"
// - Semua Ranting di Kecamatan "Bandung"
const accessible = getAccessibleOrgUnits(kecamatanModerator, allOrgUnits);

// TIDAK dapat:
// - Assign roles (moderator role tidak boleh assign role)
// - Manage org units (moderator role read-only untuk struktur organisasi)
const canAssign = canAssignRole(kecamatanModerator, targetUser, 'user', allOrgUnits);
// Result: false (moderator tidak bisa assign roles)
```

## Key Features

1. **Multi-level Admin Structure:**
   - Each organizational level dapat memiliki admin dedicated
   - Admin fokus pada management di level mereka dan di bawah

2. **Hierarchical Role Assignment:**
   - Only parent admin + super admin pusat yang bisa assign admin/moderator roles
   - Prevents unauthorized privilege escalation

3. **Automatic Hierarchy Level Calculation:**
   - Hierarchy level otomatis di-calculate berdasarkan parent-child relationships
   - Trigger database menjaga consistency

4. **Flexible Unit Management:**
   - Admin dapat manage multiple units (tidak harus satu per admin)
   - Useful untuk expansion atau reorganization

5. **Comprehensive Permission Validation:**
   - Frontend validation menggunakan utility functions
   - Backend validation di API routes sebagai security layer
   - Double-layer protection untuk data integrity

## Migration Guide

Jika sudah ada users dengan role 'admin', Anda perlu:

1. **Assign org units:**
   - Tentukan unit organisasi mana yang dipegang oleh setiap admin
   - Update `org_unit_id` di `user_roles` table

2. **Set managed units:**
   - Untuk admin multi-unit, update `managed_org_units` JSON array
   - Misal: `["unit-id-1", "unit-id-2"]`

3. **Validate hierarchy levels:**
   - Run trigger untuk update semua `hierarchy_level` values
   - Trigger sudah otomatis saat org unit dibuat/diubah

```sql
-- Example: Assign admin untuk Wilayah Jawa Barat
UPDATE user_roles 
SET org_unit_id = 'wilayah-jawa-barat-id',
    managed_org_units = '["wilayah-jawa-barat-id"]'::jsonb,
    hierarchy_level = 1
WHERE user_id = 'admin-user-id';
```

## Testing

### Test Cases

1. **Super Admin Access:**
   - Create super admin (level 0)
   - Verify dapat akses semua units
   - Verify dapat assign role ke siapa saja

2. **Regional Admin Restrictions:**
   - Create regional admin untuk satu wilayah
   - Verify hanya bisa akses units di wilayah tsb + descendants
   - Verify TIDAK bisa edit wilayah level
   - Verify TIDAK bisa assign admin role ke wilayah level

3. **Moderator Hierarchy:**
   - Create moderator di level kecamatan
   - Verify dapat akses kecamatan + ranting
   - Verify TIDAK bisa assign roles
   - Verify TIDAK bisa manage org units

4. **User Isolation:**
   - Create user tanpa role
   - Verify hanya lihat unit mereka sendiri
   - Verify TIDAK bisa lihat/manage org units

5. **Permission Edge Cases:**
   - Non-admin trying to manage units → denied
   - Admin trying to manage sibling units → denied
   - Admin trying to manage parent units → denied
   - Parent admin assigning child admin → allowed
   - Child admin assigning grandchild admin → allowed

## Troubleshooting

### Issue: User dapat akses units yang seharusnya tidak bisa

**Solution:**
- Check `managed_org_units` array di `user_roles`
- Verify `hierarchy_level` correct
- Run trigger untuk recalculate hierarchy levels

### Issue: Admin tidak bisa create sub-unit

**Solution:**
- Check apakah parent unit ada di `managed_org_units`
- Verify hierarchy relationship di database
- Check error message untuk detail permission issue

### Issue: Role change tidak langsung terlihat

**Solution:**
- AuthContext di-load saat login, perubahan perlu refresh
- User perlu refresh browser atau login ulang
- Atau implementasikan real-time update dengan Supabase subscriptions

## Future Enhancements

1. **Real-time Permissions:**
   - Implement Supabase subscriptions untuk update permission changes
   - No need manual refresh

2. **Advanced Delegation:**
   - Allow temporary delegation of permissions
   - Time-bounded admin access

3. **Audit Logging:**
   - Track semua permission-related changes
   - Useful untuk compliance dan debugging

4. **Bulk Operations:**
   - Allow super admin untuk bulk assign roles/units
   - Improve management efficiency

5. **Permission Templates:**
   - Pre-defined permission sets untuk common roles
   - Simplify admin creation process
