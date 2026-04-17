
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create org level enum
CREATE TYPE public.org_level AS ENUM ('pusat', 'provinsi', 'kabupaten', 'kecamatan', 'ranting');

-- Create member status enum
CREATE TYPE public.member_status AS ENUM ('aktif', 'nonaktif');

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- USER ROLES TABLE
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- ORG UNITS TABLE (Unified hierarchy)
-- ============================================================
CREATE TABLE public.org_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES public.org_units(id) ON DELETE CASCADE,
  level org_level NOT NULL,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  alamat TEXT,
  telepon TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_org_units_parent ON public.org_units(parent_id);
CREATE INDEX idx_org_units_level ON public.org_units(level);

CREATE POLICY "Org units viewable by authenticated" ON public.org_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert org units" ON public.org_units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update org units" ON public.org_units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete org units" ON public.org_units FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- ANGGOTA TABLE (Unified members)
-- ============================================================
CREATE TABLE public.anggota (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_unit_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  email TEXT,
  telepon TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.anggota ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_anggota_org_unit ON public.anggota(org_unit_id);
CREATE INDEX idx_anggota_status ON public.anggota(status);

CREATE POLICY "Anggota viewable by authenticated" ON public.anggota FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert anggota" ON public.anggota FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update anggota" ON public.anggota FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete anggota" ON public.anggota FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- BPH TABLE (Unified board members)
-- ============================================================
CREATE TABLE public.bph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_unit_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  anggota_id UUID NOT NULL REFERENCES public.anggota(id) ON DELETE CASCADE,
  jabatan TEXT NOT NULL,
  periode_awal DATE NOT NULL,
  periode_akhir DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bph ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_bph_org_unit ON public.bph(org_unit_id);
CREATE INDEX idx_bph_anggota ON public.bph(anggota_id);

CREATE POLICY "BPH viewable by authenticated" ON public.bph FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert bph" ON public.bph FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update bph" ON public.bph FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bph" ON public.bph FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_units_updated_at BEFORE UPDATE ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_anggota_updated_at BEFORE UPDATE ON public.anggota FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bph_updated_at BEFORE UPDATE ON public.bph FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
