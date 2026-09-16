"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/AuthContext";
import LoadingState from "../../../components/LoadingState";
import Icon from "../../../components/Icon";
import { PAGE_WRAP, CARD, PageTitle, LABEL, INPUT, BTN_PRIMARY, BTN_DANGER } from "../../../components/GameUI";

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditGame({ params }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gameId, setGameId] = useState(null);
  const [game, setGame] = useState(null);
  const [venue, setVenue] = useState("");
  const [format, setFormat] = useState("5-a-side");
  const [price, setPrice] = useState("");
  const [spotsTotal, setSpotsTotal] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cancellationHours, setCancellationHours] = useState("24");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchGame() {
      const { id } = await params;
      setGameId(id);

      const { data, error } = await supabase.from("games").select("*").eq("id", id).single();

      if (error || !data) {
        setErrorMsg("Game not found.");
      } else {
        setGame(data);
        setVenue(data.venue);
        setFormat(data.format);
        setPrice(String(data.credits_cost));
        setSpotsTotal(String(data.spots_total));
        setGameDate(data.game_date ? toDatetimeLocalValue(new Date(data.game_date)) : "");
        setEndDate(data.end_date ? toDatetimeLocalValue(new Date(data.end_date)) : "");
        setCancellationHours(String(data.cancellation_hours ?? 24));
      }
      setLoading(false);
    }
    fetchGame();
  }, [params]);

  async function handleSave(e) {
    e.preventDefault();
    setErrorMsg("");

    if (endDate && gameDate && new Date(endDate) <= new Date(gameDate)) {
      setErrorMsg("End time must be after the start time.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("games").update({
      venue,
      format,
      credits_cost: Number(price),
      spots_total: Number(spotsTotal),
      cancellation_hours: Number(cancellationHours),
      game_date: gameDate ? new Date(gameDate).toISOString() : null,
      end_date: endDate ? new Date(endDate).toISOString() : null,
    }).eq("id", gameId);

    setSaving(false);

    if (error) {
      console.error("Error saving game changes:", error);
      setErrorMsg(`Failed to save changes: ${error.message}`);
      return;
    }

    router.push(`/games/${gameId}`);
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this game permanently? This can't be undone.");
    if (!confirmed) return;

    const { error } = await supabase.from("games").delete().eq("id", gameId);

    if (error) {
      console.error("Error deleting game:", error);
      setErrorMsg(`Failed to delete game: ${error.message}`);
      return;
    }

    router.push("/calendar");
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (!game) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16 text-center">
          <Icon name="question" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
          <p className="text-[rgba(26,26,26,.55)]">{errorMsg || "Game not found."}</p>
        </div>
      </div>
    );
  }

  if (!user || game.organizer_id !== user.id) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-md px-6 pt-14 pb-16 text-center">
          <Icon name="block" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
          <p className="text-[rgba(26,26,26,.55)]">You don&apos;t have permission to edit this game.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <PageTitle>Edit game</PageTitle>

        <form onSubmit={handleSave} className={`mt-6 flex flex-col gap-4 p-6 ${CARD}`}>
          <div>
            <label className={LABEL}>Venue</label>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} className={INPUT} required />
          </div>

          <div>
            <label className={LABEL}>Start time</label>
            <input type="datetime-local" value={gameDate} onChange={(e) => setGameDate(e.target.value)} className={INPUT} required />
          </div>

          <div>
            <label className={LABEL}>End time</label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} min={gameDate || undefined} />
          </div>

          <div>
            <label className={LABEL}>Format</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={parseInt(format, 10) || ""}
                onChange={(e) => {
                  const n = e.target.value.replace(/[^0-9]/g, "");
                  setFormat(n ? `${n}-a-side` : "");
                }}
                placeholder="e.g. 5"
                className={`${INPUT} w-24 text-center`}
                required
              />
              <span className="text-sm font-bold text-[rgba(26,26,26,.55)]">a-side — any number you like</span>
            </div>
          </div>

          <div>
            <label className={LABEL}>Credits</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} required />
          </div>

          <div>
            <label className={LABEL}>Total spots</label>
            <input type="number" value={spotsTotal} onChange={(e) => setSpotsTotal(e.target.value)} className={INPUT} required />
          </div>

          <div>
            <label className={LABEL}>Cancellation policy (hours before kickoff)</label>
            <input
              type="number"
              min="0"
              value={cancellationHours}
              onChange={(e) => setCancellationHours(e.target.value)}
              className={INPUT}
              required
            />
            <p className="text-xs text-[rgba(26,26,26,.4)] mt-1">
              Players who cancel at least this many hours before kickoff get their credits back.
            </p>
          </div>

          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        <button onClick={handleDelete} className={`mt-4 ${BTN_DANGER}`}>
          Delete game
        </button>
      </div>
    </div>
  );
}
