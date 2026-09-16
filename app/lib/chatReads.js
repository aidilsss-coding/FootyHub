// Read/unread tracking for chat — backs the badge on the bottom-nav Chat
// icon. See supabase/migrations/20260919_chat_read_tracking.sql for the
// schema (conversations.user_one/two_last_read_at + game_chat_reads table +
// the get_unread_chat_count() RPC that adds both up in one round trip).
import { supabase } from "./supabaseClient";

export async function fetchUnreadChatCount() {
  const { data, error } = await supabase.rpc("get_unread_chat_count");
  if (error) throw error;
  return data ?? 0;
}

// Per-chat breakdown (see 20260920_unread_chat_breakdown.sql) — used to badge
// individual rows on the chat list, not just the nav icon's running total.
// Returns { dm: { [conversationId]: count }, game: { [gameId]: count } }.
export async function fetchUnreadChatBreakdown() {
  const { data, error } = await supabase.rpc("get_unread_chat_breakdown");
  if (error) throw error;

  const breakdown = { dm: {}, game: {} };
  for (const row of data || []) {
    if (row.kind === "dm") breakdown.dm[row.ref_id] = row.unread_count;
    else if (row.kind === "game") breakdown.game[row.ref_id] = row.unread_count;
  }
  return breakdown;
}

export async function markConversationRead(conversationId, isUserOne) {
  const column = isUserOne ? "user_one_last_read_at" : "user_two_last_read_at";
  const { error } = await supabase
    .from("conversations")
    .update({ [column]: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function markGameChatRead(gameId, userId) {
  const { error } = await supabase
    .from("game_chat_reads")
    .upsert({ game_id: gameId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "game_id,user_id" });
  if (error) throw error;
}
