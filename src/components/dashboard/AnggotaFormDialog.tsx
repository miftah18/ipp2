import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

type Anggota = {
  id: string;
  nama: string;
  email: string | null;
  telepon: string | null;
  role: string;
  status: "aktif" | "nonaktif";
  org_unit_id: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: Anggota | null;
}

export function AnggotaFormDialog({ open, onClose, editData }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    nama: "",
    email: "",
    telepon: "",
    role: "",
    status: "aktif" as "aktif" | "nonaktif",
    org_unit_id: "",
  });
  const [loading, setLoading] = useState(false);

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
        nama: editData.nama,
        email: editData.email ?? "",
        telepon: editData.telepon ?? "",
        role: editData.role,
        status: editData.status,
        org_unit_id: editData.org_unit_id,
      });
    } else {
      setForm({ nama: "", email: "", telepon: "", role: "", status: "aktif", org_unit_id: "" });
    }
  }, [editData, open]);

  const handleSubmit = async () => {
    if (!form.nama.trim() || !form.org_unit_id) {
      toast({ title: "Validasi Gagal", description: "Nama dan unit organisasi wajib diisi.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nama: form.nama.trim(),
        email: form.email.trim() || null,
        telepon: form.telepon.trim() || null,
        role: form.role.trim(),
        status: form.status,
        org_unit_id: form.org_unit_id,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && editData) {
        const { error } = await supabase.from("anggota").update(payload).eq("id", editData.id);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Data anggota berhasil diperbarui." });
      } else {
        const { error } = await supabase.from("anggota").insert(payload);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Anggota baru berhasil ditambahkan." });
      }

      qc.invalidateQueries({ queryKey: ["anggota-list"] });
      qc.invalidateQueries({ queryKey: ["report-level-stats"] });
      qc.invalidateQueries({ queryKey: ["report-role-stats"] });
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
          <DialogTitle>{isEdit ? "Edit Anggota" : "Tambah Anggota Baru"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nama">Nama <span className="text-destructive">*</span></Label>
            <Input id="nama" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telepon">Telepon</Label>
            <Input id="telepon" value={form.telepon} onChange={(e) => setForm((f) => ({ ...f, telepon: e.target.value }))} placeholder="08xx-xxxx-xxxx" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Jabatan</Label>
            <Input id="role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Ketua, Sekretaris, dll." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: "aktif" | "nonaktif") => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit Organisasi <span className="text-destructive">*</span></Label>
              <Select value={form.org_unit_id} onValueChange={(v) => setForm((f) => ({ ...f, org_unit_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                <SelectContent>
                  {orgUnits?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="capitalize">[{u.level}] </span>{u.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Anggota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
