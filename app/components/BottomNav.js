"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const leftTabs = [
  { href: "/", icon: "home" },
  { href: "/calendar", icon: "calendar" },
];

const rightTabs = [
  { href: "/chat", icon: "chat" },
  { href: "/profile", icon: "profile" },
];

function TabButton({ tab, isActive }) {
  return (
    <Link
      href={tab.href}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
        isActive ? "bg-[#16A34A]/10 text-[#16A34A]" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      <Icon name={tab.icon} className="w-5 h-5" />
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const isMapActive = pathname === "/map";

  // Hide the nav inside an open chat room (game or DM) — its fixed message
  // input sits right where the nav would, and there's already a back arrow.
  const inChatRoom = pathname !== "/chat" && pathname.startsWith("/chat/");
  if (inChatRoom) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[2000] pb-6 pt-2 px-6">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-black/5 rounded-full px-2 py-2 shadow-lg">
          {leftTabs.map((tab) => (
            <TabButton key={tab.href} tab={tab} isActive={pathname === tab.href} />
          ))}
        </div>

        <Link
          href="/map"
          className={`w-16 h-16 -mt-6 rounded-full flex items-center justify-center shadow-lg border-4 border-[#F7F3E9] transition-colors ${
            isMapActive ? "bg-[#16A34A]" : "bg-white"
          }`}
        >
          <Icon name="globe" className={`w-7 h-7 ${isMapActive ? "text-white" : "text-gray-400"}`} />
        </Link>

        <div className="flex items-center gap-1 bg-white/95 backdrop-blur border border-black/5 rounded-full px-2 py-2 shadow-lg">
          {rightTabs.map((tab) => (
            <TabButton key={tab.href} tab={tab} isActive={pathname === tab.href} />
          ))}
        </div>
      </div>
    </nav>
  );
}
