"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import LoadingState from "../../components/LoadingState";
import Icon from "../../components/Icon";
import { FOCUS_RING } from "../../components/GameUI";

export default function ChatRoom({ params }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gameId, setGameId] = useState(null);
  const [game, setGame] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { gameId: id } = await params;
      setGameId(id);

      const { data: gameData } = await supabase.from("games").select("*").eq("id", id).single();
      setGame(gameData);

      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("id, content, created_at, user_id, profiles(username)")
        .eq("game_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(messagesData);
      }

      setLoading(false);
    }
    init();
  }, [params]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`chat-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` },
        async (payload) => {
          const { data: profileData } = await supabase.from("profiles").select("username").eq("id", payload.new.user_id).single();
          setMessages((prev) => [...prev, { ...payload.new, profiles: profileData }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      game_id: gameId,
      user_id: user.id,
      content: newMessage.trim(),
    });
    setSending(false);

    if (error) {
      console.error("Error sending message:", error);
      return;
    }

    setNewMessage("");
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading chat..." />;
  }

  if (!user) {
    return <LoadingState message="Redirecting..." />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F7F3E9] font-[family-name:var(--font-display)] text-[#1A1A1A]">
      <div className="shrink-0 bg-white border-b border-[rgba(26,26,26,.06)] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/chat")} className={`text-[#16A34A] text-xl rounded ${FOCUS_RING}`}>&larr;</button>
        <div>
          <p className="font-extrabold text-[#1A1A1A]">{game?.venue}</p>
          <p className="text-xs uppercase tracking-[.08em] text-[rgba(26,26,26,.5)]">{game?.format}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center py-14">
            <Icon name="chat" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
            <p className="text-[rgba(26,26,26,.55)] text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => {
              const isMine = msg.user_id === user.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  {!isMine && (
                    <span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[rgba(26,26,26,.4)] mb-0.5 ml-1">
                      {msg.profiles?.username || "Player"}
                    </span>
                  )}
                  <div className={`max-w-[75%] rounded-[20px] px-4 py-2 ${isMine ? "bg-[#16A34A] text-white" : "bg-white border border-[rgba(26,26,26,.06)]"}`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="shrink-0 bg-white border-t border-[rgba(26,26,26,.06)] p-3 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className={`flex-1 rounded-full bg-white border border-[rgba(26,26,26,.06)] px-4 py-2 outline-none focus:border-[#16A34A] ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className={`rounded-full bg-[#16A34A] text-white font-extrabold uppercase tracking-[.04em] text-sm px-5 hover:bg-[#128a3a] disabled:bg-[rgba(26,26,26,.15)] ${FOCUS_RING}`}
        >
          Send
        </button>
      </form>
    </div>
  );
}
