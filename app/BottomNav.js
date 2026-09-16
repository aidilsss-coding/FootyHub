"use client";

/**
 * Footy Hub — flattened tab bar for app/components/BottomNav.js.
 *
 * OPTIONAL. The current BottomNav is two pills plus a raised centre globe
 * FAB. This redesign flattens that into one five-up floating pill with Map
 * as an ordinary tab. If you'd rather keep the FAB, don't swap this in —
 * nothing else in page.js depends on it, it's a standalone replacement.
 *
 * Usage: render at the bottom of the root layout (app/layout.js), inside
 * the same max-w-2xl / 16px-gutter container the pages use, so it lines up
 * with page content edge-to-edge.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Home", href: "/" },
  { label: "Games", href: "/calendar" },
  { label: "Map", href: "/map" },
  { label: "Chat", href: "/chat" },
  { label: "You", href: "/profile" },
];

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#16A34A] focus-visible:outline-offset-2";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] mx-auto max-w-2xl px-4 pb-[10px]">
      <div className="grid grid-cols-5 rounded-full border border-[rgba(26,26,26,.06)] bg-[rgba(255,255,255,.96)] p-[6px] shadow-[0_8px_20px_rgba(0,0,0,.08)]">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-1 py-[9px] text-center text-[9px] font-extrabold uppercase tracking-[.1em] ${
                active ? "bg-[#E8F5EC] text-[#16A34A]" : "text-[rgba(26,26,26,.45)]"
              } ${FOCUS_RING}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
