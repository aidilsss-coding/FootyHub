"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { topUpCredits, fetchCreditBalance } from "../../lib/wallet";
import LoadingState from "../../components/LoadingState";
import Icon from "../../components/Icon";
import Avatar from "../../components/Avatar";
import { PAGE_WRAP, CARD, BACK_LINK, PILL_LINK, BTN_DANGER } from "../../components/GameUI";
import { CREDITS, isWithinRefundWindow, cancellationPolicyLabel, timeRange } from "../../lib/format";

export default function GameDetail({ params }) {
  const { user, setCredits } = useAuth();
  const [game, setGame] = useState(null);
  const [organizerName, setOrganizerName] = useState(null);
  const [organizerAvatar, setOrganizerAvatar] = useState(null);
  const [orgName, setOrgName] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    async function resolveParamsAndFetch() {
      const { id } = await params;
      setGameId(id);

      const { data, error } = await supabase.from("games").select("*").eq("id", id).single();

      if (error || !data) {
        console.error("Error fetching game:", error);
        setLoading(false);
        return;
      }

      setGame(data);

      if (data.organizer_id) {
        const { data: profileData } = await supabase.from("profiles").select("username, avatar_url").eq("id", data.organizer_id).maybeSingle();
        setOrganizerName(profileData?.username || null);
        setOrganizerAvatar(profileData?.avatar_url || null);
      }

      if (data.organisation_id) {
        const { data: orgData } = await supabase.from("organisations").select("name").eq("id", data.organisation_id).maybeSingle();
        setOrgName(orgData?.name || null);
      }

      if (user) {
        const { data: favData } = await supabase
          .from("favorite_venues")
          .select("id")
          .eq("user_id", user.id)
          .eq("venue", data.venue)
          .maybeSingle();
        setIsFavorited(!!favData);

        const { data: bookingData } = await supabase
          .from("bookings")
          .select("id")
          .eq("game_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        setBookingId(bookingData?.id || null);
      }

      setLoading(false);
    }
    resolveParamsAndFetch();
  }, [params, user]);

  async function handleToggleFavorite() {
    if (!user || !game) return;

    if (isFavorited) {
      await supabase.from("favorite_venues").delete().eq("user_id", user.id).eq("venue", game.venue);
    } else {
      await supabase.from("favorite_venues").insert({ user_id: user.id, venue: game.venue });
    }
    setIsFavorited(!isFavorited);
  }

  async function handleCancelBooking() {
    if (!user || !game || !bookingId) return;

    // The host's own booking is free (auto-created when they made the game),
    // so cancelling it should never trigger a credit refund.
    const isHostBooking = user.id === game.organizer_id;
    const withinWindow = !isHostBooking && isWithinRefundWindow(game.game_date, game.cancellation_hours);

    const confirmed = window.confirm(
      isHostBooking
        ? "Remove yourself from the player list? You're still the organiser."
        : withinWindow
        ? `Cancel your spot? You'll get ${CREDITS(game.credits_cost)} back.`
        : `Cancel your spot? It's past the ${game.cancellation_hours}h cancellation window, so credits won't be refunded.`
    );
    if (!confirmed) return;

    setCancelling(true);

    const { error: deleteError } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (deleteError) {
      console.error("Error cancelling booking:", deleteError);
      say("Something went wrong — see console for details.");
      setCancelling(false);
      return;
    }

    const newSpotsFilled = Math.max(0, game.spots_filled - 1);
    const { error: spotsError } = await supabase.from("games").update({ spots_filled: newSpotsFilled }).eq("id", game.id);
    if (spotsError) {
      console.error("Error updating spots after cancellation:", spotsError);
    }

    if (withinWindow) {
      try {
        await topUpCredits({ profileId: user.id, amount: game.credits_cost, reference: `refund-cancel-${game.id}` });
        const newBalance = await fetchCreditBalance(user.id);
        setCredits(newBalance);
      } catch (err) {
        console.error("Error refunding credits:", err);
        say("Cancelled, but the refund failed — contact support.");
        setBookingId(null);
        setGame((g) => ({ ...g, spots_filled: newSpotsFilled }));
        setCancelling(false);
        return;
      }
    }

    setBookingId(null);
    setGame((g) => ({ ...g, spots_filled: newSpotsFilled }));
    setCancelling(false);
    say(
      isHostBooking
        ? "You're no longer on the player list"
        : withinWindow
        ? `Cancelled · ${CREDITS(game.credits_cost)} refunded`
        : "Cancelled · no refund (past the window)"
    );
  }

  if (loading) {
    return <LoadingState message="Loading game..." />;
  }

  if (!game) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-2xl px-6 pt-14 pb-16 text-center">
          <Icon name="question" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
          <p className="text-[rgba(26,26,26,.55)]">Game not found.</p>
        </div>
      </div>
    );
  }

  const spotsLeft = game.spots_total - game.spots_filled;
  const isOrganizer = user && game.organizer_id === user.id;
  const dateLabel = game.game_date
    ? new Date(game.game_date).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })
    : null;
  const timeLabel = game.game_date ? timeRange(game.game_date, game.end_date) : null;

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="flex items-center justify-between">
          <Link href="/calendar" className={BACK_LINK}>&larr; Back to all games</Link>
          {isOrganizer && (
            <Link href={`/games/${gameId}/edit`} className={PILL_LINK}>
              Edit game
            </Link>
          )}
        </div>

        <div className={`mt-4 p-6 ${CARD}`}>
          <div className="flex items-start justify-between">
            <Link href={`/venue/${encodeURIComponent(game.venue)}`} className="text-2xl font-extrabold text-[#1A1A1A] hover:text-[#16A34A] transition-colors">
              {game.venue}
            </Link>
            {user && (
              <button onClick={handleToggleFavorite} className="shrink-0 ml-2 text-[#16A34A]">
                <Icon name={isFavorited ? "heartFilled" : "heart"} className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className="text-[rgba(26,26,26,.55)] mt-1 text-xs uppercase tracking-[.08em]">{game.format}</p>

          {game.organisation_id && orgName ? (
            <div className="mt-2">
              <Link href={`/organisations/${game.organisation_id}`} className="block text-lg font-extrabold text-[#16A34A] hover:underline">
                {orgName}
              </Link>
              {organizerName && (
                <Link href={`/u/${organizerName}`} className="flex items-center gap-1.5 text-[11px] uppercase tracking-[.08em] text-[rgba(26,26,26,.45)] mt-1 hover:text-[#16A34A]">
                  <Avatar url={organizerAvatar} name={organizerName} size={18} textSize="text-[8px]" />
                  Hosted by @{organizerName}
                </Link>
              )}
            </div>
          ) : (
            organizerName && (
              <Link href={`/u/${organizerName}`} className={`inline-flex items-center gap-1.5 mt-2 ${PILL_LINK}`}>
                <Avatar url={organizerAvatar} name={organizerName} size={18} textSize="text-[8px]" />
                Hosted by @{organizerName}
              </Link>
            )
          )}

          {dateLabel && (
            <p className="text-[#16A34A] font-extrabold mt-3">{dateLabel} · {timeLabel}</p>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-[rgba(26,26,26,.06)] pt-4">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Price</p>
              <p className="text-xl font-extrabold text-[#1A1A1A] tabular-nums">{CREDITS(game.credits_cost)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Availability</p>
              <p className={`text-xl font-extrabold tabular-nums ${spotsLeft > 0 ? "text-[#16A34A]" : "text-[rgba(26,26,26,.4)]"}`}>
                {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-[rgba(26,26,26,.45)]">
            {cancellationPolicyLabel(game.cancellation_hours)}
          </p>

          {bookingId && (
            <button
              type="button"
              onClick={handleCancelBooking}
              disabled={cancelling}
              className={`mt-4 ${BTN_DANGER}`}
            >
              {cancelling ? "Cancelling..." : "Cancel my spot"}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed inset-x-4 top-[60px] z-[4000] mx-auto max-w-2xl rounded-full bg-[#1A1A1A] px-[18px] py-3 text-xs font-extrabold uppercase tracking-[.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
