import { motion } from "framer-motion";
import { Users, Building2, MapPin, TrendingUp, Award, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function StatsOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats-overview"],
    queryFn: async () => {
      const [totalAnggota, aktifAnggota, totalProvinsi, totalKabupaten, totalBPH, bphAktif] = await Promise.all([
        supabase.from("anggota").select("*", { count: "exact", head: true }),
        supabase.from("anggota").select("*", { count: "exact", head: true }).eq("status", "aktif"),
        supabase.from("org_units").select("*", { count: "exact", head: true }).eq("level", "provinsi"),
        supabase.from("org_units").select("*", { count: "exact", head: true }).eq("level", "kabupaten"),
        supabase.from("bph").select("*", { count: "exact", head: true }),
        supabase.from("bph").select("*", { count: "exact", head: true }).gte("periode_akhir", new Date().toISOString().split("T")[0]),
      ]);

      const total = totalAnggota.count ?? 0;
      const aktif = aktifAnggota.count ?? 0;
      const rasio = total > 0 ? Math.round((aktif / total) * 1000) / 10 : 0;

      return {
        totalAnggota: total,
        aktifAnggota: aktif,
        rasioAktif: rasio,
        totalProvinsi: totalProvinsi.count ?? 0,
        totalKabupaten: totalKabupaten.count ?? 0,
        totalBPH: totalBPH.count ?? 0,
        bphAktif: bphAktif.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  const cards = [
    {
      label: "Total Anggota",
      value: isLoading ? "—" : (stats?.totalAnggota ?? 0).toLocaleString("id-ID"),
      sublabel: `${stats?.aktifAnggota ?? 0} aktif`,
      icon: Users,
      highlighted: false,
    },
    {
      label: "Unit Provinsi",
      value: isLoading ? "—" : String(stats?.totalProvinsi ?? 0),
      sublabel: `${stats?.totalKabupaten ?? 0} kab/kota`,
      icon: Building2,
      highlighted: false,
    },
    {
      label: "Pengurus BPH",
      value: isLoading ? "—" : String(stats?.totalBPH ?? 0),
      sublabel: `${stats?.bphAktif ?? 0} periode aktif`,
      icon: Award,
      highlighted: false,
    },
    {
      label: "Rasio Aktif",
      value: isLoading ? "—" : `${stats?.rasioAktif ?? 0}%`,
      sublabel: "anggota aktif",
      icon: TrendingUp,
      highlighted: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className={`glass-surface stat-card-glow rounded-xl p-5 ${stat.highlighted ? "border-primary/30" : ""}`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${stat.highlighted ? "text-primary" : "text-muted-foreground"}`}>
              {stat.label}
            </p>
            <stat.icon className="size-4 text-muted-foreground" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">
            {isLoading ? <span className="animate-pulse bg-muted rounded h-8 w-16 inline-block" /> : stat.value}
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{stat.sublabel}</p>
        </motion.div>
      ))}
    </div>
  );
}
