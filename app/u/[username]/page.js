"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import { getOrCreateConversation } from "../../lib/conversations";
import LoadingState from "../../components/LoadingState";
import Icon from "../../components/Icon";
import Avatar from "../../components/Avatar";
import { PAGE_WRAP, CARD, ROW_CARD, FOCUS_RING } from "../../components/GameUI";

export default function PublicProfile({ params }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [hostedGames, setHostedGames] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const { username } = await params;

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle();

      if (error || !profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: gamesData } = await supabase.from("games").select("*").eq("organizer_id", profileData.id);
      setHostedGames(gamesData || []);

      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileData.id);
      setFollowerCount(count || 0);

      if (currentUser) {
        const { data: followData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", currentUser.id)
          .eq("following_id", profileData.id)
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      setLoading(false);
    }
    fetchProfile();
  }, [params, currentUser]);

  async function handleToggleFollow() {
    if (!currentUser || !profile) return;
    setToggling(true);

    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profile.id);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUser.id, following_id: profile.id });
      setFollowerCount((c) => c + 1);
    }

    setIsFollowing(!isFollowing);
    setToggling(false);
  }

  async function handleMessage() {
    if (!currentUser || !profile) return;
    setMessaging(true);

    try {
      const conversationId = await getOrCreateConversation(currentUser.id, profile.id);
      router.push(`/chat/dm/${conversationId}`);
    } catch (err) {
      console.error("Error starting conversation:", err);
      setMessaging(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading profile..." />;
  }

  if (!profile) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-2xl px-6 pt-14 pb-16 text-center">
          <Icon name="question" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
          <p className="text-[rgba(26,26,26,.55)]">User not found.</p>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === profile.id;

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className={`p-6 ${CARD}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar url={profile.avatar_url} name={profile.username} size={56} textSize="text-lg" />
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-[#1A1A1A] truncate">{profile.username}</h1>
                <p className="text-sm text-[rgba(26,26,26,.55)] mt-1">
                  {followerCount} follower{followerCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {!isOwnProfile && currentUser && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className={`rounded-full px-5 py-2 text-[11px] font-extrabold uppercase tracking-[.06em] bg-[rgba(26,26,26,.06)] text-[#1A1A1A] hover:bg-[rgba(26,26,26,.1)] disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {messaging ? "..." : "Message"}
                </button>
                <button
                  onClick={handleToggleFollow}
                  disabled={toggling}
                  className={`rounded-full px-5 py-2 text-[11px] font-extrabold uppercase tracking-[.06em] transition-colors ${
                    isFollowing
                      ? "bg-[rgba(26,26,26,.06)] text-[#1A1A1A] hover:bg-[rgba(26,26,26,.1)]"
                      : "bg-[#16A34A] text-white hover:bg-[#128a3a]"
                  } ${FOCUS_RING}`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            )}
          </div>
        </div>

        <h2 className="mt-6 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">Hosted games</h2>
        {hostedGames.length === 0 ? (
          <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">No games hosted yet.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-[10px]">
            {hostedGames.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`} className={`block p-4 ${ROW_CARD} ${FOCUS_RING}`}>
                <h3 className="font-extrabold text-[#1A1A1A]">{game.venue}</h3>
                <p className="text-[rgba(26,26,26,.55)] text-sm mt-1">{game.format}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
