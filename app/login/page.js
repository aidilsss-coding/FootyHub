"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { FOCUS_RING } from "../components/GameUI";
import Icon from "../components/Icon";

const LABEL = "text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)] mb-1 block";
const INPUT =
  `w-full rounded-[16px] border border-[rgba(26,26,26,.06)] bg-white px-4 py-3 text-[15px] text-[#1A1A1A] outline-none focus:border-[#16A34A] ${FOCUS_RING}`;

// Live password-strength checklist — same rules are used to gate submit.
function getPasswordChecks(password, email, name) {
  const emailLocal = (email || "").split("@")[0].trim().toLowerCase();
  const emailFull = (email || "").trim().toLowerCase();
  const usernameLower = (name || "").trim().toLowerCase();
  const pwLower = password.toLowerCase();
  const matchesIdentity =
    password.length > 0 &&
    (pwLower === emailLocal || pwLower === emailFull || (usernameLower && pwLower === usernameLower));

  return [
    { key: "length", label: "At least 8 characters", ok: password.length >= 8 },
    { key: "upper", label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { key: "lower", label: "One lowercase letter", ok: /[a-z]/.test(password) },
    { key: "number", label: "One number", ok: /[0-9]/.test(password) },
    { key: "special", label: "One special character (!@#$%^&* etc.)", ok: /[^A-Za-z0-9]/.test(password) },
    { key: "distinct", label: "Different from your email/username", ok: password.length > 0 && !matchesIdentity },
  ];
}

function PasswordChecklist({ checks }) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {checks.map((c) => (
        <li key={c.key} className={`flex items-center gap-2 text-xs ${c.ok ? "text-[#16A34A]" : "text-[rgba(26,26,26,.4)]"}`}>
          <span
            className={`flex h-4 w-4 flex-none items-center justify-center rounded-full ${
              c.ok ? "bg-[#16A34A] text-white" : "border border-[rgba(26,26,26,.2)]"
            }`}
          >
            {c.ok && <Icon name="check" className="w-2.5 h-2.5" />}
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = getPasswordChecks(password, email, name);
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password;

  // Username == display name — there's only ever one identity field, so it's
  // validated here the same way the (now read-only) profile display used to.
  function validateUsername(value) {
    const trimmed = value.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      return "Username must be 3-20 characters.";
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return "Only letters, numbers, and underscores allowed.";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (mode === "login") {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Please confirm your email first — check your inbox for the link we sent.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      router.push("/");
    } else {
      const usernameError = validateUsername(name);
      if (usernameError) {
        setErrorMsg(usernameError);
        return;
      }

      if (!passwordChecks.every((c) => c.ok)) {
        setErrorMsg("Password doesn't meet all the requirements below yet.");
        return;
      }

      if (!passwordsMatch) {
        setErrorMsg("Passwords do not match.");
        return;
      }

      setSubmitting(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: name.trim() } },
      });
      setSubmitting(false);

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setInfoMsg("Account created! Check your email to confirm it, then log in below.");
      setMode("login");
    }
  }

  async function handleResendConfirmation() {
    setErrorMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setErrorMsg(error.message);
    } else {
      setInfoMsg("Confirmation email resent — check your inbox.");
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F3E9] font-[family-name:var(--font-display)] text-[#1A1A1A]">
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <span className="text-[17px] font-extrabold uppercase tracking-[-.02em]">Footy Hub</span>
        <h1 className="mt-4 text-2xl font-extrabold text-[#1A1A1A]">
          {mode === "login" ? "Log in" : "Create account"}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4 rounded-[24px] border border-[rgba(26,26,26,.06)] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.05)]"
        >
          {mode === "signup" && (
            <div>
              <label className={LABEL}>Username</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pick a username"
                className={INPUT}
                required
              />
            </div>
          )}

          <div>
            <label className={LABEL}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} required />
          </div>

          <div>
            <label className={LABEL}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
              required
              minLength={8}
            />
            {mode === "signup" && <PasswordChecklist checks={passwordChecks} />}
          </div>

          {mode === "signup" && (
            <div>
              <label className={LABEL}>Repeat password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT}
                required
                minLength={8}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
              )}
            </div>
          )}

          {errorMsg && (
            <div>
              <p className="text-sm text-red-500">{errorMsg}</p>
              {errorMsg.includes("confirm your email") && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  className={`mt-1 text-sm font-extrabold text-[#16A34A] ${FOCUS_RING}`}
                >
                  Resend confirmation email
                </button>
              )}
            </div>
          )}
          {infoMsg && <p className="text-sm text-[#16A34A]">{infoMsg}</p>}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-full bg-[#16A34A] px-[18px] py-[15px] text-[15px] font-extrabold uppercase tracking-[.04em] text-white hover:bg-[#128a3a] active:bg-[#0f7532] disabled:bg-gray-300 ${FOCUS_RING}`}
          >
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrorMsg(""); setInfoMsg(""); }}
          className={`mt-4 block w-full text-center text-[11px] font-extrabold uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`}
        >
          {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
