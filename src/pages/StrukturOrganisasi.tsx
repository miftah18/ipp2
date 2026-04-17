import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrgUnitFormDialog } from "@/components/dashboard/OrgUnitFormDialog";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { toast } from "@/components/ui/use-toast";

type OrgLevel = "pusat" | "provinsi" | "kabupaten" | "kecamatan" | "ranting";

type OrgUnit = {
  id: string;
  nama: string;
  level: OrgLevel;
  parent_id: string | null;
  deskripsi: string | null;
  alamat: string | null;
  email: string | null;
  telepon: string | null;
};

const LEVEL_COLORS: Record<OrgLevel, string> = {
  pusat: "border-primary/50 text-primary",
  provinsi: "border-blue-500/50 text-blue-400",
  kabupaten: "border-purple-500/50 text-purple-400",
  kecamatan: "border-yellow-500/50 text-yellow-400",
  ranting: "border-green-500/50 text-green-400",
};

const StrukturOrganisasi = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgUnit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgUnit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeLevel, setActiveLevel] = useState<OrgLevel>("provinsi");

  const { data: pusat } = useQuery({
    queryKey: ["org-pusat"],
    queryFn: async () => {
      const { data } = await supabase.from("org_units").select("*").eq("level", "pusat").limit(1);
      return (data?.[0] ?? null) as OrgUnit | null;
    },
  });

  const { data: provinces } = useQuery({
    queryKey: ["org-provinces"],
    queryFn: async () => {
      const { data } = await supabase.from("org_units").select("*").eq("level", "provinsi").order("nama");
      if (!data) return [];

      const result = await Promise.all(
        data.map(async (prov) => {
          const { count: kabCount } = await supabase.from("org_units").select("*", { count: "exact", head: true }).eq("parent_id", prov.id).eq("level", "kabupaten");
          return { ...(prov as OrgUnit), kabCount: kabCount ?? 0 };
        })
      );
      return result;
    },
  });

  const { data: levelUnits } = useQuery({
    queryKey: ["org-level-units", activeLevel],
    queryFn: async () => {
      if (activeLevel === "pusat" || activeLevel === "provinsi") return [];
      const { data } = await supabase.from("org_units").select("*, org_units!parent_id(nama)").eq("level", activeLevel).order("nama");
      return (data ?? []) as (OrgUnit & { org_units?: { nama: string } | null })[];
    },
    enabled: activeLevel !== "pusat" && activeLevel !== "provinsi",
  });

  const handleEdit = (unit: OrgUnit) => {
    setEditTarget(unit);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      // Check for children
      const { count } = await supabase.from("org_units").select("*", { count: "exact", head: true }).eq("parent_id", deleteTarget.id);
      if (count && count > 0) {
        toast({ title: "Tidak Dapat Dihapus", description: "Unit ini masih memiliki sub-unit. Hapus sub-unit terlebih dahulu.", variant: "destructive" });
        setDeleteLoading(false);
        setDeleteTarget(null);
        return;
      }
      const { error } = await supabase.from("org_units").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: `Unit "${deleteTarget.nama}" berhasil dihapus.` });
      qc.invalidateQueries({ queryKey: ["org-pusat"] });
      qc.invalidateQueries({ queryKey: ["org-provinces"] });
      qc.invalidateQueries({ queryKey: ["org-level-counts"] });
      qc.invalidateQueries({ queryKey: ["org-level-units"] });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message ?? "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const levels: OrgLevel[] = ["pusat", "provinsi", "kabupaten", "kecamatan", "ranting"];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Hierarki</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Struktur Organisasi</h1>
          </div>
          {isAdmin && (
            <Button
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
              className="gap-2 text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="size-4" />
              Tambah Unit
            </Button>
          )}
        </div>

        {/* Pusat node */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group"
          >
            <div className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg glow-primary flex items-center gap-3">
              <Building2 className="size-4" />
              {pusat ? pusat.nama : "Pengurus Pusat"}
              {isAdmin && pusat && (
                <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="size-6 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
                    onClick={() => handleEdit(pusat)}
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
          <div className="w-px h-8 bg-border" />
        </div>

        {/* Level filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["provinsi", "kabupaten", "kecamatan", "ranting"] as OrgLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setActiveLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors capitalize border ${
                activeLevel === l
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Provinsi grid */}
        {activeLevel === "provinsi" && (
          provinces && provinces.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {provinces.map((prov, i) => (
                <motion.div
                  key={prov.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="glass-surface rounded-xl p-5 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">PROVINSI</p>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(prov)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(prov)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{prov.nama}</h3>
                  {prov.deskripsi && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prov.deskripsi}</p>}
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Kabupaten/Kota</span><span className="font-mono tabular-nums">{prov.kabCount}</span></div>
                    {prov.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 shrink-0" /><span className="truncate">{prov.email}</span></div>}
                    {prov.telepon && <div className="flex items-center gap-1.5"><Phone className="size-3 shrink-0" />{prov.telepon}</div>}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Belum ada data provinsi.</div>
          )
        )}

        {/* Other levels grid */}
        {activeLevel !== "provinsi" && (
          levelUnits && levelUnits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {levelUnits.map((unit, i) => (
                <motion.div
                  key={unit.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-surface rounded-xl p-4 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-1">
                    <Badge variant="outline" className={`text-[10px] uppercase ${LEVEL_COLORS[activeLevel]}`}>{activeLevel}</Badge>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(unit)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(unit)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-1">{unit.nama}</h3>
                  {unit.org_units?.nama && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Induk: {unit.org_units.nama}</p>
                  )}
                  {unit.deskripsi && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{unit.deskripsi}</p>}
                  <div className="mt-2 space-y-1">
                    {unit.alamat && <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground"><MapPin className="size-3 shrink-0 mt-0.5" /><span className="line-clamp-1">{unit.alamat}</span></div>}
                    {unit.email && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Mail className="size-3 shrink-0" /><span className="truncate">{unit.email}</span></div>}
                    {unit.telepon && <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Phone className="size-3 shrink-0" />{unit.telepon}</div>}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground capitalize">Belum ada data {activeLevel}.</div>
          )
        )}
      </div>

      <OrgUnitFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editData={editTarget}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Hapus Unit Organisasi?"
        description={`Unit "${deleteTarget?.nama}" akan dihapus secara permanen. Pastikan tidak ada sub-unit atau anggota yang terkait.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardLayout>
  );
};

export default StrukturOrganisasi;
