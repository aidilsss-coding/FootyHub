"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import LoadingState from "../components/LoadingState";
import Icon from "../components/Icon";
import { Sheet, Fact, StatusPill, FOCUS_RING, PAGE_WRAP, CARD, PageTitle, BTN_PRIMARY } from "../components/GameUI";
import { CREDITS, time24, timeRange, cancellationPolicyLabel } from "../lib/format";
import { spendCredits, topUpCredits, fetchCreditBalance } from "../lib/wallet";

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildWeekDays(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function buildMonthWeeks(anchor) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const gridStart = getMonday(firstOfMonth);
  const lastDay = lastOfMonth.getDay();
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (lastDay === 0 ? 0 : 7 - lastDay));

  const weeks = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    weeks.push(buildWeekDays(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekRow({ week, gamesByDay, today, selectedDate, onSelect, anchorMonth, anchorYear }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {week.map((date) => {
        const key = dateKey(date);
        const dayGames = gamesByDay[key] || [];
        const gameCount = dayGames.length;
        const isToday = dateKey(today) === key;
        const isSelected = selectedDate && dateKey(selectedDate) === key;
        const inMonth = date.getMonth() === anchorMonth && date.getFullYear() === anchorYear;

        return (
          <button
            key={key}
            onClick={() => onSelect(date)}
            className={`rounded-[16px] px-1 py-2.5 text-center transition-colors
              ${isSelected ? "bg-[#16A34A] text-white" : isToday ? "bg-[rgba(26,26,26,.06)]" : "bg-white border border-[rgba(26,26,26,.06)] hover:bg-[#FBF8F0]"}`}
          >
            <p className={`text-[9px] font-extrabold uppercase tracking-wide ${isSelected ? "text-white/85" : inMonth ? "text-[rgba(26,26,26,.4)]" : "text-[rgba(26,26,26,.2)]"}`}>
              {WEEKDAY_LABELS[date.getDay()]}
            </p>
            <p className={`text-lg font-extrabold tabular-nums leading-tight mt-0.5 ${isSelected ? "text-white" : inMonth ? "text-[#1A1A1A]" : "text-[rgba(26,26,26,.2)]"}`}>
              {date.getDate()}
            </p>
            <p className={`text-[11px] font-extrabold mt-0.5 ${
              gameCount === 0
                ? isSelected ? "text-white/40" : "text-[rgba(26,26,26,.2)]"
                : isSelected ? "text-white" : inMonth ? "text-[#16A34A]" : "text-[rgba(26,26,26,.2)]"
            }`}>
              {gameCount === 0 ? "—" : gameCount}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default function CalendarPage() {
  const { user, loading: authLoading, credits, setCredits } = useAuth();
  const [games, setGames] = useState([]);
  const [joinedGameIds, setJoinedGameIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [navDir, setNavDir] = useState(0);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const [beforeH, setBeforeH] = useState(0);
  const [afterH, setAfterH] = useState(0);

  const [waitlist, setWaitlist] = useState({}); // { [gameId]: position }
  const [sheetGame, setSheetGame] = useState(null);
  const [pendingGame, setPendingGame] = useState(null); // game being paid for
  const [toast, setToast] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Re-measure on every render so the expand/collapse animation always targets
  // the current content height (week count, games per day, etc. can all change it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setBeforeH(beforeRef.current ? beforeRef.current.scrollHeight : 0);
    setAfterH(afterRef.current ? afterRef.current.scrollHeight : 0);
  });

  useEffect(() => {
    async function fetchData() {
      const { data: gamesData, error: gamesError } = await supabase.from("games").select("*").not("game_date", "is", null);
      if (gamesError) {
        console.error("Error fetching games:", gamesError);
      } else {
        setGames(gamesData);
      }

      if (user) {
        const { data: bookingsData, error: bookingsError } = await supabase.from("bookings").select("game_id").eq("user_id", user.id);
        if (!bookingsError) {
          setJoinedGameIds(bookingsData.map((b) => b.game_id));
        }

        const { data: wl } = await supabase
          .from("waitlist")
          .select("game_id, position")
          .eq("user_id", user.id);
        setWaitlist(Object.fromEntries((wl || []).map((w) => [w.game_id, w.position])));
      }

      setLoading(false);
    }

    if (!authLoading) {
      fetchData();
    }
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

    setGames((prev) => prev.map((x) => (x.id === g.id ? { ...x, spots_filled: newSpotsFilled } : x)));
    setJoinedGameIds((prev) => [...prev, g.id]);
    setPendingGame(null);
    console.log("[pay] done, showing success toast");
    say(`You're in · used ${CREDITS(g.credits_cost)}`);
  }

  function step(direction) {
    setNavDir(direction);
    setViewDate((prev) => {
      const d = new Date(prev);
      if (expanded) {
        d.setMonth(d.getMonth() + direction);
      } else {
        d.setDate(d.getDate() + direction * 7);
      }
      return d;
    });
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading calendar..." />;
  }

  const gamesByDay = {};
  games.forEach((game) => {
    const key = dateKey(new Date(game.game_date));
    if (!gamesByDay[key]) gamesByDay[key] = [];
    gamesByDay[key].push(game);
  });

  const monday = getMonday(viewDate);
  const days = buildWeekDays(monday);
  const weekEnd = days[6];
  const weekLabel =
    monday.getMonth() === weekEnd.getMonth()
      ? `${monday.toLocaleDateString("en-MY", { day: "numeric" })} – ${weekEnd.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })}`
      : `${monday.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`;
  const monthLabel = monday.toLocaleDateString("en-MY", { month: "long", year: "numeric" });

  const monthWeeks = buildMonthWeeks(monday);
  const currentIndex = monthWeeks.findIndex((week) => dateKey(week[0]) === dateKey(monday));
  const beforeWeeks = currentIndex > 0 ? monthWeeks.slice(0, currentIndex) : [];
  const afterWeeks = currentIndex >= 0 ? monthWeeks.slice(currentIndex + 1) : [];

  const today = new Date();

  const selectedGames = selectedDate
    ? [...(gamesByDay[dateKey(selectedDate)] || [])].sort((a, b) => new Date(a.game_date) - new Date(b.game_date))
    : [];

  return (
    <div className={`${PAGE_WRAP} relative`}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-24">
      <div className="flex items-center justify-between">
        <PageTitle>Calendar</PageTitle>
        <Link
          href="/wallet"
          className={`flex items-center gap-1 rounded-full bg-[#E8F5EC] px-3 py-1.5 text-[11px] font-extrabold text-[#16A34A] hover:bg-[#dcefe2] ${FOCUS_RING}`}
        >
          {credits} credits
        </Link>
      </div>

      <div className={`mt-4 p-3 ${CARD}`}>
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => step(-1)}
            className={`w-8 h-8 rounded-full hover:bg-[rgba(26,26,26,.06)] text-[rgba(26,26,26,.5)] ${FOCUS_RING}`}
          >
            &larr;
          </button>
          <span className="font-extrabold text-[#1A1A1A] text-sm">{expanded ? monthLabel : weekLabel}</span>
          <button
            onClick={() => step(1)}
            className={`w-8 h-8 rounded-full hover:bg-[rgba(26,26,26,.06)] text-[rgba(26,26,26,.5)] ${FOCUS_RING}`}
          >
            &rarr;
          </button>
        </div>

        <div
          key={dateKey(monday)}
          className={navDir === 1 ? "slide-in-right" : navDir === -1 ? "slide-in-left" : ""}
        >
          <div
            ref={beforeRef}
            style={{ maxHeight: expanded ? beforeH : 0 }}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          >
            <div className="flex flex-col gap-2 pb-2">
              {beforeWeeks.map((week) => (
                <WeekRow key={dateKey(week[0])} week={week} gamesByDay={gamesByDay} today={today} selectedDate={selectedDate} onSelect={setSelectedDate} anchorMonth={monday.getMonth()} anchorYear={monday.getFullYear()} />
              ))}
            </div>
          </div>

          <WeekRow week={days} gamesByDay={gamesByDay} today={today} selectedDate={selectedDate} onSelect={setSelectedDate} anchorMonth={monday.getMonth()} anchorYear={monday.getFullYear()} />

          <div
            ref={afterRef}
            style={{ maxHeight: expanded ? afterH : 0 }}
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          >
            <div className="flex flex-col gap-2 pt-2">
              {afterWeeks.map((week) => (
                <WeekRow key={dateKey(week[0])} week={week} gamesByDay={gamesByDay} today={today} selectedDate={selectedDate} onSelect={setSelectedDate} anchorMonth={monday.getMonth()} anchorYear={monday.getFullYear()} />
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={`mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[rgba(26,26,26,.4)] hover:text-[#1A1A1A] ${FOCUS_RING}`}
        >
          {expanded ? "Show week" : "Show month"}
          <span className={`inline-block transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>&#9662;</span>
        </button>
      </div>

      {selectedDate && (
        <div className="mt-6 zoom-in">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[rgba(26,26,26,.5)] mb-3">
            {selectedDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
          </h2>

          {selectedGames.length === 0 ? (
            <p className="text-[rgba(26,26,26,.55)] text-sm text-center py-6">No games scheduled this day.</p>
          ) : (() => {
            const PX_PER_MIN = 1.4;
            const DEFAULT_DURATION_MIN = 60;

            const events = selectedGames.map((g) => {
              const start = new Date(g.game_date);
              const end = g.end_date ? new Date(g.end_date) : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000);
              return { game: g, start, end };
            });

            const rangeStart = new Date(Math.min(...events.map((e) => e.start.getTime())));
            rangeStart.setMinutes(0, 0, 0);
            const latestEnd = new Date(Math.max(...events.map((e) => e.end.getTime())));
            const rangeEnd = new Date(latestEnd);
            if (rangeEnd.getMinutes() > 0 || rangeEnd.getSeconds() > 0) {
              rangeEnd.setHours(rangeEnd.getHours() + 1, 0, 0, 0);
            }

            const containerHeight = ((rangeEnd - rangeStart) / 60000) * PX_PER_MIN;

            const hourMarks = [];
            for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += 3600000) {
              hourMarks.push(new Date(t));
            }

            // Fixed real-time axis — events keep their actual start/end, so
            // overlapping games genuinely overlap instead of being spread
            // into even, misleading gaps.
            const sorted = [...events].sort((a, b) => a.start - b.start);
            const columnsEnd = [];
            let maxColumns = 0;
            const positioned = sorted.map((e) => {
              let col = columnsEnd.findIndex((end) => end <= e.start);
              if (col === -1) {
                col = columnsEnd.length;
                columnsEnd.push(e.end);
              } else {
                columnsEnd[col] = e.end;
              }
              maxColumns = Math.max(maxColumns, columnsEnd.length);
              return { ...e, col };
            });

            const isToday = dateKey(selectedDate) === dateKey(new Date());
            const now = new Date();
            const nowTop = ((now - rangeStart) / 60000) * PX_PER_MIN;
            const showNowLine = isToday && now >= rangeStart && now <= rangeEnd;

            const STATE_STYLES = {
              open: { border: "#16A34A", bg: "#FFFFFF" },
              joined: { border: "#128a3a", bg: "#F0FBF3" },
              waiting: { border: "#D97706", bg: "#FFFBEB" },
              full: { border: "#9CA3AF", bg: "#FAFAFA" },
            };

            return (
              <div className="flex" style={{ height: containerHeight + 16 }}>
                <div className="relative w-12 shrink-0">
                  {hourMarks.map((h) => (
                    <span
                      key={h.toISOString()}
                      className="absolute right-2 -translate-y-1/2 text-[9px] font-extrabold uppercase tracking-wide tabular-nums text-[rgba(26,26,26,.35)]"
                      style={{ top: ((h - rangeStart) / 60000) * PX_PER_MIN }}
                    >
                      {time24(h)}
                    </span>
                  ))}
                </div>

                <div className="relative flex-1">
                  {hourMarks.map((h) => (
                    <div
                      key={h.toISOString()}
                      className="absolute left-0 right-0 border-t border-dashed border-[rgba(22,163,74,.14)]"
                      style={{ top: ((h - rangeStart) / 60000) * PX_PER_MIN }}
                    />
                  ))}

                  {showNowLine && (
                    <div className="absolute left-0 right-0 z-20 flex items-center gap-1" style={{ top: nowTop }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ec3013] shrink-0" />
                      <span className="h-px flex-1 bg-[#ec3013]/50" />
                    </div>
                  )}

                  {positioned.map(({ game: g, start, end, col }, i) => {
                    const top = ((start - rangeStart) / 60000) * PX_PER_MIN;
                    const height = Math.max(((end - start) / 60000) * PX_PER_MIN, 44);
                    const spotsLeft = g.spots_total - g.spots_filled;
                    const state = joinedGameIds.includes(g.id)
                      ? "joined"
                      : waitlist[g.id]
                      ? "waiting"
                      : spotsLeft <= 0
                      ? "full"
                      : "open";
                    const colors = STATE_STYLES[state];
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => setSheetGame(g)}
                        className={`zoom-in absolute flex items-center gap-2 overflow-hidden rounded-[14px] border-l-[3px] p-2 text-left shadow-[0_1px_3px_rgba(0,0,0,.08)] transition-colors hover:brightness-[.98] ${FOCUS_RING}`}
                        style={{
                          top,
                          height,
                          left: `${(col / maxColumns) * 100}%`,
                          width: `calc(${100 / maxColumns}% - 6px)`,
                          borderLeftColor: colors.border,
                          background: colors.bg,
                          animationDelay: `${i * 45}ms`,
                          animationFillMode: "backwards",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 font-extrabold text-[12px] leading-snug text-[#1A1A1A] truncate">
                            <Icon name="ball" className="w-3 h-3 shrink-0 text-[#16A34A]" />
                            {g.venue}
                          </p>
                          <p className="text-[10px] text-[rgba(26,26,26,.55)] truncate">
                            {timeRange(g.game_date, g.end_date)}
                          </p>
                          {height > 62 && (
                            <span className="mt-1 block text-[9px] font-extrabold uppercase text-[rgba(26,26,26,.4)]">{g.format}</span>
                          )}
                        </div>
                        {height > 62 && (
                          <span className="shrink-0">
                            <StatusPill state={state} price={g.credits_cost} position={waitlist[g.id]} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <Link
        href="/create"
        className={`fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-[#16A34A] text-white text-3xl flex items-center justify-center shadow-lg hover:bg-[#128a3a] transition-colors ${FOCUS_RING}`}
      >
        +
      </Link>

      {/* game sheet — identical to the home page's join flow */}
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
    </div>
  );
}
