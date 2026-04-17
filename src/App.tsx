import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import StrukturOrganisasi from "./pages/StrukturOrganisasi";
import DirektoriAnggota from "./pages/DirektoriAnggota";
import AnggotaDetail from "./pages/AnggotaDetail";
import PengurusBPH from "./pages/PengurusBPH";
import Laporan from "./pages/Laporan";
import ManajemenUser from "./pages/ManajemenUser";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/struktur" element={<ProtectedRoute><StrukturOrganisasi /></ProtectedRoute>} />
            <Route path="/anggota" element={<ProtectedRoute><DirektoriAnggota /></ProtectedRoute>} />
            <Route path="/anggota/:id" element={<ProtectedRoute><AnggotaDetail /></ProtectedRoute>} />
            <Route path="/bph" element={<ProtectedRoute><PengurusBPH /></ProtectedRoute>} />
            <Route path="/laporan" element={<ProtectedRoute><Laporan /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><ManajemenUser /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
