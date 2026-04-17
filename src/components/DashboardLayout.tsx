import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-success animate-pulse-glow" />
              <span className="text-xs font-medium text-success uppercase tracking-wider">
                Sistem Aktif
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto grid-bg">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
