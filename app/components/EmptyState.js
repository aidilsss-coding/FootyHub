import Link from "next/link";
import { FOCUS_RING } from "./GameUI";
import Icon from "./Icon";

export default function EmptyState({ icon = "ball", title, description, actionLabel, actionHref, dark = false }) {
  return (
    <div className="text-center py-14 px-6 font-[family-name:var(--font-display)]">
      <Icon
        name={icon}
        className={`w-10 h-10 mx-auto mb-3 ${dark ? "text-white/40" : "text-[#16A34A]/60"}`}
      />
      <p className={`font-extrabold uppercase tracking-[-.01em] ${dark ? "text-white" : "text-[#1A1A1A]"}`}>{title}</p>
      {description && (
        <p className={`text-sm mt-1 ${dark ? "text-white/50" : "text-[rgba(26,26,26,.55)]"}`}>{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className={`inline-block mt-4 rounded-full font-extrabold uppercase tracking-[.04em] text-[13px] px-6 py-3 transition-colors ${
            dark ? "bg-[#2FE6B0] text-[#0A0F0D] hover:bg-[#29cf9d]" : "bg-[#16A34A] text-white hover:bg-[#128a3a]"
          } ${FOCUS_RING}`}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
