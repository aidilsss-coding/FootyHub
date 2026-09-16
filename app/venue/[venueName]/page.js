"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { spendCredits, topUpCredits, fetchCreditBalance } from "../../lib/wallet";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import Icon from "../../components/Icon";
import { PAGE_WRAP, ROW_CARD, BACK_LINK } from "../../components/GameUI";
import { CREDITS } from "../../lib/format";

function GameRow({ game, onJoin, alreadyJoined }) {
  const spotsLeft = game.spots_total - game.spots_filled;
  const isFull = spotsLeft <= 0;

  return (
    <div className={`relative p-4 ${ROW_CARD}`}>
      <Link href={`/games/${game.id}`} className="absolute inset-0 rounded-[20px]" aria-label={`View ${game.format} game`} />

      <div className="flex items-start justify-between pointer-events-none">
        <div>
          <p className="font-extrabold text-[#1A1A1A]">{game.format}</p>
          {game.game_date && (
            <p className="text-[rgba(26,26,26,.55)] text-sm mt-1">
              {new Date(game.game_date).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}
              {" · "}
              {new Date(game.game_date).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        <span className="font-extrabold text-[#1A1A1A] tabular-nums">{CREDITS(game.credits_cost)}</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(26,26,26,.06)]">
        <span className={`text-sm font-extrabold pointer-events-none ${isFull ? "text-[rgba(26,26,26,.4)]" : "text-[#16A34A]"}`}>
          {isFull ? "Full" : `${spotsLeft} spots left`}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onJoin(game.id); }}
          disabled={alreadyJoined || isFull}
          className="relative z-10 rounded-full bg-[#16A34A] text-white text-[11px] font-extrabold uppercase tracking-[.06em] px-4 py-1.5 disabled:bg-[rgba(26,26,26,.15)] disabled:text-[rgba(26,26,26,.4)]"
        >
          {alreadyJoined ? "Joined" : isFull ? "Full" : "Join"}
        </button>
      </div>
    </div>
  );
}

export default function VenuePage({ params }) {
  const { user, setCredits } = useAuth();
  const [venueName, setVenueName] = useState(null);
  const [games, setGames] = useState([]);
  const [joinedGameIds, setJoinedGameIds] = useState([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    async function fetchVenue() {
      const { venueName: rawName } = await params;
      const decoded = decodeURIComponent(rawName);
      setVenueName(decoded);

      const { data: gamesData, error } = await supabase
        .from("games")
        .select("*")
        .ilike("venue", decoded)
        .order("game_date", { ascending: true });

      if (error) {
        console.error("Error fetching venue games:", error);
      } else {
        setGames(gamesData);
      }

      if (user) {
        const { data: bookingsData } = await supabase.from("bookings").select("game_id").eq("user_id", user.id);
        setJoinedGameIds((bookingsData || []).map((b) => b.game_id));

        const { data: favData } = await supabase
          .from("favorite_venues")
          .select("id")
          .eq("user_id", user.id)
          .eq("venue", decoded)
          .maybeSingle();
        setIsFavorited(!!favData);
      }

      setLoading(false);
    }
    fetchVenue();
  }, [params, user]);

  async function handleToggleFavorite() {
    if (!user || !venueName) return;

    if (isFavorited) {
      await supabase.from("favorite_venues").delete().eq("user_id", user.id).eq("venue", venueName);
    } else {
      await supabase.from("favorite_venues").insert({ user_id: user.id, venue: venueName });
    }
    setIsFavorited(!isFavorited);
  }

  async function handleJoin(gameId) {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    let spent;
    try {
      spent = await spendCredits({ profileId: user.id, amount: game.credits_cost, gameId: game.id });
    } catch (err) {
      console.error("Error spending credits:", err);
      say("Something went wrong — see console for details.");
      return;
    }

    if (!spent) {
      say("Not enough credits — top up to join.");
      return;
    }

    fetchCreditBalance(user.id).then(setCredits).catch((err) => console.error("Error refetching balance:", err));

    const { error: bookingError } = await supabase.from("bookings").insert({ game_id: gameId, user_id: user.id });
    if (bookingError) {
      console.error("Error creating booking, refunding credits:", bookingError);
      await topUpCredits({ profileId: user.id, amount: game.credits_cost, reference: `refund-game-${game.id}` }).catch((err) => console.error("Error refunding credits:", err));
      fetchCreditBalance(user.id).then(setCredits).catch(() => {});
      say("Something went wrong — your credits were refunded.");
      return;
    }

    const newSpotsFilled = game.spots_filled + 1;
    const { error: updateError } = await supabase.from("games").update({ spots_filled: newSpotsFilled }).eq("id", gameId);
    if (updateError) console.error("Error updating spots:", updateError);

    setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, spots_filled: newSpotsFilled } : g)));
    setJoinedGameIds((prev) => [...prev, gameId]);
    say(`You're in · used ${game.credits_cost} credits`);
  }

  if (loading) {
    return <LoadingState message="Loading venue..." />;
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <Link href="/" className={BACK_LINK}>&larr; Back</Link>

        <div className="flex items-start justify-between mt-4">
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">{venueName}</h1>
          {user && (
            <button onClick={handleToggleFavorite} className="shrink-0 ml-2 text-[#16A34A]">
              <Icon name={isFavorited ? "heartFilled" : "heart"} className="w-6 h-6" />
            </button>
          )}
        </div>
        <p className="text-[rgba(26,26,26,.55)] mt-1 text-sm">
          {games.length} game{games.length !== 1 ? "s" : ""} at this venue
        </p>

        {games.length === 0 ? (
          <EmptyState icon="ball" title="No games here yet" description="Check back later or host one yourself." actionLabel="Host a game" actionHref="/create" />
        ) : (
          <div className="mt-6 flex flex-col gap-[10px]">
            {games.map((game) => (
              <GameRow key={game.id} game={game} onJoin={handleJoin} alreadyJoined={joinedGameIds.includes(game.id)} />
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed inset-x-4 top-[60px] z-[4000] mx-auto max-w-2xl rounded-full bg-[#1A1A1A] px-[18px] py-3 text-xs font-extrabold uppercase tracking-[.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
