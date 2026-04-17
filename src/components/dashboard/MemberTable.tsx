import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

export function MemberTable() {
  const navigate = useNavigate();

  const { data: members, isLoading } = useQuery({
    queryKey: ["dashboard-recent-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anggota")
        .select("id, nama, role, status, org_units(nama)")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-surface rounded-xl overflow-hidden"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Anggota Terbaru</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/anggota")}
          className="text-[11px] font-semibold text-primary uppercase hover:bg-primary/10 gap-1"
        >
          Lihat Semua
          <ExternalLink className="size-3" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Jabatan</th>
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Unit</th>
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-border/50 animate-pulse">
                  {[...Array(5)].map((__, j) => (
                    <td key={j} className="px-5 py-4"><div className="h-3 bg-muted rounded w-3/4" /></td>
                  ))}
                </tr>
              ))}
            {!isLoading && members?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">
                  Belum ada anggota terdaftar.
                </td>
              </tr>
            )}
            {members?.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/anggota/${m.id}`)}
              >
                <td className="px-5 py-4 text-sm font-semibold text-foreground">{m.nama}</td>
                <td className="px-5 py-4 text-sm text-muted-foreground">{m.role || "—"}</td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                  {(m.org_units as any)?.nama ?? "—"}
                </td>
                <td className="px-5 py-4">
                  {m.status === "aktif" ? (
                    <Badge variant="outline" className="border-success/50 text-success text-[10px] font-bold uppercase">Aktif</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px] font-bold uppercase">Nonaktif</Badge>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                    <ExternalLink className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
