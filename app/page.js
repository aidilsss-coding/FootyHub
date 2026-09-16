"use client";

/**
 * Footy Hub — Home screen redesign.
 * Implementation for app/page.js.
 *
 * Two behaviour changes vs today:
 *   1. The match fee is charged at signup — paying IS joining.
 *   2. Full games offer a free waitlist spot instead of blocking.
 * No player ratings. Reputation is games played + turn-up %.
 *
 * Existing Supabase queries are preserved verbatim from the current page.
 * Payments are stubbed client-side (per product decision) — see handlePay()
 * below and TODO(payments) for what a real PSP integration replaces.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabaseClient";
import { useAuth } from "./lib/AuthContext";
import LoadingState from "./components/LoadingState";
import EmptyState from "./components/EmptyState";
import Icon from "./components/Icon";
import Avatar from "./components/Avatar";
import { Sheet, Fact, StatusPill, FOCUS_RING, BTN_PRIMARY } from "./components/GameUI";
import { CREDITS, time24, timeRange, dayShort, dateBig, getKickoffLabel, cancellationPolicyLabel } from "./lib/format";
import { spendCredits, topUpCredits, fetchCreditBalance } from "./lib/wallet";

/* pitch-line overlay, lifted from the current hero */
function PitchLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[.18]"
      viewBox="0 0 402 260"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect x="-70" y="-10" width="150" height="190" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="-100" y="-5" width="120" height="120" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="330" cy="50" r="70" fill="none" stroke="#fff" strokeWidth="2" />
      <line x1="330" y1="-20" x2="330" y2="280" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function Home() {
  const { user, loading: authLoading, username, credits, setCredits, avatarUrl } = useAuth();
  const [myGames, setMyGames] = useState([]);
  const [openGames, setOpenGames] = useState([]);
  const [favoriteVenues, setFavoriteVenues] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [joinedGameIds, setJoinedGameIds] = useState([]);
  const [waitlist, setWaitlist] = useState({});           // { [gameId]: position }
  const [stats, setStats] = useState({ games: null, turnUp: null });
  const [loading, setLoading] = useState(true);

  const [sheetGame, setSheetGame] = useState(null);
  const [pendingGame, setPendingGame] = useState(null);   // game being paid for
  const [toast, setToast] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    async function fetchHome() {
      if (!user) return setLoading(false);

      // username itself is resolved and persisted once, app-wide, by
      // AuthContext — this just needs the stats columns.
      const { data: profileData } = await supabase
        .from("profiles")
        .select("games_played, no_shows")  // TODO(schema): new columns — see README SQL
        .eq("id", user.id)
        .maybeSingle();

      setStats({
        games: profileData?.games_played ?? null,
        turnUp: profileData?.games_played
          ? Math.round((1 - (profileData.no_shows ?? 0) / profileData.games_played) * 100)
          : null,
      });

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("game_id, games(*)")
        .eq("user_id", user.id);
      const mine = (bookingsData || [])
        .map((b) => b.games)
        .filter(Boolean)
        .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
      setMyGames(mine);
      setJoinedGameIds(mine.map((g) => g.id));

      // TODO(schema): waitlist table — see README SQL
      const { data: wl } = await supabase
        .from("waitlist")
        .select("game_id, position")
        .eq("user_id", user.id);
      setWaitlist(Object.fromEntries((wl || []).map((w) => [w.game_id, w.position])));

      const { data: open } = await supabase
        .from("games")
        .select("*")
        .not("game_date", "is", null)
        .gte("game_date", new Date().toISOString())
        .order("game_date")
        .limit(6);
      setOpenGames(open || []);

      const { data: favData, error: favError } = await supabase
        .from("favorite_venues")
        .select("venue")
        .eq("user_id", user.id);
      if (favError) {
        console.error("Error fetching favorite venues:", favError);
      } else {
        setFavoriteVenues((favData || []).map((f) => f.venue));
      }

      // friend activity — unchanged from the current implementation
      const { data: followingData } = await supabase
        .from("follows").select("following_id").eq("follower_id", user.id);
      const followingIds = (followingData || []).map((f) => f.following_id);
      if (followingIds.length) {
        const { data: profilesData } = await supabase
          .from("profiles").select("id, username").in("id", followingIds);
        const nameMap = Object.fromEntries(
          (profilesData || []).map((p) => [p.id, p.username || "Someone"])
        );
        const { data: friendBookings } = await supabase
          .from("bookings").select("user_id, created_at, games(*)")
          .in("user_id", followingIds).order("created_at", { ascending: false }).limit(10);
        const { data: friendHosted } = await supabase
          .from("games").select("*")
          .in("organizer_id", followingIds).order("created_at", { ascending: false }).limit(10);
        setFeedItems(
          [
            ...(friendBookings || []).filter((b) => b.games).map((b) => ({
              type: "joined", timestamp: b.created_at, name: nameMap[b.user_id] || "Someone", game: b.games,
            })),
            ...(friendHosted || []).map((g) => ({
              type: "hosted", timestamp: g.created_at, name: nameMap[g.organizer_id] || "Someone", game: g,
            })),
          ]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 6)
        );
      }

      setLoading(false);
    }
    if (!authLoading) fetchHome();
  }, [user, authLoading]);

  /* Sheet CTA: full game → free waitlist spot; open game → hand off to payment. */
  async function handleSheetAction() {
    console.log("[join] button clicked, sheetGame =", sheetGame);
    const g = sheetGame;
    if (!g) {
      console.log("[join] no sheetGame set, aborting");
      return;
    }
    if (joinedGameIds.includes(g.id) || waitlist[g.id]) {
      console.log("[join] already joined or waitlisted, closing sheet");
      return setSheetGame(null);
    }

    if (g.spots_total - g.spots_filled <= 0) {
      console.log("[join] game is full, joining waitlist instead");
      const { count } = await supabase
        .from("waitlist").select("*", { count: "exact", head: true }).eq("game_id", g.id);
      const position = (count || 0) + 1;
      await supabase.from("waitlist").insert({ game_id: g.id, user_id: user.id, position });
      setWaitlist((w) => ({ ...w, [g.id]: position }));
      setSheetGame(null);
      say(`Waitlist joined · you're #${position}`);
      return;
    }

    console.log("[join] open game, handing off to payment step");
    setSheetGame(null);
    setPendingGame(g);
  }

  /*
   * Payment step — spend_credits() atomically checks the balance and
   * deducts server-side; only if it returns true do we go ahead and create
   * the booking. If the booking insert then fails, the spend is reversed
   * via add_credits() so the user isn't left out of pocket.
   *
   * TODO(payments): add_credits() is still called directly from the client
   * for top-ups (see lib/wallet.js) — fine for reviewing the product end to
   * end, but a real PSP integration should move that behind a webhook.
   */
  async function handlePay() {
    console.log("[pay] button clicked, pendingGame =", pendingGame);
    const g = pendingGame;
    if (!g) {
      console.log("[pay] no pendingGame set, aborting");
      return;
    }

    console.log("[pay] calling spend_credits for", g.credits_cost, "credits, game", g.id);
    let spent;
    try {
      spent = await spendCredits({ profileId: user.id, amount: g.credits_cost, gameId: g.id });
    } catch (err) {
      console.error("[pay] Error calling spend_credits:", err);
      say("Something went wrong — see console for details.");
      return;
    }
    console.log("[pay] spend_credits returned", spent);

    if (!spent) {
      console.log("[pay] insufficient credits, aborting");
      say("Not enough credits — top up to join.");
      return;
    }

    fetchCreditBalance(user.id).then(setCredits).catch((err) => console.error("[pay] Error refetching balance:", err));

    console.log("[pay] inserting booking for game", g.id, "user", user.id);
    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .insert({ game_id: g.id, user_id: user.id })
      .select();
    console.log("[pay] booking insert result:", { bookingData, bookingError });

    if (bookingError) {
      console.error("[pay] Error creating booking, refunding credits:", bookingError);
      try {
        await topUpCredits({ profileId: user.id, amount: g.credits_cost, reference: `refund-game-${g.id}` });
        fetchCreditBalance(user.id).then(setCredits).catch(() => {});
      } catch (refundErr) {
        console.error("[pay] Error refunding credits:", refundErr);
      }
      say("Something went wrong — your credits were refunded.");
      return;
    }

    const newSpotsFilled = g.spots_filled + 1;
    console.log("[pay] updating spots_filled to", newSpotsFilled);
    const { error: updateError } = await supabase.from("games").update({ spots_filled: newSpotsFilled }).eq("id", g.id);
    console.log("[pay] spots update result:", { updateError });

    if (updateError) {
      console.error("[pay] Error updating spots:", updateError);
      say("Booked, but failed to update spots — see console.");
    }

    setOpenGames((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, spots_filled: newSpotsFilled } : x))
    );
    setJoinedGameIds((prev) => [...prev, g.id]);
    setPendingGame(null);
    console.log("[pay] done, showing success toast");
    say(`You're in · used ${CREDITS(g.credits_cost)}`);
  }

  if (loading || authLoading) return <LoadingState message="Loading your home..." />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F3E9]">
        <div className="mx-auto max-w-2xl px-6 pt-10">
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">Home</h1>
          <EmptyState
            icon="lock"
            title="Log in to see your home feed"
            description="Track games, favorite venues, and friend activity."
            actionLabel="Log in"
            actionHref="/login"
          />
        </div>
      </div>
    );
  }

  const now = new Date();
  const nextGame = myGames.find((g) => g.game_date && new Date(g.game_date) > now) || null;
  const firstName = (username || "").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#F7F3E9] pb-[120px] font-[family-name:var(--font-display)] text-[#1A1A1A]">
      <div className="mx-auto max-w-2xl">

        {/* app bar */}
        <div className="flex items-center justify-between px-5 pb-[14px] pt-[10px]">
          <span className="text-[17px] font-extrabold uppercase tracking-[-.02em]">Footy Hub</span>
          <div className="flex items-center gap-[10px]">
            <Link
              href="/wallet"
              className={`flex items-center gap-1 rounded-full bg-[#E8F5EC] px-3 py-1.5 text-[11px] font-extrabold text-[#16A34A] hover:bg-[#dcefe2] ${FOCUS_RING}`}
            >
              {credits} credits
            </Link>
            <span className="text-[11px] uppercase tracking-[.1em] text-[rgba(26,26,26,.5)]">
              {firstName}
            </span>
            <Link href="/profile" className={`block rounded-full ${FOCUS_RING}`}>
              <Avatar url={avatarUrl} name={firstName || username} size={32} textSize="text-[13px]" />
            </Link>
          </div>
        </div>

        {/* hero */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,#1F6E3D_0%,#2E8B4F_55%,#45A868_100%)] px-[22px] pb-[22px] pt-6 text-white">
            <PitchLines />
            <div className="relative">
              {nextGame ? (
                <>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-white/85">
                    {getKickoffLabel(nextGame.game_date)}
                  </p>
                  <h1 className="mt-[10px] text-[40px] font-extrabold uppercase leading-[.92] tracking-[-.035em]">
                    {nextGame.venue}
                  </h1>
                  <p className="mt-[10px] text-xs uppercase tracking-[.1em] text-white/85">
                    {nextGame.format}
                  </p>
                  <div className="mt-5 grid grid-cols-3 border-t border-white/30 pt-[14px]">
                    {[
                      ["Kickoff", time24(nextGame.game_date)],
                      ["Date", dateBig(nextGame.game_date)],
                      ["Fee", CREDITS(nextGame.credits_cost)],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <p className="text-[9px] uppercase tracking-[.14em] text-white/80">{l}</p>
                        <p className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-[-.02em]">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-[18px] flex gap-2">
                    <Link
                      href={`/venue/${encodeURIComponent(nextGame.venue)}`}
                      className={`flex-1 rounded-full bg-white px-4 py-[11px] text-center text-[13px] font-extrabold uppercase text-[#16A34A] hover:bg-[#E8F5EC] ${FOCUS_RING}`}
                    >
                      Directions
                    </Link>
                    <Link
                      href={`/chat/${nextGame.id}`}
                      className={`flex-1 rounded-full border-[1.5px] border-white/60 bg-white/[.14] px-4 py-[11px] text-center text-[13px] font-extrabold uppercase text-white hover:bg-white/[.26] ${FOCUS_RING}`}
                    >
                      Squad chat
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-white/85">
                    Welcome back
                  </p>
                  <h1 className="mt-[10px] text-[40px] font-extrabold uppercase leading-[.92] tracking-[-.035em]">
                    {firstName ? `${firstName}` : "Hey there"}
                  </h1>
                  <p className="mt-4 text-sm text-white/80">
                    No upcoming games, there are {openGames.length} open near you.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* stats — no ratings, only observed facts */}
        <div className="flex gap-[10px] px-4 pt-4">
          {[
            ["Games played", stats.games ?? "—"],
            ["Turn up", stats.turnUp != null ? `${stats.turnUp}%` : "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex-1 rounded-[24px] border border-[rgba(26,26,26,.06)] bg-white px-[15px] py-[13px] shadow-[0_1px_2px_rgba(0,0,0,.05)]"
            >
              <p className="text-[26px] font-extrabold tabular-nums tracking-[-.03em]">{value}</p>
              <p className="text-[9px] uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">{label}</p>
            </div>
          ))}
        </div>

        {/* open near you */}
        <div className="flex items-baseline justify-between px-5 pb-[10px] pt-5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em]">Open near you</h2>
          <Link
            href="/calendar"
            className={`rounded text-[11px] uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`}
          >
            See all
          </Link>
        </div>

        {openGames.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon="calendar"
              title="No games open right now"
              description="Host one and your squad will see it."
              actionLabel="Create a game"
              actionHref="/create"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-[10px] px-4">
            {openGames.map((g) => {
              const spotsLeft = g.spots_total - g.spots_filled;
              const state = joinedGameIds.includes(g.id)
                ? "joined"
                : waitlist[g.id]
                ? "waiting"
                : spotsLeft <= 0
                ? "full"
                : "open";
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => setSheetGame(g)}
                  className={`flex min-h-[68px] w-full items-stretch overflow-hidden rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#FBF8F0] ${FOCUS_RING}`}
                >
                  <span className="w-[74px] shrink-0 py-[14px] pl-4">
                    <span className="block text-[19px] font-extrabold tabular-nums tracking-[-.02em]">
                      {time24(g.game_date)}
                    </span>
                    <span className="block text-[9px] uppercase tracking-[.1em] text-[rgba(26,26,26,.45)]">
                      {dayShort(g.game_date)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 px-[10px] py-[14px]">
                    <span className="block truncate text-[15px] font-extrabold tracking-[-.01em]">
                      {g.venue}
                    </span>
                    <span className="block text-[11px] text-[rgba(26,26,26,.55)]">
                      {g.format} · {CREDITS(g.credits_cost)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center pl-2 pr-4">
                    <StatusPill state={state} price={g.credits_cost} position={waitlist[g.id]} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* favourite venues */}
        {favoriteVenues.length > 0 && (
          <>
            <div className="px-5 pb-[10px] pt-5">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em]">Favourite venues</h2>
            </div>
            <div className="flex flex-col gap-[10px] px-4">
              {favoriteVenues.map((venue) => (
                <Link
                  key={venue}
                  href={`/venue/${encodeURIComponent(venue)}`}
                  className={`flex items-center gap-3 rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#FBF8F0] ${FOCUS_RING}`}
                >
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E8F5EC] text-[#16A34A]">
                    <Icon name="pin" className="w-4 h-4" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[#1A1A1A]">{venue}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* activity */}
        {feedItems.length > 0 && (
          <>
            <div className="px-5 pb-[10px] pt-5">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em]">Activity</h2>
            </div>
            <div className="flex flex-col gap-[10px] px-4">
              {feedItems.map((item, i) => (
                <Link
                  key={i}
                  href={`/games/${item.game.id}`}
                  className={`flex items-center gap-3 rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#FBF8F0] ${FOCUS_RING}`}
                >
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E8F5EC] text-[13px] font-extrabold text-[#16A34A]">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[9px] uppercase tracking-[.14em] ${
                        item.type === "hosted" ? "text-[#16A34A]" : "text-[rgba(26,26,26,.45)]"
                      }`}
                    >
                      {item.type === "hosted" ? "Hosting" : "Joined"}
                    </p>
                    <p className="truncate text-[13px] font-semibold">
                      @{item.name} · {item.game.venue}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* game sheet */}
      <Sheet
        open={!!sheetGame}
        onClose={() => setSheetGame(null)}
        kicker={
          sheetGame && sheetGame.spots_total - sheetGame.spots_filled <= 0
            ? "Game full · waitlist"
            : "Open game"
        }
      >
        {sheetGame && (() => {
          const spotsLeft = sheetGame.spots_total - sheetGame.spots_filled;
          const isFull = spotsLeft <= 0;
          const joined = joinedGameIds.includes(sheetGame.id);
          const waiting = waitlist[sheetGame.id];
          return (
            <>
              <div className="px-5">
                <h3 className="text-[28px] font-extrabold uppercase leading-none tracking-[-.03em]">
                  {sheetGame.venue}
                </h3>
                <p className="mt-2 text-xs uppercase tracking-[.08em] text-[rgba(26,26,26,.55)]">
                  {sheetGame.format}
                </p>
              </div>
              <div className="flex gap-[10px] px-4 pt-4">
                <Fact label="Kickoff" value={timeRange(sheetGame.game_date, sheetGame.end_date)} />
                <Fact label="Fee" value={CREDITS(sheetGame.credits_cost)} />
                <Fact label="Spots" value={isFull ? "Full" : `${spotsLeft} left`} />
              </div>
              {isFull && (
                <p className="px-5 pt-3 text-xs leading-[1.5] text-[rgba(26,26,26,.65)]">
                  This game is full. You&apos;ll be pushed in automatically if someone drops, and
                  only charged then.
                </p>
              )}
              <div className="px-4 pb-7 pt-[14px]">
                <button
                  type="button"
                  onClick={handleSheetAction}
                  className={`w-full rounded-full bg-[#16A34A] px-[18px] py-[15px] text-[15px] font-extrabold uppercase tracking-[.04em] text-white hover:bg-[#128a3a] active:bg-[#0f7532] ${FOCUS_RING}`}
                >
                  {joined
                    ? `You're in · used ${CREDITS(sheetGame.credits_cost)}`
                    : waiting
                    ? `On the waitlist — #${waiting}`
                    : isFull
                    ? "Join waitlist · no credits used yet"
                    : `Use ${CREDITS(sheetGame.credits_cost)} · join`}
                </button>
              </div>
            </>
          );
        })()}
      </Sheet>

      {/* confirm sheet — joining spends credits from the wallet */}
      <Sheet open={!!pendingGame} onClose={() => setPendingGame(null)} kicker="Confirm signup">
        {pendingGame && (() => {
          const canAfford = credits >= pendingGame.credits_cost;
          return (
            <>
              <div className="px-5">
                <h3 className="text-[44px] font-extrabold leading-none tabular-nums tracking-[-.04em]">
                  {CREDITS(pendingGame.credits_cost)}
                </h3>
                <p className="mt-2 text-xs uppercase tracking-[.08em] text-[rgba(26,26,26,.55)]">
                  Spent from your wallet · charged when you join
                </p>
              </div>
              <div className="flex gap-[10px] px-4 pt-4">
                <Fact label="Balance" value={credits} />
                <Fact label="After" value={canAfford ? credits - pendingGame.credits_cost : "—"} />
              </div>
              <div className="px-4 pt-4">
                <div className="overflow-hidden rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white">
                  <div className="flex justify-between border-b border-[rgba(26,26,26,.07)] px-4 py-3 text-[13px]">
                    <span>{pendingGame.venue} · {timeRange(pendingGame.game_date, pendingGame.end_date)}</span>
                    <span className="font-extrabold tabular-nums">{CREDITS(pendingGame.credits_cost)}</span>
                  </div>
                  <div className="px-4 py-3 text-[13px] text-[rgba(26,26,26,.55)]">
                    {cancellationPolicyLabel(pendingGame.cancellation_hours)}
                  </div>
                </div>
              </div>
              {!canAfford && (
                <p className="px-5 pt-3 text-xs leading-[1.5] text-red-500">
                  You&apos;re {pendingGame.credits_cost - credits} credits short. Top up your wallet to join.
                </p>
              )}
              <div className="px-4 pb-7 pt-[14px]">
                {canAfford ? (
                  <button type="button" onClick={handlePay} className={BTN_PRIMARY}>
                    Use {CREDITS(pendingGame.credits_cost)} to join
                  </button>
                ) : (
                  <Link href="/wallet" className={BTN_PRIMARY}>
                    Top up your wallet
                  </Link>
                )}
              </div>
            </>
          );
        })()}
      </Sheet>

      {toast && (
        <div className="fixed inset-x-4 top-[60px] z-[4000] mx-auto max-w-2xl rounded-full bg-[#1A1A1A] px-[18px] py-3 text-xs font-extrabold uppercase tracking-[.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
