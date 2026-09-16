"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { PAGE_WRAP, CARD, PageTitle, LABEL, INPUT, BACK_LINK, BTN_PRIMARY } from "../components/GameUI";

export default function CreateGame() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [venue, setVenue] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const [format, setFormat] = useState("5-a-side");
  const [price, setPrice] = useState("");
  const [spotsTotal, setSpotsTotal] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cancellationHours, setCancellationHours] = useState("24");
  const [joinAsPlayer, setJoinAsPlayer] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Organisations this user can post games under (leader or founder of).
  const [postableOrgs, setPostableOrgs] = useState([]);
  const [postAsOrgId, setPostAsOrgId] = useState("");

  useEffect(() => {
    async function fetchPostableOrgs() {
      if (!user) return;
      const { data, error } = await supabase
        .from("organisation_members")
        .select("organisation_id, role, organisations(id, name)")
        .eq("profile_id", user.id)
        .in("role", ["leader", "founder"]);

      if (error) {
        console.error("Error fetching organisations:", error);
        return;
      }

      setPostableOrgs((data || []).filter((m) => m.organisations).map((m) => m.organisations));
    }
    fetchPostableOrgs();
  }, [user]);

  function handleVenueChange(value) {
    setVenue(value);
    setLat(null);
    setLng(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data);
        setShowResults(true);
      } catch (err) {
        console.error("Location search failed:", err);
      }
      setSearching(false);
    }, 500);
  }

  function handleSelectResult(result) {
    setVenue(result.display_name.split(",")[0]);
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setSearchResults([]);
    setShowResults(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (endDate && new Date(endDate) <= new Date(gameDate)) {
      setErrorMsg("End time must be after the start time.");
      return;
    }

    setSubmitting(true);

    // If joinAsPlayer is on, the host counts as a player from the start —
    // spots_filled starts at 1 and a booking is created for them below
    // (free; they don't spend credits to join their own game).
    const { data: newGame, error } = await supabase
      .from("games")
      .insert({
        venue,
        format,
        credits_cost: Number(price),
        spots_total: Number(spotsTotal),
        spots_filled: joinAsPlayer ? 1 : 0,
        organizer_id: user.id,
        organisation_id: postAsOrgId || null,
        cancellation_hours: Number(cancellationHours),
        game_date: new Date(gameDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        lat,
        lng,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating game:", error);
      setSubmitting(false);
      setErrorMsg(`Something went wrong: ${error.message}`);
      return;
    }

    if (joinAsPlayer) {
      const { error: hostBookingError } = await supabase
        .from("bookings")
        .insert({ game_id: newGame.id, user_id: user.id });

      if (hostBookingError) {
        // Game already exists at this point — not fatal, just means the
        // host won't show up as joined until this is fixed up.
        console.error("Error adding host as a player:", hostBookingError);
      }
    }

    setSubmitting(false);
    router.push("/calendar");
  }

  if (authLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (!user) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-md px-6 pt-10 pb-16">
          <PageTitle>Host a game</PageTitle>
          <EmptyState icon="lock" title="Log in to host a game" description="You need an account to create games." actionLabel="Log in" actionHref="/login" />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <Link href="/calendar" className={BACK_LINK}>&larr; Back to all games</Link>
        <div className="mt-4">
          <PageTitle>Host a game</PageTitle>
        </div>

        <form onSubmit={handleSubmit} className={`mt-6 flex flex-col gap-4 p-6 ${CARD}`}>
          {postableOrgs.length > 0 && (
            <div>
              <label className={LABEL}>Post as</label>
              <select value={postAsOrgId} onChange={(e) => setPostAsOrgId(e.target.value)} className={INPUT}>
                <option value="">Yourself</option>
                {postableOrgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <label className={LABEL}>Venue / location</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => handleVenueChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              className={INPUT}
              placeholder="Start typing a place name..."
              required
              autoComplete="off"
            />
            {searching && <p className="text-xs text-[rgba(26,26,26,.4)] mt-1">Searching...</p>}

            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[rgba(26,26,26,.06)] rounded-[16px] shadow-[0_8px_20px_rgba(0,0,0,.08)] max-h-56 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-[#FBF8F0] border-b border-[rgba(26,26,26,.06)] last:border-0"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}

            {lat && lng ? (
              <p className="flex items-center gap-1 text-xs font-extrabold text-[#16A34A] mt-1">
                Pinned on map <Icon name="check" className="w-3 h-3" />
              </p>
            ) : (
              <p className="text-xs text-[rgba(26,26,26,.4)] mt-1">Select a result to pin this on the map</p>
            )}
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
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT} placeholder="e.g. 12" required />
          </div>

          <div>
            <label className={LABEL}>Total spots</label>
            <input type="number" value={spotsTotal} onChange={(e) => setSpotsTotal(e.target.value)} className={INPUT} required />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-[16px] border border-[rgba(26,26,26,.06)] bg-white px-4 py-3 cursor-pointer">
            <span>
              <span className="block text-[13px] font-extrabold text-[#1A1A1A]">Join this game as a player</span>
              <span className="block text-xs text-[rgba(26,26,26,.45)] mt-0.5">Takes one of your spots above, free of charge.</span>
            </span>
            <input
              type="checkbox"
              checked={joinAsPlayer}
              onChange={(e) => setJoinAsPlayer(e.target.checked)}
              className="h-5 w-5 shrink-0 rounded accent-[#16A34A]"
            />
          </label>

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

          <button type="submit" disabled={submitting} className={`mt-2 ${BTN_PRIMARY}`}>
            {submitting ? "Creating..." : "Create game"}
          </button>
        </form>
      </div>
    </div>
  );
}
