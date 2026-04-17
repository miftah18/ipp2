import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function OrgHierarchyTree() {
  const { data: provinces } = useQuery({
    queryKey: ["org-hierarchy-tree"],
    queryFn: async () => {
      const { data: provs } = await supabase
        .from("org_units")
        .select("id, nama")
        .eq("level", "provinsi")
        .order("nama")
        .limit(5);

      if (!provs) return [];

      const result = await Promise.all(
        provs.map(async (prov) => {
          const { data: children } = await supabase
            .from("org_units")
            .select("id, nama, level")
            .eq("parent_id", prov.id)
            .order("nama")
            .limit(3);

          const { count } = await supabase
            .from("anggota")
            .select("*", { count: "exact", head: true })
            .in(
              "org_unit_id",
              [prov.id, ...(children?.map((c) => c.id) ?? [])]
            );

          return {
            ...prov,
            members: count ?? 0,
            children: children ?? [],
          };
        })
      );

      return result;
    },
  });

  const isEmpty = !provinces || provinces.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-surface rounded-xl overflow-hidden"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Struktur Komando Wilayah
        </h2>
      </div>
      <div className="p-5">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada data organisasi. Tambahkan unit organisasi untuk memulai.
          </p>
        ) : (
          <div className="space-y-4">
            {provinces?.map((prov) => (
              <div key={prov.id} className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg border-l-2 border-l-primary">
                  <ChevronRight className="size-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">DPW PROVINSI</p>
                    <p className="text-sm font-semibold text-foreground">{prov.nama}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {prov.members} Anggota
                  </span>
                </div>
                {prov.children.length > 0 && (
                  <div className="ml-6 space-y-1 border-l border-border">
                    {prov.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-3 p-3 ml-4 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group">
                        <div className="size-1.5 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase">{child.level}</p>
                          <p className="text-sm text-foreground">{child.nama}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
