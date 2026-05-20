import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: "Owner" | "Admin" | "Mod" | "User";
  created_at: string;
}

export async function fetchAllUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from("users").select("id, email, username, role, created_at");
  if (error) throw error;
  return data as AppUser[];
}

export function useAllUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllUsers()
      .then(setUsers)
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { users, loading, error };
}
