"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import { PAGE_WRAP, CARD, ROW_CARD, PageTitle, BTN_NEUTRAL, FOCUS_RING } from "../components/GameUI";

export default function ProfilePage() {
  const { user, loading: authLoading, username, credits, avatarUrl, setAvatarUrl } = useAuth();
  const [hostedGames, setHostedGames] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: gamesData, error: gamesError } = await supabase.from("games").select("*").eq("organizer_id", user.id);
      if (gamesError) {
        console.error("Error fetching hosted games:", gamesError);
      } else {
        setHostedGames(gamesData);
      }

      const { data: orgMemberships, error: orgError } = await supabase
        .from("organisation_members")
        .select("role, organisations(id, name)")
        .eq("profile_id", user.id);
      if (orgError) {
        console.error("Error fetching organisations:", orgError);
      } else {
        setOrganisations((orgMemberships || []).filter((m) => m.organisations));
      }

      setLoading(false);
    }

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadErr) {
      console.error("Error uploading avatar:", uploadErr);
      setUploadError("Upload failed — see console for details.");
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Bust caching so the new image shows immediately everywhere it's used.
    const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateErr } = await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", user.id);
    if (updateErr) {
      console.error("Error saving avatar url:", updateErr);
      setUploadError("Upload succeeded but saving failed — see console for details.");
      setUploading(false);
      return;
    }

    setAvatarUrl(freshUrl);
    setUploading(false);
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  if (!user) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
          <PageTitle>Profile</PageTitle>
          <EmptyState icon="lock" title="Log in to view your profile" description="Manage your account and hosted games." actionLabel="Log in" actionHref="/login" />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <PageTitle>Profile</PageTitle>

        <div className={`mt-4 p-6 ${CARD}`}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar url={avatarUrl} name={username || user.email} size={64} textSize="text-xl" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 rounded-full bg-[#16A34A] text-white w-6 h-6 flex items-center justify-center text-xs font-extrabold shadow-[0_2px_6px_rgba(0,0,0,.25)] disabled:opacity-60"
                aria-label="Change profile picture"
              >
                +
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Logged in as</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#1A1A1A] truncate">{user.email}</p>
            </div>
          </div>
          {uploading && <p className="text-xs text-[rgba(26,26,26,.45)] mt-2">Uploading...</p>}
          {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}

          <div className="mt-4 pt-4 border-t border-[rgba(26,26,26,.06)]">
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Username</p>
            <p className="mt-0.5 font-extrabold text-[#1A1A1A]">{username || "No username set"}</p>
          </div>

          <button onClick={handleLogout} className={`mt-6 ${BTN_NEUTRAL}`}>
            Log out
          </button>
        </div>

        <Link
          href="/wallet"
          className={`mt-4 flex items-center justify-between p-5 ${CARD} hover:bg-[#FBF8F0] ${FOCUS_RING}`}
        >
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Wallet</p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-[#16A34A]">
              {credits} <span className="text-sm text-[rgba(26,26,26,.45)]">credits</span>
            </p>
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-[.06em] text-[#16A34A]">Top up →</span>
        </Link>

        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
            Your organisations
          </h2>
          <Link href="/organisations/create" className={`text-[11px] uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`}>
            + Create
          </Link>
        </div>
        {organisations.length === 0 ? (
          <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">You&apos;re not part of any organisation yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-[10px]">
            {organisations.map((m) => (
              <Link key={m.organisations.id} href={`/organisations/${m.organisations.id}`} className={`block p-4 ${ROW_CARD} ${FOCUS_RING}`}>
                <h3 className="font-extrabold text-[#1A1A1A]">{m.organisations.name}</h3>
                <p className="text-[rgba(26,26,26,.55)] text-sm mt-1 capitalize">{m.role}</p>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
            Games you&apos;re hosting
          </h2>
          <Link href="/create" className={`text-[11px] uppercase tracking-[.1em] text-[#16A34A] ${FOCUS_RING}`}>
            + Create
          </Link>
        </div>
        {hostedGames.length === 0 ? (
          <EmptyState icon="target" title="Not hosting any games yet" description="Create one from the Calendar tab." actionLabel="Host a game" actionHref="/create" />
        ) : (
          <div className="mt-4 flex flex-col gap-[10px]">
            {hostedGames.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`} className={`block p-4 ${ROW_CARD} ${FOCUS_RING}`}>
                <h3 className="font-extrabold text-[#1A1A1A]">{game.venue}</h3>
                <p className="text-[rgba(26,26,26,.55)] text-sm mt-1">
                  {game.format} · {game.spots_filled}/{game.spots_total} joined
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
