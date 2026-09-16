export default function Icon({ name, className }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", className };

  if (name === "home") {
    return (
      <svg {...props}>
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg {...props}>
        <path d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.076-.164-3.02-.465L3 21l1.395-4.185C3.51 15.62 3 13.87 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
      </svg>
    );
  }
  if (name === "ball") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 9l2.85 2.07-1.09 3.36h-3.52l-1.09-3.36z" />
        <path d="M12 9V6M14.85 11.07l2.86-.92M13.76 14.43l1.77 2.42M10.24 14.43l-1.77 2.42M9.15 11.07l-2.86-.92" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...props}>
        <path d="M12 21s7-7.58 7-12A7 7 0 0 0 5 9c0 4.42 7 12 7 12z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...props}>
        <circle cx="8" cy="9" r="3" />
        <path d="M2 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
        <circle cx="16" cy="8" r="2.5" />
        <path d="M14.5 12.5c2.8.3 4.5 2.4 4.5 5.5" />
      </svg>
    );
  }
  if (name === "chevronRight") {
    return (
      <svg {...props}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === "question") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.33c-.82.32-1.4.98-1.4 1.92v.25" />
        <circle cx="12" cy="17" r="0.1" fill="currentColor" />
      </svg>
    );
  }
  if (name === "lock") {
    return (
      <svg {...props}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  if (name === "block") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M6.3 6.3l11.4 11.4" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...props}>
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg {...props}>
        <path d="M12 20s-7-4.35-9.5-8.5C.87 8.15 2.2 4.5 5.6 4.06 8 3.75 10 5 12 7.5c2-2.5 4-3.75 6.4-3.44 3.4.44 4.73 4.1 3.1 7.44C19 15.65 12 20 12 20z" />
      </svg>
    );
  }
  if (name === "heartFilled") {
    return (
      <svg {...props} fill="currentColor" stroke="none">
        <path d="M12 20s-7-4.35-9.5-8.5C.87 8.15 2.2 4.5 5.6 4.06 8 3.75 10 5 12 7.5c2-2.5 4-3.75 6.4-3.44 3.4.44 4.73 4.1 3.1 7.44C19 15.65 12 20 12 20z" />
      </svg>
    );
  }
  return null;
}
