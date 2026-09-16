// Shared avatar — shows the profile photo when one's set, otherwise falls
// back to an initials circle. The fallback's background color is derived
// deterministically from the username, so the same person always gets the
// same color but different people get visual variety.

const PALETTE = ["#16A34A", "#2563EB", "#D97706", "#DB2777", "#7C3AED", "#0D9488", "#DC2626", "#4F46E5"];

function colorForName(name) {
  const str = name || "?";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsForName(name) {
  const trimmed = (name || "?").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

// `size` sets the pixel diameter; `textSize` is a Tailwind text class for the initials.
export default function Avatar({ url, name, size = 44, textSize = "text-[15px]" }) {
  const style = { width: size, height: size };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || "Avatar"}
        style={style}
        className="rounded-full object-cover shrink-0 bg-[#E8F5EC]"
      />
    );
  }

  return (
    <div
      style={{ ...style, backgroundColor: colorForName(name) }}
      className={`rounded-full flex items-center justify-center font-extrabold text-white shrink-0 ${textSize}`}
    >
      {initialsForName(name)}
    </div>
  );
}
