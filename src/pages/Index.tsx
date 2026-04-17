import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { OrgHierarchyTree } from "@/components/dashboard/OrgHierarchyTree";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MemberTable } from "@/components/dashboard/MemberTable";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileBarChart, Plus } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Dasbor Utama</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Pusat Komando Organisasi</h1>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => navigate("/laporan")}>
              <FileBarChart className="size-3.5" />
              Lihat Laporan
            </Button>
            {isAdmin && (
              <Button size="sm" className="gap-2 text-xs font-bold uppercase tracking-wider" onClick={() => navigate("/struktur")}>
                <Plus className="size-3.5" />
                Tambah Unit
              </Button>
            )}
          </div>
        </div>

        <StatsOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OrgHierarchyTree />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>

        <MemberTable />
      </div>
    </DashboardLayout>
  );
};

export default Index;
