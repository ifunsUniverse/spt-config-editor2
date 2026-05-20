import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null; needsEmailVerification: boolean }>;
  updateProfile: (profile: { username: string; displayName?: string | null }) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function normalizeAuthError(error: unknown): string {
  if (!error) return "Authentication failed.";
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Authentication failed.");
  }
  return "Authentication failed.";
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setSession(null);
        setUser(null);
      } else {
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      }
      setLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? normalizeAuthError(error) : null };
      },
      signUp: async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });
        const needsEmailVerification = Boolean(data.user && !data.session);
        return {
          error: error ? normalizeAuthError(error) : null,
          needsEmailVerification,
        };
      },
      updateProfile: async ({ username, displayName }) => {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            username,
            display_name: displayName ?? "",
          },
        });

        if (data.user) {
          setUser(data.user);
        }

        // Refresh session to ensure latest data is synced
        if (!error) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            setUser(sessionData.session.user);
          }
        }

        return { error: error ? normalizeAuthError(error) : null };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        return { error: error ? normalizeAuthError(error) : null };
      },
    }),
    [loading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
