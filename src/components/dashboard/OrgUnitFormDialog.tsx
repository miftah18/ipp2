import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: OrgUnit | null;
}

const ORG_LEVELS: OrgLevel[] = ["pusat", "provinsi", "kabupaten", "kecamatan", "ranting"];

const PARENT_LEVELS: Record<OrgLevel, OrgLevel | null> = {
  pusat: null,
  provinsi: "pusat",
  kabupaten: "provinsi",
  kecamatan: "kabupaten",
  ranting: "kecamatan",
};

export function OrgUnitFormDialog({ open, onClose, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    nama: "",
    level: "provinsi" as OrgLevel,
    parent_id: "",
    deskripsi: "",
    alamat: "",
    email: "",
    telepon: "",
  });
  const [loading, setLoading] = useState(false);

  const parentLevel = PARENT_LEVELS[form.level];

  const { data: parentUnits } = useQuery({
    queryKey: ["org-units-by-level", parentLevel],
    queryFn: async () => {
      if (!parentLevel) return [];
      const { data } = await supabase.from("org_units").select("id, nama").eq("level", parentLevel).order("nama");
      return data ?? [];
    },
    enabled: !!parentLevel,
  });

  useEffect(() => {
    if (editData) {
      setForm({
        nama: editData.nama,
        level: editData.level,
        parent_id: editData.parent_id ?? "",
        deskripsi: editData.deskripsi ?? "",
        alamat: editData.alamat ?? "",
        email: editData.email ?? "",
        telepon: editData.telepon ?? "",
      });
    } else {
      setForm({ nama: "", level: "provinsi", parent_id: "", deskripsi: "", alamat: "", email: "", telepon: "" });
    }
  }, [editData, open]);

  // Reset parent_id when level changes
  useEffect(() => {
    setForm((f) => ({ ...f, parent_id: "" }));
  }, [form.level]);

  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama unit organisasi wajib diisi.", variant: "destructive" });
      return;
    }
    if (parentLevel && !form.parent_id) {
      toast({ title: "Validasi Gagal", description: `Pilih unit ${parentLevel} induk terlebih dahulu.`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        level: form.level,
        parent_id: form.parent_id || null,
        deskripsi: form.deskripsi.trim() || null,
        alamat: form.alamat.trim() || null,
        email: form.email.trim() || null,
        telepon: form.telepon.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && editData) {
        const { error } = await supabase.from("org_units").update(payload).eq("id", editData.id);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Unit organisasi berhasil diperbarui." });
      } else {
        const { error } = await supabase.from("org_units").insert(payload);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Unit organisasi baru berhasil ditambahkan." });
      }

      qc.invalidateQueries({ queryKey: ["org-pusat"] });
      qc.invalidateQueries({ queryKey: ["org-provinces"] });
      qc.invalidateQueries({ queryKey: ["org-level-counts"] });
      qc.invalidateQueries({ queryKey: ["org-units-list"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message ?? "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Unit Organisasi" : "Tambah Unit Organisasi"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Level <span className="text-destructive">*</span></Label>
              <Select
                value={form.level}
                onValueChange={(v: OrgLevel) => setForm((f) => ({ ...f, level: v }))}
                disabled={isEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {parentLevel && (
              <div className="space-y-1.5">
                <Label className="capitalize">Unit {parentLevel} Induk <span className="text-destructive">*</span></Label>
                <Select value={form.parent_id} onValueChange={(v) => setForm((f) => ({ ...f, parent_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={`Pilih ${parentLevel}`} /></SelectTrigger>
                  <SelectContent>
                    {parentUnits?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nama">Nama Unit <span className="text-destructive">*</span></Label>
            <Input id="nama" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama unit organisasi" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deskripsi">Deskripsi</Label>
            <Textarea id="deskripsi" value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} placeholder="Deskripsi singkat unit..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@unit.org" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telepon">Telepon</Label>
              <Input id="telepon" value={form.telepon} onChange={(e) => setForm((f) => ({ ...f, telepon: e.target.value }))} placeholder="021-xxxx-xxxx" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alamat">Alamat</Label>
            <Textarea id="alamat" value={form.alamat} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} placeholder="Alamat lengkap..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Unit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
