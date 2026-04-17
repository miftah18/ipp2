import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, ShieldCheck, ShieldX, User, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canAssignRole,
  getAccessibleOrgUnits,
  validateRoleAssignment,
} from "@/utils/hierarchyPermissions";
import type { OrgUnit, UserWithHierarchy } from "@/utils/hierarchyPermissions";

type AppRole = "admin" | "moderator" | "user";

type UserWithRole = {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: AppRole[];
  org_unit_id: string | null;
  org_unit_name?: string;
  hierarchy_level: number | null;
  managed_org_units: string[] | null;
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "border-primary/50 text-primary",
  moderator: "border-blue-500/50 text-blue-400",
  user: "border-muted-foreground/30 text-muted-foreground",
};

const ManajemenUser = () => {
  const { isAdmin, user: currentUser, orgUnitId, managedOrgUnits, hierarchyLevel } = useAuth();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Fetch semua org units untuk reference
  const { data: orgUnits } = useQuery({
    queryKey: ["org-units"],
    queryFn: async () => {
      const { data } = await supabase
        .from("org_units")
        .select("id, name, type, parent_id, hierarchy_level")
        .order("hierarchy_level", { ascending: true });
      return data || [];
    },
  });

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ["user-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, created_at")
        .order("created_at", { ascending: false });

      if (!profiles) return [];

      const result: UserWithRole[] = await Promise.all(
        profiles.map(async (p) => {
          const { data: userRoleData } = await supabase
            .from("user_roles")
            .select("role, org_unit_id, hierarchy_level, managed_org_units")
            .eq("user_id", p.user_id)
            .single();

          const { data: orgUnitData } = userRoleData?.org_unit_id
            ? await supabase
                .from("org_units")
                .select("name")
                .eq("id", userRoleData.org_unit_id)
                .single()
            : { data: null };

          return {
            user_id: p.user_id,
            email: p.user_id,
            display_name: p.display_name,
            created_at: p.created_at,
            roles: userRoleData?.role ? [userRoleData.role as AppRole] : ([] as AppRole[]),
            org_unit_id: userRoleData?.org_unit_id || null,
            org_unit_name: orgUnitData?.name,
            hierarchy_level: userRoleData?.hierarchy_level || null,
            managed_org_units: userRoleData?.managed_org_units || null,
          };
        })
      );
      return result;
    },
    enabled: isAdmin,
  });

  // Filter users yang bisa diakses oleh current admin
  const accessibleUsers = useMemo(() => {
    if (!isAdmin || !users || !orgUnits) return users || [];

    // Super admin pusat bisa akses semua
    if (hierarchyLevel === 0) {
      return users;
    }

    // Admin level lain hanya bisa akses users di managed org units + child units
    const accessibleOrgUnits = getAccessibleOrgUnits(
      {
        id: currentUser?.id || '',
        email: currentUser?.email || '',
        role: 'admin',
        org_unit_id: orgUnitId,
        managed_org_units: managedOrgUnits,
        hierarchy_level: hierarchyLevel,
      },
      orgUnits as OrgUnit[]
    );
    const accessibleUnitIds = new Set(accessibleOrgUnits.map(ou => ou.id));

    return users.filter(u => {
      if (!u.org_unit_id) return false;
      return accessibleUnitIds.has(u.org_unit_id);
    });
  }, [users, orgUnits, isAdmin, hierarchyLevel, orgUnitId, managedOrgUnits, currentUser?.id, currentUser?.email]);

  const handleSetRole = async (userId: string, newRole: AppRole) => {
    setUpdatingRole(userId);
    try {
      const targetUser = users?.find(u => u.user_id === userId);
      if (!targetUser || !orgUnits) {
        toast({ title: "Gagal", description: "User atau org unit tidak ditemukan", variant: "destructive" });
        return;
      }

      // Validate permission
      const currentUserData: UserWithHierarchy = {
        id: currentUser?.id || '',
        email: currentUser?.email || '',
        role: 'admin',
        org_unit_id: orgUnitId,
        managed_org_units: managedOrgUnits,
        hierarchy_level: hierarchyLevel,
      };

      const targetUserData: UserWithHierarchy = {
        id: targetUser.user_id,
        email: targetUser.email,
        role: targetUser.roles[0] || 'user',
        org_unit_id: targetUser.org_unit_id,
        managed_org_units: targetUser.managed_org_units,
        hierarchy_level: targetUser.hierarchy_level,
      };

      const validation = validateRoleAssignment(
        currentUserData,
        targetUserData,
        newRole,
        orgUnits as OrgUnit[]
      );

      if (!validation.isValid) {
        toast({ title: "Gagal", description: validation.reason, variant: "destructive" });
        return;
      }

      // Update role
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      
      toast({ title: "Berhasil", description: `Role berhasil diubah menjadi ${ROLE_LABELS[newRole]}.` });
      qc.invalidateQueries({ queryKey: ["user-list"] });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingRole(null);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          <ShieldX className="size-12 mx-auto mb-4 opacity-30" />
          <p>Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Administrasi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Manajemen User</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>

        {/* Role Legend */}
        <div className="flex flex-wrap gap-3">
          {(["admin", "moderator", "user"] as AppRole[]).map((r) => (
            <div key={r} className="flex items-center gap-2 text-xs text-muted-foreground">
              {r === "admin" && <ShieldCheck className="size-3.5 text-primary" />}
              {r === "moderator" && <Shield className="size-3.5 text-blue-400" />}
              {r === "user" && <User className="size-3.5" />}
              <span className="capitalize">{ROLE_LABELS[r]}</span>
              <span className="text-muted-foreground/50">—</span>
              <span className="text-[10px]">
                {r === "admin" ? "Akses penuh CRUD" : r === "moderator" ? "Bisa edit, tidak bisa hapus" : "Read-only"}
              </span>
            </div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pengguna</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Terdaftar</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Role Saat Ini</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-right">Ubah Role</th>
                </tr>
              </thead>
              <tbody>
                {(accessibleUsers ?? []).map((u) => {
                  const isCurrentUser = u.user_id === currentUser?.id;
                  const currentRole: AppRole = u.roles[0] || "user";
                  const isUpdating = updatingRole === u.user_id;

                  return (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                              {(u.display_name ?? u.user_id).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {u.display_name ?? "—"}
                              {isCurrentUser && <span className="ml-2 text-[10px] text-primary font-normal">(Anda)</span>}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">{u.user_id}</p>
                            {u.org_unit_name && (
                              <p className="text-[9px] text-muted-foreground">Unit: {u.org_unit_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(u.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={`text-[10px] uppercase ${ROLE_COLORS[currentRole]}`}>
                            {ROLE_LABELS[currentRole]}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={currentRole}
                            onValueChange={(v: AppRole) => handleSetRole(u.user_id, v)}
                            disabled={isCurrentUser || isUpdating}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>
                          {isUpdating && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isLoading && <div className="p-12 text-center text-muted-foreground text-sm">Memuat data pengguna...</div>}
          {!isLoading && accessibleUsers?.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">
              {users?.length === 0 ? "Belum ada pengguna terdaftar." : "Tidak ada pengguna di unit organisasi yang Anda kelola."}
            </div>
          )}
        </motion.div>

        {hierarchyLevel !== 0 && (
          <div className="flex gap-2 text-xs text-amber-600/80 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p>
              Anda dapat mengelola {accessibleUsers?.length ?? 0} pengguna di unit organisasi Anda dan unit di bawahnya.
              Untuk mengubah role admin/moderator, hubungi admin unit di atasnya.
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Total {accessibleUsers?.length ?? 0} pengguna dapat dikelola. Perubahan role berlaku segera setelah user melakukan refresh atau login ulang.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default ManajemenUser;
