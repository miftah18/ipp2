import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { canManageOrgUnit } from "@/utils/hierarchyPermissions";
import type { OrgUnit as HierarchyOrgUnit } from "@/utils/hierarchyPermissions";

type OrgLevel = "pusat" | "wilayah" | "kabupaten" | "kecamatan" | "ranting";

type OrgUnit = {
  id: string;
  name: string;
  type: OrgLevel;
  parent_id: string | null;
  deskripsi: string | null;
  alamat: string | null;
  email: string | null;
  telepon: string | null;
  hierarchy_level: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  editData?: OrgUnit | null;
}

const ORG_LEVELS: OrgLevel[] = ["pusat", "wilayah", "kabupaten", "kecamatan", "ranting"];

const PARENT_LEVELS: Record<OrgLevel, OrgLevel | null> = {
  pusat: null,
  wilayah: "pusat",
  kabupaten: "wilayah",
  kecamatan: "kabupaten",
  ranting: "kecamatan",
};

export function OrgUnitFormDialog({ open, onClose, editData }: Props) {
  const qc = useQueryClient();
  const { orgUnitId, managedOrgUnits, hierarchyLevel, user } = useAuth();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    name: "",
    type: "wilayah" as OrgLevel,
    parent_id: "",
    deskripsi: "",
    alamat: "",
    email: "",
    telepon: "",
  });
  const [loading, setLoading] = useState(false);

  const parentLevel = PARENT_LEVELS[form.type];

  // Fetch all org units untuk permission checking
  const { data: allOrgUnits } = useQuery({
    queryKey: ["org-all-units"],
    queryFn: async () => {
      const { data } = await supabase
        .from("org_units")
        .select("id, name, type, parent_id, hierarchy_level")
        .order("hierarchy_level", { ascending: true });
      return data || [];
    },
  });

  const { data: parentUnits } = useQuery({
    queryKey: ["org-units-by-level", parentLevel],
    queryFn: async () => {
      if (!parentLevel) return [];
      const { data } = await supabase.from("org_units").select("id, name").eq("type", parentLevel).order("name");
      return data ?? [];
    },
    enabled: !!parentLevel,
  });

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name,
        type: editData.type,
        parent_id: editData.parent_id ?? "",
        deskripsi: editData.deskripsi ?? "",
        alamat: editData.alamat ?? "",
        email: editData.email ?? "",
        telepon: editData.telepon ?? "",
      });
    } else {
      setForm({ name: "", type: "wilayah", parent_id: "", deskripsi: "", alamat: "", email: "", telepon: "" });
    }
  }, [editData, open]);

  // Reset parent_id when type changes
  useEffect(() => {
    setForm((f) => ({ ...f, parent_id: "" }));
  }, [form.type]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama unit organisasi wajib diisi.", variant: "destructive" });
      return;
    }
    if (parentLevel && !form.parent_id) {
      toast({ title: "Validasi Gagal", description: `Pilih unit ${parentLevel} induk terlebih dahulu.`, variant: "destructive" });
      return;
    }

    // Check permission untuk edit
    if (isEdit && editData && allOrgUnits) {
      const canManage = canManageOrgUnit(
        {
          id: user?.id || '',
          email: user?.email || '',
          role: 'admin',
          org_unit_id: orgUnitId,
          managed_org_units: managedOrgUnits,
          hierarchy_level: hierarchyLevel,
        },
        editData.id,
        editData.hierarchy_level,
        allOrgUnits as HierarchyOrgUnit[]
      );

      if (!canManage) {
        toast({ 
          title: "Akses Ditolak", 
          description: "Anda tidak memiliki izin untuk mengedit unit organisasi ini.",
          variant: "destructive"
        });
        return;
      }
    }

    // Check permission untuk create (hanya jika parent ditetapkan)
    if (!isEdit && form.parent_id && allOrgUnits) {
      const canManage = canManageOrgUnit(
        {
          id: user?.id || '',
          email: user?.email || '',
          role: 'admin',
          org_unit_id: orgUnitId,
          managed_org_units: managedOrgUnits,
          hierarchy_level: hierarchyLevel,
        },
        form.parent_id,
        0, // hierarchy_level will be set by backend
        allOrgUnits as HierarchyOrgUnit[]
      );

      if (!canManage) {
        toast({ 
          title: "Akses Ditolak", 
          description: "Anda tidak memiliki izin untuk membuat unit di bawah unit organisasi tersebut.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        parent_id: form.parent_id || null,
        deskripsi: form.deskripsi.trim() || null,
        alamat: form.alamat.trim() || null,
        email: form.email.trim() || null,
        telepon: form.telepon.trim() || null,
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
      qc.invalidateQueries({ queryKey: ["org-wilayah"] });
      qc.invalidateQueries({ queryKey: ["org-level-units"] });
      qc.invalidateQueries({ queryKey: ["org-all-units"] });
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
              <Label>Tipe <span className="text-destructive">*</span></Label>
              <Select
                value={form.type}
                onValueChange={(v: OrgLevel) => setForm((f) => ({ ...f, type: v }))}
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
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Unit <span className="text-destructive">*</span></Label>
            <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama unit organisasi" />
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
