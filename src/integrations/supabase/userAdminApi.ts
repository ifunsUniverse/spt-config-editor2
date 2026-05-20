import { supabase } from "@/integrations/supabase/client";
import type { AppUser } from "./userApi";

export async function updateUserRole(userId: string, newRole: AppUser["role"]): Promise<void> {
  const { error } = await supabase.from("users").update({ role: newRole }).eq("id", userId);
  if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}
