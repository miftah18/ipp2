import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pencil, Trash2, Filter, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { AnggotaFormDialog } from "@/components/dashboard/AnggotaFormDialog";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Anggota = {
  id: string;
  nama: string;
  email: string | null;
  telepon: string | null;
  role: string;
  status: "aktif" | "nonaktif";
  org_unit_id: string;
  org_units?: { nama: string; level: string } | null;
};

const EXPORT_COLUMNS = [
  { label: "Nama", key: "nama" },
  { label: "Email", key: "email" },
  { label: "Telepon", key: "telepon" },
  { label: "Jabatan", key: "role" },
  { label: "Unit Organisasi", key: "org_units.nama" },
  { label: "Level", key: "org_units.level" },
  { label: "Status", key: "status" },
];

const DirektoriAnggota = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"semua" | "aktif" | "nonaktif">("semua");
  const [filterLevel, setFilterLevel] = useState<string>("semua");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Anggota | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Anggota | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["anggota-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anggota")
        .select("*, org_units(nama, level)")
        .order("nama");
      return (data ?? []) as Anggota[];
    },
  });

  const { data: orgLevels } = useQuery({
    queryKey: ["org-levels-distinct"],
    queryFn: async () => {
      const { data } = await supabase.from("org_units").select("level");
      const unique = [...new Set(data?.map((d) => d.level) ?? [])];
      return unique as string[];
    },
  });

  const filtered = (members ?? []).filter((m) => {
    const matchSearch =
      m.nama.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "semua" || m.status === filterStatus;
    const matchLevel = filterLevel === "semua" || m.org_units?.level === filterLevel;
    return matchSearch && matchStatus && matchLevel;
  });

  const handleEdit = (m: Anggota) => {
    setEditTarget(m);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("anggota").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: `Anggota "${deleteTarget.nama}" berhasil dihapus.` });
      qc.invalidateQueries({ queryKey: ["anggota-list"] });
      qc.invalidateQueries({ queryKey: ["report-level-stats"] });
      qc.invalidateQueries({ queryKey: ["report-role-stats"] });
      qc.invalidateQueries({ queryKey: ["stats-overview"] });
      qc.invalidateQueries({ queryKey: ["recent-activity"] });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message ?? "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const hasFilter = filterStatus !== "semua" || filterLevel !== "semua" || search !== "";

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Database</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Direktori Anggota</h1>
          </div>
          <div className="flex gap-2">
            <ExportButton data={filtered} columns={EXPORT_COLUMNS} filename="Direktori-Anggota" />
            {isAdmin && (
              <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2 text-xs font-bold uppercase tracking-wider">
                <Plus className="size-4" />
                Tambah Anggota
              </Button>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, atau jabatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Status</SelectItem>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="nonaktif">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Semua Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Level</SelectItem>
                {orgLevels?.map((l) => (
                  <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setFilterStatus("semua"); setFilterLevel("semua"); }}
                className="text-xs text-muted-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nama</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Telepon</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Jabatan</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Unit</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50 animate-pulse">
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-3 bg-muted rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))}
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => navigate(`/anggota/${m.id}`)}
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{m.nama}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">{m.email ?? "—"}</td>
                    <td className="px-5 py-4 text-sm font-mono text-muted-foreground hidden lg:table-cell">{m.telepon ?? "—"}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{m.role || "—"}</td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px] uppercase">{m.org_units?.nama ?? "—"}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      {m.status === "aktif" ? (
                        <Badge variant="outline" className="border-success/50 text-success text-[10px] font-bold uppercase">Aktif</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px] font-bold uppercase">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/anggota/${m.id}`)}>
                          <ExternalLink className="size-3.5" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(m)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">
              {hasFilter ? "Tidak ada anggota yang sesuai filter." : "Belum ada data anggota."}
            </div>
          )}
        </motion.div>

        <div className="text-xs text-muted-foreground">
          Menampilkan {filtered.length} dari {members?.length ?? 0} anggota
          {hasFilter && <span className="ml-1 text-primary">(terfilter)</span>}
        </div>
      </div>

      <AnggotaFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }} editData={editTarget} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Hapus Anggota?"
        description={`Anggota "${deleteTarget?.nama}" akan dihapus secara permanen.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </DashboardLayout>
  );
};

export default DirektoriAnggota;
