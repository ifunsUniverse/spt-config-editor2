import { supabase } from "@/integrations/supabase/client";
import type { AppUser } from "./userApi";

// Owner-only actions, checked inside the database.
export async function updateUserRole(userId: string, newRole: AppUser["role"]): Promise<void> {
  const { error } = await (supabase as any).rpc("admin_set_user_role", { _user_id: userId, _role: newRole });
  if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("admin_delete_user", { _user_id: userId });
  if (error) throw error;
}
