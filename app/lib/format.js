// Shared formatting helpers — used by any page that shows a game (home, calendar, …)
// so dates/prices read identically everywhere.

export const MYR = (n) => `RM${n}`;

// Games are priced in credits (1 credit = RM1 when you top up your wallet).
// MYR above is only used where real money actually changes hands — buying
// credits on the wallet page.
export const CREDITS = (n) => `${n} credit${n === 1 ? "" : "s"}`;

export const time24 = (d) =>
  new Date(d).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });

// Games have a start (game_date) and an optional end (end_date). Falls back
// to just the start time when there's no end set.
export const timeRange = (start, end) => (end ? `${time24(start)}–${time24(end)}` : time24(start));

export const dayShort = (d) =>
  new Date(d).toLocaleDateString("en-MY", { weekday: "short", day: "numeric" });

export const dateBig = (d) =>
  new Date(d).toLocaleDateString("en-MY", { day: "numeric", month: "short" }).toUpperCase();

// Cancellation policy — organisers set games.cancellation_hours (default 24)
// when they create a game. Cancelling before the deadline refunds credits;
// cancelling after it doesn't.
export function cancellationDeadline(gameDate, cancellationHours) {
  return new Date(new Date(gameDate).getTime() - cancellationHours * 60 * 60 * 1000);
}

export function isWithinRefundWindow(gameDate, cancellationHours) {
  return new Date() <= cancellationDeadline(gameDate, cancellationHours);
}

export function cancellationPolicyLabel(cancellationHours) {
  if (cancellationHours % 24 === 0) {
    const days = cancellationHours / 24;
    return `Cancel up to ${days} day${days === 1 ? "" : "s"} before kickoff for a full refund`;
  }
  return `Cancel up to ${cancellationHours}h before kickoff for a full refund`;
}

export function getKickoffLabel(gameDate) {
  const diffMs = new Date(gameDate) - new Date();
  if (diffMs <= 0) return "Starting soon";
  const diffMins = diffMs / 60000;
  if (diffMins < 60) {
    const mins = Math.round(diffMins);
    return `Kickoff in ${mins} min${mins !== 1 ? "s" : ""}`;
  }
  const diffHours = diffMins / 60;
  if (diffHours < 24) {
    const hrs = Math.round(diffHours);
    return `Kickoff in ${hrs} hour${hrs !== 1 ? "s" : ""}`;
  }
  const days = Math.round(diffHours / 24);
  return `Kickoff in ${days} day${days !== 1 ? "s" : ""}`;
}
