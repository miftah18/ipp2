import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'moderator' | 'user';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  userRole: UserRole | null;
  orgUnitId: string | null;
  managedOrgUnits: string[] | null;
  hierarchyLevel: number | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  userRole: null,
  orgUnitId: null,
  managedOrgUnits: null,
  hierarchyLevel: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null);
  const [managedOrgUnits, setManagedOrgUnits] = useState<string[] | null>(null);
  const [hierarchyLevel, setHierarchyLevel] = useState<number | null>(null);

  const loadUserHierarchyData = async (userId: string) => {
    try {
      // Fetch user role dan hierarchy data dari database
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, org_unit_id, managed_org_units, hierarchy_level')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user hierarchy data:', error);
        setIsAdmin(false);
        setUserRole('user');
        setOrgUnitId(null);
        setManagedOrgUnits(null);
        setHierarchyLevel(null);
        return;
      }

      const role = data?.role as UserRole || 'user';
      setUserRole(role);
      setIsAdmin(role === 'admin');
      setOrgUnitId(data?.org_unit_id || null);
      setManagedOrgUnits(data?.managed_org_units || null);
      setHierarchyLevel(data?.hierarchy_level || null);
    } catch (err) {
      console.error('Error in loadUserHierarchyData:', err);
      setIsAdmin(false);
      setUserRole('user');
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await loadUserHierarchyData(session.user.id);
        } else {
          setIsAdmin(false);
          setUserRole(null);
          setOrgUnitId(null);
          setManagedOrgUnits(null);
          setHierarchyLevel(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await loadUserHierarchyData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setUserRole(null);
    setOrgUnitId(null);
    setManagedOrgUnits(null);
    setHierarchyLevel(null);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        session, 
        user: session?.user ?? null, 
        isAdmin, 
        userRole,
        orgUnitId,
        managedOrgUnits,
        hierarchyLevel,
        loading, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
