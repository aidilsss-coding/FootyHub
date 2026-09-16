"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { getOrCreateConversation } from "../lib/conversations";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import { PAGE_WRAP, PageTitle, ROW_CARD, INPUT, FOCUS_RING } from "../components/GameUI";

export default function ChatListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [startingChatWith, setStartingChatWith] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    async function fetchChats() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: hostedGames } = await supabase.from("games").select("*").eq("organizer_id", user.id);
      const { data: bookings } = await supabase.from("bookings").select("games(*)").eq("user_id", user.id);
      const joinedGames = (bookings || []).map((b) => b.games).filter(Boolean);

      const allGamesMap = new Map();
      [...(hostedGames || []), ...joinedGames].forEach((g) => allGamesMap.set(g.id, g));
      const allGames = Array.from(allGamesMap.values()).sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

      setChats(allGames);

      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, user_one, user_two, created_at")
        .or(`user_one.eq.${user.id},user_two.eq.${user.id}`);

      if (convError) {
        console.error("Error fetching conversations:", convError);
      } else if (convData?.length) {
        const otherIds = convData.map((c) => (c.user_one === user.id ? c.user_two : c.user_one));
        const { data: profilesData } = await supabase.from("profiles").select("id, username, avatar_url").in("id", otherIds);
        const nameMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p.username]));
        const avatarMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p.avatar_url]));

        const { data: lastMessages } = await supabase
          .from("direct_messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", convData.map((c) => c.id))
          .order("created_at", { ascending: false });

        const lastByConversation = {};
        (lastMessages || []).forEach((m) => {
          if (!lastByConversation[m.conversation_id]) lastByConversation[m.conversation_id] = m;
        });

        setConversations(
          convData
            .map((c) => {
              const otherId = c.user_one === user.id ? c.user_two : c.user_one;
              return {
                id: c.id,
                otherUsername: nameMap[otherId] || "Player",
                otherAvatarUrl: avatarMap[otherId] || null,
                lastMessage: lastByConversation[c.id]?.content || null,
                sortKey: lastByConversation[c.id]?.created_at || c.created_at,
              };
            })
            .sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey))
        );
      }

      setLoading(false);
    }

    if (!authLoading) {
      fetchChats();
    }
  }, [user, authLoading]);

  function handleQueryChange(value) {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${trimmed}%`)
        .neq("id", user.id)
        .limit(8);
      setSearching(false);

      if (error) {
        console.error("Error searching users:", error);
        return;
      }

      setSearchResults(data || []);
    }, 300);
  }

  async function handleStartChat(otherId) {
    setStartingChatWith(otherId);
    try {
      const conversationId = await getOrCreateConversation(user.id, otherId);
      router.push(`/chat/dm/${conversationId}`);
    } catch (err) {
      console.error("Error starting conversation:", err);
      setStartingChatWith(null);
    }
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading chats..." />;
  }

  if (!user) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
          <PageTitle>Chat</PageTitle>
          <EmptyState icon="lock" title="Log in to view chats" description="Chat with players in your games." actionLabel="Log in" actionHref="/login" />
        </div>
      </div>
    );
  }

  const isSearching = query.trim().length >= 2;

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <PageTitle>Chat</PageTitle>

        <div className="mt-6">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Find a user to message..."
            className={INPUT}
          />
          {searching && <p className="text-xs text-[rgba(26,26,26,.4)] mt-1">Searching...</p>}
        </div>

        {isSearching ? (
          <>
            <h2 className="mt-6 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
              Search results
            </h2>
            {searchResults.length === 0 && !searching ? (
              <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">No users found.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-[10px]">
                {searchResults.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => handleStartChat(p.id)}
                    disabled={startingChatWith === p.id}
                    className={`flex items-center gap-3 p-4 text-left disabled:opacity-50 ${ROW_CARD} ${FOCUS_RING}`}
                  >
                    <Avatar url={p.avatar_url} name={p.username} size={44} />
                    <p className="font-extrabold text-[#1A1A1A] truncate">
                      {startingChatWith === p.id ? "Opening..." : `@${p.username}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
              Direct messages
            </h2>
            {conversations.length === 0 ? (
              <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">
                No direct messages yet, search above to find someone.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-[10px]">
                {conversations.map((c) => (
                  <Link key={c.id} href={`/chat/dm/${c.id}`} className={`flex items-center gap-3 p-4 ${ROW_CARD} ${FOCUS_RING}`}>
                    <Avatar url={c.otherAvatarUrl} name={c.otherUsername} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[#1A1A1A] truncate">@{c.otherUsername}</p>
                      <p className="text-sm text-[rgba(26,26,26,.55)] truncate">{c.lastMessage || "Say hello!"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
              Game chats
            </h2>
            {chats.length === 0 ? (
              <EmptyState icon="chat" title="No game chats yet" description="Join or host a game to start chatting." actionLabel="Browse games" actionHref="/calendar" />
            ) : (
              <div className="mt-4 flex flex-col gap-[10px]">
                {chats.map((game) => (
                  <Link key={game.id} href={`/chat/${game.id}`} className={`flex items-center gap-3 p-4 ${ROW_CARD} ${FOCUS_RING}`}>
                    <div className="w-11 h-11 rounded-full bg-[#E8F5EC] flex items-center justify-center text-[#16A34A] shrink-0">
                      <Icon name="ball" className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[#1A1A1A] truncate">{game.venue}</p>
                      <p className="text-sm text-[rgba(26,26,26,.55)] truncate">{game.format}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
