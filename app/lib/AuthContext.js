"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { fetchUnreadChatCount } from "./chatReads";

const AuthContext = createContext(null);

// Every account always ends up with a username in `profiles`, filled in (in
// priority order) from: what's already saved, the name given at signup, or —
// if neither exists, e.g. for older accounts — the email's local part. This
// runs once per login, here, so it's guaranteed regardless of which page the
// user lands on first. Also reads the wallet balance (credits) at the same
// time, since both live on the same profiles row.
async function ensureProfile(user) {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("username, credit_balance, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const credits = profileData?.credit_balance ?? 0;
  const avatarUrl = profileData?.avatar_url ?? null;

  if (profileData?.username) return { username: profileData.username, credits, avatarUrl };

  const metaName = user.user_metadata?.username || user.user_metadata?.full_name || "";
  const emailName = user.email ? user.email.split("@")[0] : "";
  const fallbackName = metaName || emailName;
  if (!fallbackName) return { username: "", credits, avatarUrl };

  // There's no UI to fix this by hand anymore, so a name collision (unique
  // constraint on username) can't be left to fail silently — retry with a
  // short numeric suffix until it sticks.
  let candidate = fallbackName;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("profiles").upsert({ id: user.id, username: candidate });
    if (!error) return { username: candidate, credits, avatarUrl };
    if (error.code !== "23505") return { username: "", credits, avatarUrl };
    candidate = `${fallbackName}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return { username: "", credits, avatarUrl };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [credits, setCredits] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const refreshUnreadChatCount = useCallback((forUser) => {
    const target = forUser ?? user;
    if (!target) {
      setUnreadChatCount(0);
      return;
    }
    fetchUnreadChatCount()
      .then(setUnreadChatCount)
      .catch((err) => console.error("Error fetching unread chat count:", err));
  }, [user]);

  useEffect(() => {
    let ensuredFor = null;

    function syncUser(nextUser) {
      setUser(nextUser);
      if (!nextUser) {
        ensuredFor = null;
        setUsername("");
        setCredits(0);
        setAvatarUrl(null);
        setUnreadChatCount(0);
        return;
      }
      if (ensuredFor === nextUser.id) return;
      ensuredFor = nextUser.id;
      ensureProfile(nextUser).then(({ username: name, credits: bal, avatarUrl: avatar }) => {
        setUsername(name);
        setCredits(bal);
        setAvatarUrl(avatar);
      });
      refreshUnreadChatCount(nextUser);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new messages (chat has no app-wide realtime wiring yet) and
  // refresh whenever the tab regains focus, so the badge doesn't go stale.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => refreshUnreadChatCount(), 20000);
    function onFocus() {
      refreshUnreadChatCount();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, refreshUnreadChatCount]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        username,
        setUsername,
        credits,
        setCredits,
        avatarUrl,
        setAvatarUrl,
        unreadChatCount,
        refreshUnreadChatCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
