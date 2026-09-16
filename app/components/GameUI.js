"use client";

// Shared game-signup UI — the bottom sheet, its fact tiles, and the status pill.
// Used by the home page and the calendar page so the join flow looks and
// behaves identically everywhere.

import { CREDITS } from "../lib/format";

export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#16A34A] focus-visible:outline-offset-2";

// Shared page-level building blocks — every page uses these so the whole app
// reads as one system: same font, palette, card/label/input/button shapes.
export const PAGE_WRAP = "min-h-screen bg-[#F7F3E9] font-[family-name:var(--font-display)] text-[#1A1A1A]";

export const CARD = "rounded-[24px] border border-[rgba(26,26,26,.06)] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)]";

export const ROW_CARD =
  "rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)] hover:bg-[#FBF8F0]";

export const LABEL = "block text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)] mb-1";

export const INPUT =
  `w-full rounded-[16px] border border-[rgba(26,26,26,.06)] bg-white px-4 py-3 text-[15px] text-[#1A1A1A] outline-none focus:border-[#16A34A] ${FOCUS_RING}`;

export const BACK_LINK = `inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`;

export const PILL_LINK = `text-[11px] font-extrabold uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`;

export const BTN_PRIMARY =
  `w-full rounded-full bg-[#16A34A] px-[18px] py-[15px] text-[15px] font-extrabold uppercase tracking-[.04em] text-white hover:bg-[#128a3a] active:bg-[#0f7532] disabled:bg-[rgba(26,26,26,.15)] ${FOCUS_RING}`;

export const BTN_NEUTRAL =
  `w-full rounded-full bg-[rgba(26,26,26,.06)] px-[18px] py-[15px] text-[15px] font-extrabold uppercase tracking-[.04em] text-[#1A1A1A] hover:bg-[rgba(26,26,26,.1)] ${FOCUS_RING}`;

export const BTN_DANGER =
  `w-full rounded-full bg-red-50 px-[18px] py-[15px] text-[15px] font-extrabold uppercase tracking-[.04em] text-red-600 hover:bg-red-100 ${FOCUS_RING}`;

export function PageTitle({ children }) {
  return <h1 className="text-[17px] font-extrabold uppercase tracking-[-.02em] text-[#1A1A1A]">{children}</h1>;
}

export function Sheet({ open, onClose, kicker, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 cursor-pointer bg-[rgba(26,26,26,.45)] animate-[fadeIn_.16s_ease-out] ${FOCUS_RING}`}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl overflow-hidden rounded-t-[32px] bg-[#F7F3E9] shadow-[0_-12px_32px_rgba(0,0,0,.18)] animate-[sheetUp_.22s_cubic-bezier(.22,1,.36,1)]">
        <div className="flex items-center justify-between px-5 pb-[10px] pt-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#16A34A]">
            {kicker}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`rounded text-[13px] font-extrabold uppercase text-[rgba(26,26,26,.5)] hover:text-[#1A1A1A] ${FOCUS_RING}`}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Fact({ label, value }) {
  return (
    <div className="flex-1 rounded-[20px] border border-[rgba(26,26,26,.06)] bg-white px-[14px] py-3">
      <p className="text-[9px] uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

/* Status pill. Keep labels to ONE token — two words wrap in the 88px column. */
export function StatusPill({ state, price, position }) {
  const base =
    "inline-block whitespace-nowrap rounded-full text-[10px] font-extrabold uppercase tracking-[.08em]";
  if (state === "joined")
    return <span className={`${base} bg-[#16A34A] px-[9px] py-1 text-white`}>In</span>;
  if (state === "waiting")
    return (
      <span className={`${base} border-[1.5px] border-[#16A34A] px-2 py-[3px] text-[#16A34A]`}>
        Waiting #{position}
      </span>
    );
  if (state === "full")
    return (
      <span className={`${base} border-[1.5px] border-[#16A34A] px-2 py-[3px] text-[#16A34A]`}>
        Waitlist
      </span>
    );
  if (state === "started")
    return (
      <span className={`${base} border-[1.5px] border-[rgba(26,26,26,.25)] px-2 py-[3px] text-[rgba(26,26,26,.45)]`}>
        Started
      </span>
    );
  return <span className={`${base} bg-[#16A34A] px-[9px] py-1 text-white`}>{CREDITS(price)}</span>;
}
