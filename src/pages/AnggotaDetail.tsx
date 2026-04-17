import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Phone, Building2, Pencil, Calendar, Award } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { AnggotaFormDialog } from "@/components/dashboard/AnggotaFormDialog";

const AnggotaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [formOpen, setFormOpen] = useState(false);

  const { data: anggota, isLoading } = useQuery({
    queryKey: ["anggota-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("anggota")
        .select("*, org_units(id, nama, level, alamat, email, telepon)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: bphHistory } = useQuery({
    queryKey: ["anggota-bph-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bph")
        .select("*, org_units(nama, level)")
        .eq("anggota_id", id!)
        .order("periode_akhir", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Memuat data anggota...</div>
      </DashboardLayout>
    );
  }

  if (!anggota) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Anggota tidak ditemukan.</div>
      </DashboardLayout>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const initials = anggota.nama.split(" ").map((n: string) => n[0]).slice(0, 2).join("");

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/anggota")} className="shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Profil Anggota</p>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{anggota.nama}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-xl p-6 space-y-5">
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="size-20">
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold text-foreground">{anggota.nama}</h2>
                <p className="text-sm text-muted-foreground">{anggota.role || "—"}</p>
              </div>
              {anggota.status === "aktif" ? (
                <Badge variant="outline" className="border-success/50 text-success text-[10px] font-bold uppercase">Aktif</Badge>
              ) : (
                <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px] font-bold uppercase">Nonaktif</Badge>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              {anggota.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground break-all">{anggota.email}</span>
                </div>
              )}
              {anggota.telepon && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground font-mono">{anggota.telepon}</span>
                </div>
              )}
              {anggota.org_units && (
                <div className="flex items-start gap-3 text-sm">
                  <Building2 className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground">{anggota.org_units.nama}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{anggota.org_units.level}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Terdaftar</p>
                  <p className="text-foreground font-mono text-xs">
                    {new Date(anggota.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <Button className="w-full gap-2" variant="outline" onClick={() => setFormOpen(true)}>
                <Pencil className="size-3.5" />
                Edit Profil
              </Button>
            )}
          </motion.div>

          {/* BPH History */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 glass-surface rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2">
              <Award className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Riwayat Kepengurusan BPH</h2>
            </div>
            <div className="p-5">
              {!bphHistory || bphHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Belum pernah menjabat di BPH.</div>
              ) : (
                <div className="space-y-3">
                  {bphHistory.map((b, i) => {
                    const isActive = b.periode_akhir >= today;
                    return (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-4 p-4 rounded-lg bg-secondary/40 border border-border"
                      >
                        <div className={`size-2.5 rounded-full mt-1.5 shrink-0 ${isActive ? "bg-success" : "bg-muted-foreground/40"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{b.jabatan}</p>
                              <p className="text-xs text-muted-foreground">{b.org_units?.nama} <span className="capitalize text-[10px]">({b.org_units?.level})</span></p>
                            </div>
                            {isActive ? (
                              <Badge variant="outline" className="border-success/50 text-success text-[10px] shrink-0">Aktif</Badge>
                            ) : (
                              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] shrink-0">Selesai</Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground mt-1">
                            {b.periode_awal} — {b.periode_akhir}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <AnggotaFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editData={anggota as any}
      />
    </DashboardLayout>
  );
};

export default AnggotaDetail;
