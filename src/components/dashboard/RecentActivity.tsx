import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Building2, Award, TrendingUp } from "lucide-react";

type ActivityItem = {
  id: string;
  type: "anggota" | "org_unit" | "bph";
  name: string;
  action: string;
  time: string;
  rawDate: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

const TYPE_CONFIG = {
  anggota: { icon: UserPlus, color: "bg-primary", label: "Anggota baru ditambahkan" },
  org_unit: { icon: Building2, color: "bg-chart-3", label: "Unit organisasi ditambahkan" },
  bph: { icon: Award, color: "bg-success", label: "Pengurus BPH ditambahkan" },
};

export function RecentActivity() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [anggotaRes, orgRes, bphRes] = await Promise.all([
        supabase.from("anggota").select("id, nama, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("org_units").select("id, nama, level, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("bph").select("id, jabatan, created_at, anggota(nama)").order("created_at", { ascending: false }).limit(5),
      ]);

      const items: ActivityItem[] = [
        ...(anggotaRes.data ?? []).map((a) => ({
          id: "a-" + a.id,
          type: "anggota" as const,
          name: a.nama,
          action: "ditambahkan sebagai anggota",
          time: timeAgo(a.created_at),
          rawDate: a.created_at,
        })),
        ...(orgRes.data ?? []).map((o) => ({
          id: "o-" + o.id,
          type: "org_unit" as const,
          name: o.nama,
          action: `unit ${o.level} baru ditambahkan`,
          time: timeAgo(o.created_at),
          rawDate: o.created_at,
        })),
        ...(bphRes.data ?? []).map((b) => ({
          id: "b-" + b.id,
          type: "bph" as const,
          name: (b.anggota as any)?.nama ?? "—",
          action: `ditunjuk sebagai ${b.jabatan}`,
          time: timeAgo(b.created_at),
          rawDate: b.created_at,
        })),
      ];

      return items.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()).slice(0, 8);
    },
    refetchInterval: 30000,
  });

  const isEmpty = !isLoading && (!activities || activities.length === 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-surface rounded-xl overflow-hidden h-full flex flex-col"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Aktivitas Terbaru</h2>
        <div className="size-2 rounded-full bg-success animate-pulse" title="Live" />
      </div>
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="size-2 rounded-full bg-muted mt-1.5 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {isEmpty && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <TrendingUp className="size-8 mx-auto mb-2 opacity-30" />
            Belum ada aktivitas. Mulai tambahkan data!
          </div>
        )}
        {activities?.map((act, i) => {
          const cfg = TYPE_CONFIG[act.type];
          const Icon = cfg.icon;
          return (
            <div key={act.id} className="flex gap-3">
              <div className="relative flex flex-col items-center">
                <div className={`size-2 rounded-full ${cfg.color} shrink-0 mt-1.5`} />
                {i < (activities?.length ?? 0) - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="space-y-0.5 pb-2">
                <p className="text-[13px] text-foreground leading-snug">
                  <span className="font-semibold text-primary">{act.name}</span>{" "}
                  <span className="text-muted-foreground">{act.action}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3 text-muted-foreground" />
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">{act.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
