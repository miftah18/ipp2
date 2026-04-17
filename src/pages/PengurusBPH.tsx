import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BPHFormDialog } from "@/components/dashboard/BPHFormDialog";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { toast } from "@/components/ui/use-toast";

type BPHItem = {
  id: string;
  jabatan: string;
  periode_awal: string;
  periode_akhir: string;
  anggota_id: string;
  org_unit_id: string;
  anggota?: { nama: string } | null;
  org_units?: { nama: string; level: string } | null;
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const PengurusBPH = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BPHItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BPHItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: bphGroups, isLoading, data: rawBph } = useQuery({
    queryKey: ["bph-grouped"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bph")
        .select("*, anggota(nama), org_units(nama, level)")
        .order("periode_akhir", { ascending: false });

      if (!data) return [];

      const groups: Record<string, BPHItem[]> = {};
      for (const item of data as BPHItem[]) {
        const key = item.org_units?.nama ?? "Lainnya";
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }

      return Object.entries(groups).map(([name, members]) => ({ name, members }));
    },
  });

  // Collect all BPH items for expiry check and export
  const allItems: BPHItem[] = (bphGroups ?? []).flatMap((g) => g.members);
  const today = new Date().toISOString().split("T")[0];
  const expiringSoon = allItems.filter((b) => {
    const days = daysUntil(b.periode_akhir);
    return days >= 0 && days <= 30;
  });

  const exportData = allItems.map((b) => ({
    nama: b.anggota?.nama ?? "—",
    jabatan: b.jabatan,
    unit: b.org_units?.nama ?? "—",
    level: b.org_units?.level ?? "—",
    periode_awal: b.periode_awal,
    periode_akhir: b.periode_akhir,
    status: b.periode_akhir >= today ? "Aktif" : "Selesai",
  }));

  const handleEdit = (item: BPHItem) => {
    setEditTarget(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("bph").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: `Pengurus "${deleteTarget.anggota?.nama}" berhasil dihapus dari BPH.` });
      qc.invalidateQueries({ queryKey: ["bph-grouped"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
      qc.invalidateQueries({ queryKey: ["recent-activity"] });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message ?? "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Kepengurusan</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Badan Pengurus Harian</h1>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={exportData}
              columns={[
                { label: "Nama", key: "nama" },
                { label: "Jabatan", key: "jabatan" },
                { label: "Unit", key: "unit" },
                { label: "Level", key: "level" },
                { label: "Periode Awal", key: "periode_awal" },
                { label: "Periode Akhir", key: "periode_akhir" },
                { label: "Status", key: "status" },
              ]}
              filename="Data-BPH"
            />
            {isAdmin && (
              <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2 text-xs font-bold uppercase tracking-wider">
                <Plus className="size-4" />
                Tambah Pengurus
              </Button>
            )}
          </div>
        </div>

        {/* Expiry Warning Banner */}
        {expiringSoon.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30"
          >
            <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Periode Kepengurusan Akan Berakhir</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expiringSoon.length} pengurus memiliki periode yang berakhir dalam 30 hari ke depan:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {expiringSoon.map((b) => (
                  <span key={b.id} className="text-[10px] font-mono bg-warning/10 border border-warning/20 text-warning px-2 py-0.5 rounded-full">
                    {b.anggota?.nama} — {daysUntil(b.periode_akhir)} hari lagi
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {isLoading && <div className="text-center py-12 text-muted-foreground">Memuat data...</div>}

        {!isLoading && (!bphGroups || bphGroups.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            Belum ada data BPH. Tambahkan pengurus untuk memulai.
          </div>
        )}

        {bphGroups?.map((group, i) => (
          <motion.div
            key={group.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-surface rounded-xl overflow-hidden"
          >
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">BPH — {group.name}</h2>
              <Badge variant="outline" className="text-[10px]">{group.members.length} pengurus</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {group.members.map((m) => {
                const nama = m.anggota?.nama ?? "—";
                const isActive = m.periode_akhir >= today;
                const days = daysUntil(m.periode_akhir);
                const isExpiringSoon = isActive && days <= 30;
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-lg bg-secondary/50 border transition-colors group ${isExpiringSoon ? "border-warning/40" : "border-border hover:border-primary/30"}`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                          {nama.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{nama}</p>
                        <p className="text-xs text-muted-foreground">{m.jabatan}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(m)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">{m.periode_awal} – {m.periode_akhir}</span>
                      {isExpiringSoon ? (
                        <Badge variant="outline" className="border-warning/50 text-warning text-[10px] font-bold uppercase">
                          {days}h lagi
                        </Badge>
                      ) : isActive ? (
                        <Badge variant="outline" className="border-success/50 text-success text-[10px] font-bold uppercase">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground text-[10px] font-bold uppercase">Selesai</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <BPHFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }} editData={editTarget} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Hapus Pengurus BPH?"
        description={`"${deleteTarget?.anggota?.nama}" (${deleteTarget?.jabatan}) akan dihapus dari BPH secara permanen.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardLayout>
  );
};

export default PengurusBPH;
