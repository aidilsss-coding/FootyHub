import { supabase } from "./supabaseClient";

// Finds the existing 1:1 conversation between two users, or creates one.
// user_one/user_two are always stored in sorted order so a given pair
// can never end up with two separate conversation rows.
export async function getOrCreateConversation(meId, otherId) {
  const [a, b] = [meId, otherId].sort();

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_one", a)
    .eq("user_two", b)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ user_one: a, user_two: b })
    .select()
    .single();

  if (createError) throw createError;
  return created.id;
}
