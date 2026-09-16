"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabaseClient";
import LoadingState from "../components/LoadingState";
import { FOCUS_RING } from "../components/GameUI";
import { CREDITS } from "../lib/format";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

export default function MapPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [icon, setIcon] = useState(null);

  useEffect(() => {
    import("leaflet").then((L) => {
      const ballIcon = L.divIcon({
        html: `<div style="background:#16A34A; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 9l2.85 2.07-1.09 3.36h-3.52l-1.09-3.36z"></path><path d="M12 9V6M14.85 11.07l2.86-.92M13.76 14.43l1.77 2.42M10.24 14.43l-1.77 2.42M9.15 11.07l-2.86-.92"></path></svg></div>`,
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });
      setIcon(ballIcon);
    });
  }, []);

  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase.from("games").select("*").not("lat", "is", null);
      if (error) {
        console.error("Error fetching games:", error);
      } else {
        setGames(data);
      }
      setLoading(false);
    }
    fetchGames();
  }, []);

  if (loading || !icon) {
    return <LoadingState message="Loading map..." />;
  }

  return (
    <div className="relative h-screen w-full">
      <Link
        href="/"
        className={`absolute top-4 right-4 z-[1000] w-11 h-11 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,.12)] flex items-center justify-center text-[#16A34A] hover:bg-[#FBF8F0] transition-colors ${FOCUS_RING}`}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 14 4 9 9 4"></polyline>
          <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
        </svg>
      </Link>

      <MapContainer center={[3.139, 101.6869]} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_306f_1_5c0a53fa364b623717c48783" attribution="&copy; OpenStreetMap contributors &copy; CARTO" />
        {games.map((game) => (
          <Marker key={game.id} position={[game.lat, game.lng]} icon={icon}>
            <Popup>
              <div className="font-[family-name:var(--font-display)] text-[#1A1A1A]">
                <p className="font-extrabold">{game.venue}</p>
                <p className="text-sm text-[rgba(26,26,26,.6)] mt-0.5">{game.format} · {CREDITS(game.credits_cost)}</p>
                <a href={`/games/${game.id}`} className="text-[#16A34A] text-xs font-extrabold uppercase tracking-[.08em] mt-1 inline-block">
                  View game
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
