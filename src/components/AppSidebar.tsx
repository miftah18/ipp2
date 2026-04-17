import {
  LayoutDashboard,
  Network,
  Users,
  UserCog,
  FileBarChart,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const mainNav = [
  { title: "Dasbor", url: "/", icon: LayoutDashboard },
  { title: "Struktur Organisasi", url: "/struktur", icon: Network },
  { title: "Direktori Anggota", url: "/anggota", icon: Users },
  { title: "Pengurus (BPH)", url: "/bph", icon: UserCog },
  { title: "Laporan", url: "/laporan", icon: FileBarChart },
];

const adminNav = [
  { title: "Manajemen User", url: "/users", icon: ShieldCheck },
];

const levels = ["pusat", "provinsi", "kabupaten", "kecamatan", "ranting"] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, isAdmin, signOut } = useAuth();

  const { data: levelCounts } = useQuery({
    queryKey: ["org-level-counts"],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const level of levels) {
        const { count } = await supabase
          .from("org_units")
          .select("*", { count: "exact", head: true })
          .eq("level", level);
        counts[level] = count ?? 0;
      }
      return counts;
    },
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-md bg-primary flex items-center justify-center font-extrabold text-primary-foreground text-xs shrink-0 tracking-tighter">
            ORG
          </div>
          {!collapsed && (
            <div className="leading-none min-w-0">
              <h1 className="font-bold text-foreground tracking-tight text-base">NUSANTARA</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">Sistem Organisasi</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3">
            Menu Utama
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-medium"
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3">
              Administrasi
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-muted/50 transition-colors"
                        activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-medium"
                      >
                        <item.icon className="size-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3">
              Level Organisasi
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-1 px-2">
                {levels.map((level) => (
                  <div
                    key={level}
                    className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md cursor-pointer hover:bg-muted/30 capitalize"
                  >
                    <span>{level}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full tabular-nums">
                      {(levelCounts?.[level] ?? 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {user?.email?.substring(0, 2).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-1">
                {isAdmin && <Badge variant="outline" className="text-[9px] border-primary/50 text-primary px-1">Admin</Badge>}
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {isAdmin ? "" : "User"}
                </span>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <LogOut className="size-4" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
