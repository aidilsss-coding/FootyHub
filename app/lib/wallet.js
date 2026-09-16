import { supabase } from "./supabaseClient";

// Spends credits via the atomic spend_credits() Postgres function — it
// checks the balance and deducts in one step server-side, so there's no
// read-then-write race like a client-side balance check would have.
// Returns true if the spend succeeded, false if the balance was too low.
export async function spendCredits({ profileId, amount, gameId, bookingId = null }) {
  const { data, error } = await supabase.rpc("spend_credits", {
    p_profile_id: profileId,
    p_amount: amount,
    p_game_id: gameId,
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return data === true;
}

// Adds credits via the add_credits() Postgres function.
//
// TODO(payments): called directly from the client for now — a placeholder
// so the credits flow can be tested end to end before a payment gateway
// exists. Once one's wired up, this should move behind a webhook so only a
// trusted server can ever increase a balance.
export async function topUpCredits({ profileId, amount, reference }) {
  const { error } = await supabase.rpc("add_credits", {
    p_profile_id: profileId,
    p_amount: amount,
    p_reference: reference,
  });
  if (error) throw error;
}

export async function fetchCreditBalance(profileId) {
  const { data, error } = await supabase.from("profiles").select("credit_balance").eq("id", profileId).maybeSingle();
  if (error) throw error;
  return data?.credit_balance ?? 0;
}
