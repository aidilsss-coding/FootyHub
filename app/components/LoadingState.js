export default function LoadingState({ message = "Loading...", dark = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 min-h-screen font-[family-name:var(--font-display)] ${
        dark ? "bg-[#0A0F0D] text-white/50" : "bg-[#F7F3E9] text-[rgba(26,26,26,.4)]"
      }`}
    >
      <div className={`w-8 h-8 border-2 rounded-full animate-spin mb-3 ${dark ? "border-white/15 border-t-[#2FE6B0]" : "border-[rgba(26,26,26,.1)] border-t-[#16A34A]"}`} />
      <p className="text-[11px] font-extrabold uppercase tracking-[.1em]">{message}</p>
    </div>
  );
}
