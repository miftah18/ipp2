import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, ShieldCheck, ShieldX, User, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
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

type AppRole = "admin" | "moderator" | "user";

type UserWithRole = {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: AppRole[];
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
  const { isAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<UserWithRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

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
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", p.user_id);

          return {
            user_id: p.user_id,
            email: p.user_id, // will show user_id as fallback since we can't read auth.users directly
            display_name: p.display_name,
            created_at: p.created_at,
            roles: (roleRows?.map((r) => r.role) ?? []) as AppRole[],
          };
        })
      );
      return result;
    },
    enabled: isAdmin,
  });

  const handleRoleChange = async (userId: string, role: AppRole, action: "add" | "remove") => {
    setUpdatingRole(userId + role);
    try {
      if (action === "add") {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
        toast({ title: "Berhasil", description: `Role ${ROLE_LABELS[role]} berhasil ditambahkan.` });
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
        toast({ title: "Berhasil", description: `Role ${ROLE_LABELS[role]} berhasil dihapus.` });
      }
      qc.invalidateQueries({ queryKey: ["user-list"] });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleSetRole = async (userId: string, newRole: AppRole) => {
    setUpdatingRole(userId);
    try {
      // Remove all roles first, then add the new one
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
                {(users ?? []).map((u) => {
                  const isCurrentUser = u.user_id === currentUser?.id;
                  const currentRole: AppRole = u.roles.includes("admin")
                    ? "admin"
                    : u.roles.includes("moderator")
                    ? "moderator"
                    : "user";
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
                          {u.roles.length === 0 ? (
                            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">User</Badge>
                          ) : (
                            u.roles.map((r) => (
                              <Badge key={r} variant="outline" className={`text-[10px] uppercase ${ROLE_COLORS[r]}`}>
                                {ROLE_LABELS[r]}
                              </Badge>
                            ))
                          )}
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
          {!isLoading && users?.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">Belum ada pengguna terdaftar.</div>
          )}
        </motion.div>

        <p className="text-[11px] text-muted-foreground">
          Total {users?.length ?? 0} pengguna terdaftar. Perubahan role berlaku segera setelah user melakukan refresh atau login ulang.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default ManajemenUser;
