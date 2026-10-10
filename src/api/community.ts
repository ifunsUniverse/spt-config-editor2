// Community board data access. Permissions are enforced by database policies and functions;
// this file only shapes requests.
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function listSuggestions() {
  const { data, error } = await db.from("suggestions").select("*").order("votes", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listBugReports() {
  const { data, error } = await db.from("bug_reports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMyVotes(): Promise<Set<string>> {
  const { data, error } = await db.from("suggestion_votes").select("suggestion_id");
  if (error) throw error;
  return new Set((data ?? []).map((r: { suggestion_id: string }) => r.suggestion_id));
}

export async function upvoteSuggestion(id: string): Promise<number> {
  const { data, error } = await db.rpc("upvote_suggestion", { _suggestion_id: id });
  if (error) throw error;
  return data as number;
}

export async function insertSuggestions(rows: Record<string, unknown>[]) {
  const { data, error } = await db.from("suggestions").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function insertBugReports(rows: Record<string, unknown>[]) {
  const { data, error } = await db.from("bug_reports").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function deleteSuggestions(ids: string[]) {
  const { error } = await db.from("suggestions").delete().in("id", ids);
  if (error) throw error;
}

export async function deleteBugReports(ids: string[]) {
  const { error } = await db.from("bug_reports").delete().in("id", ids);
  if (error) throw error;
}

export async function updateBugStatus(id: string, status: string, note?: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" && note) patch.resolution_note = note;
  const { error } = await db.from("bug_reports").update(patch).eq("id", id);
  if (error) throw error;
}
