import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

type BPH = {
  id: string;
  jabatan: string;
  periode_awal: string;
  periode_akhir: string;
  anggota_id: string;
  org_unit_id: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: BPH | null;
}

export function BPHFormDialog({ open, onClose, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    jabatan: "",
    periode_awal: "",
    periode_akhir: "",
    anggota_id: "",
    org_unit_id: "",
  });
  const [loading, setLoading] = useState(false);

  const { data: anggotaList } = useQuery({
    queryKey: ["anggota-select"],
    queryFn: async () => {
      const { data } = await supabase.from("anggota").select("id, nama").eq("status", "aktif").order("nama");
      return data ?? [];
    },
  });

  const { data: orgUnits } = useQuery({
    queryKey: ["org-units-list"],
    queryFn: async () => {
      const { data } = await supabase.from("org_units").select("id, nama, level").order("nama");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (editData) {
      setForm({
        jabatan: editData.jabatan,
        periode_awal: editData.periode_awal,
        periode_akhir: editData.periode_akhir,
        anggota_id: editData.anggota_id,
        org_unit_id: editData.org_unit_id,
      });
    } else {
      setForm({ jabatan: "", periode_awal: "", periode_akhir: "", anggota_id: "", org_unit_id: "" });
    }
  }, [editData, open]);

  const handleSubmit = async () => {
    if (!form.jabatan.trim() || !form.anggota_id || !form.org_unit_id || !form.periode_awal || !form.periode_akhir) {
      toast({ title: "Validasi Gagal", description: "Semua field wajib diisi.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        jabatan: form.jabatan.trim(),
        periode_awal: form.periode_awal,
        periode_akhir: form.periode_akhir,
        anggota_id: form.anggota_id,
        org_unit_id: form.org_unit_id,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && editData) {
        const { error } = await supabase.from("bph").update(payload).eq("id", editData.id);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Data BPH berhasil diperbarui." });
      } else {
        const { error } = await supabase.from("bph").insert(payload);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Pengurus BPH baru berhasil ditambahkan." });
      }

      qc.invalidateQueries({ queryKey: ["bph-grouped"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message ?? "Terjadi kesalahan.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Pengurus BPH" : "Tambah Pengurus BPH"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Anggota <span className="text-destructive">*</span></Label>
            <Select value={form.anggota_id} onValueChange={(v) => setForm((f) => ({ ...f, anggota_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih anggota aktif" /></SelectTrigger>
              <SelectContent>
                {anggotaList?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jabatan">Jabatan <span className="text-destructive">*</span></Label>
            <Input id="jabatan" value={form.jabatan} onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))} placeholder="Ketua Umum, Sekretaris Jenderal, dll." />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Organisasi <span className="text-destructive">*</span></Label>
            <Select value={form.org_unit_id} onValueChange={(v) => setForm((f) => ({ ...f, org_unit_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih unit organisasi" /></SelectTrigger>
              <SelectContent>
                {orgUnits?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="capitalize">[{u.level}] </span>{u.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="periode_awal">Periode Awal <span className="text-destructive">*</span></Label>
              <Input id="periode_awal" type="date" value={form.periode_awal} onChange={(e) => setForm((f) => ({ ...f, periode_awal: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="periode_akhir">Periode Akhir <span className="text-destructive">*</span></Label>
              <Input id="periode_akhir" type="date" value={form.periode_akhir} onChange={(e) => setForm((f) => ({ ...f, periode_akhir: e.target.value }))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Pengurus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
