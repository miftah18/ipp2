import { DashboardLayout } from "@/components/DashboardLayout";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExportButton } from "@/components/dashboard/ExportButton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = [
  "hsl(18, 100%, 56%)",
  "hsl(160, 84%, 39%)",
  "hsl(217, 91%, 60%)",
  "hsl(280, 65%, 60%)",
  "hsl(38, 92%, 50%)",
];

const Laporan = () => {
  const { data: levelStats } = useQuery({
    queryKey: ["report-level-stats"],
    queryFn: async () => {
      const levels = ["pusat", "provinsi", "kabupaten", "kecamatan", "ranting"] as const;
      const result = await Promise.all(
        levels.map(async (level) => {
          const { data: units } = await supabase.from("org_units").select("id").eq("level", level);
          const unitIds = units?.map((u) => u.id) ?? [];
          if (unitIds.length === 0) return { level, aktif: 0, nonaktif: 0, total: 0 };
          const { count: aktif } = await supabase.from("anggota").select("*", { count: "exact", head: true }).in("org_unit_id", unitIds).eq("status", "aktif");
          const { count: nonaktif } = await supabase.from("anggota").select("*", { count: "exact", head: true }).in("org_unit_id", unitIds).eq("status", "nonaktif");
          return {
            level: level.charAt(0).toUpperCase() + level.slice(1),
            aktif: aktif ?? 0,
            nonaktif: nonaktif ?? 0,
            total: (aktif ?? 0) + (nonaktif ?? 0),
          };
        })
      );
      return result;
    },
  });

  const { data: roleStats } = useQuery({
    queryKey: ["report-role-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("anggota").select("role").eq("status", "aktif");
      if (!data) return [];
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.role || "Tidak ada"] = (counts[row.role || "Tidak ada"] ?? 0) + 1;
      }
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const { data: bphStats } = useQuery({
    queryKey: ["report-bph-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("bph")
        .select("jabatan, periode_akhir, org_units(nama, level), anggota(nama)")
        .order("periode_akhir", { ascending: false });
      if (!data) return [];
      return data.map((b) => ({
        ...b,
        isActive: b.periode_akhir >= today,
      }));
    },
  });

  const exportLevelData = (levelStats ?? []).map((s) => ({
    level: s.level,
    aktif: s.aktif,
    nonaktif: s.nonaktif,
    total: s.total,
  }));

  const exportBphData = (bphStats ?? []).map((b) => ({
    nama: (b.anggota as any)?.nama ?? "—",
    jabatan: b.jabatan,
    unit: (b.org_units as any)?.nama ?? "—",
    level: (b.org_units as any)?.level ?? "—",
    periode_akhir: b.periode_akhir,
    status: b.isActive ? "Aktif" : "Selesai",
  }));

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Analitik</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Laporan & Statistik</h1>
          </div>
          <div className="flex gap-2">
            <ExportButton
              data={exportLevelData}
              columns={[
                { label: "Level", key: "level" },
                { label: "Aktif", key: "aktif" },
                { label: "Nonaktif", key: "nonaktif" },
                { label: "Total", key: "total" },
              ]}
              filename="Laporan-Anggota-per-Level"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(levelStats ?? []).map((s, i) => (
            <motion.div key={s.level} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-surface rounded-xl p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{s.level}</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{s.total}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.aktif} aktif · {s.nonaktif} nonaktif</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-xl p-5">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Anggota per Level</h2>
            {levelStats && levelStats.some((s) => s.aktif > 0 || s.nonaktif > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={levelStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 10%, 14%)" />
                  <XAxis dataKey="level" tick={{ fill: "hsl(215, 10%, 50%)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(215, 10%, 50%)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(220, 10%, 8%)", border: "1px solid hsl(220, 10%, 14%)", borderRadius: "8px", color: "hsl(210, 20%, 90%)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="aktif" name="Aktif" fill="hsl(18, 100%, 56%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nonaktif" name="Nonaktif" fill="hsl(220, 10%, 25%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data anggota.</div>
            )}
          </motion.div>

          {/* Pie Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-surface rounded-xl p-5">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Distribusi Jabatan (Aktif)</h2>
            {roleStats && roleStats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={roleStats} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" stroke="none" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(220, 10%, 8%)", border: "1px solid hsl(220, 10%, 14%)", borderRadius: "8px", color: "hsl(210, 20%, 90%)", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-1">
                  {roleStats.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{item.name}</span>
                      <span className="text-foreground font-mono tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data jabatan.</div>
            )}
          </motion.div>
        </div>

        {/* BPH Table with Export */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-surface rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Daftar Pengurus BPH</h2>
            <ExportButton
              data={exportBphData}
              columns={[
                { label: "Nama", key: "nama" },
                { label: "Jabatan", key: "jabatan" },
                { label: "Unit", key: "unit" },
                { label: "Level", key: "level" },
                { label: "Periode Akhir", key: "periode_akhir" },
                { label: "Status", key: "status" },
              ]}
              filename="Laporan-BPH"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Nama</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Jabatan</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Unit</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Periode</th>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {(bphStats ?? []).map((b) => (
                  <tr key={(b as any).id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 text-sm font-semibold text-foreground">{(b.anggota as any)?.nama ?? "—"}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{b.jabatan}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">{(b.org_units as any)?.nama ?? "—"}</td>
                    <td className="px-5 py-4 text-xs font-mono text-muted-foreground hidden sm:table-cell">{b.periode_akhir}</td>
                    <td className="px-5 py-4">
                      {b.isActive ? (
                        <span className="text-[10px] font-bold uppercase text-success border border-success/30 px-2 py-0.5 rounded-full">Aktif</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-muted-foreground border border-border px-2 py-0.5 rounded-full">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!bphStats || bphStats.length === 0) && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">Belum ada data BPH.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Laporan;
