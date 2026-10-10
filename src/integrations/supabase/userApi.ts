import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: "Owner" | "Admin" | "Mod" | "User";
  created_at: string;
}

// Staff-only list; the database refuses this for regular users.
export async function fetchAllUsers(): Promise<AppUser[]> {
  const { data, error } = await (supabase as any).rpc("list_users");
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export async function fetchMyRole(): Promise<AppUser["role"] | null> {
  const { data, error } = await (supabase as any).rpc("get_my_role");
  if (error) return null;
  return (data as AppUser["role"]) ?? null;
}

export function useAllUsers(enabled = true) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchAllUsers()
      .then(setUsers)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { users, loading, error };
}
