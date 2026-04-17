import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login gagal", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: "Registrasi gagal", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Berhasil!", description: "Cek email Anda untuk konfirmasi akun." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-bg px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="glass-surface rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="size-12 rounded-lg bg-primary flex items-center justify-center font-extrabold text-primary-foreground text-sm mx-auto mb-4">
              ORG
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {isLogin ? "Masuk ke Sistem" : "Daftar Akun Baru"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistem Organisasi Nusantara
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@organisasi.id"
                required
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-secondary border-border"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-semibold hover:underline"
            >
              {isLogin ? "Daftar" : "Masuk"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
