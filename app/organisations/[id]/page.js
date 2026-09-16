"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import LoadingState from "../../components/LoadingState";
import Icon from "../../components/Icon";
import EmptyState from "../../components/EmptyState";
import Avatar from "../../components/Avatar";
import { PAGE_WRAP, CARD, ROW_CARD, BACK_LINK, BTN_PRIMARY, FOCUS_RING } from "../../components/GameUI";
import { CREDITS, time24, dayShort } from "../../lib/format";

const ROLE_LABELS = { founder: "Founder", leader: "Leaders", member: "Members" };
const ROLE_ORDER = ["founder", "leader", "member"];

function MemberRow({ member }) {
  const uname = member.profiles?.username || "Player";
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar url={member.profiles?.avatar_url} name={uname} size={36} textSize="text-[13px]" />
      <p className="font-extrabold text-[#1A1A1A] text-sm truncate">@{uname}</p>
    </div>
  );
}

export default function OrganisationPage({ params }) {
  const { user, username } = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [games, setGames] = useState([]);
  const [myRole, setMyRole] = useState(null); // null | 'founder' | 'leader' | 'member'
  const [myRequestStatus, setMyRequestStatus] = useState(null); // null | 'pending' | 'approved' | 'rejected'
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestingLeader, setRequestingLeader] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [toast, setToast] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    async function fetchOrg() {
      const { id } = await params;
      setOrgId(id);

      const { data: orgData, error: orgError } = await supabase.from("organisations").select("*").eq("id", id).single();
      if (orgError || !orgData) {
        console.error("Error fetching organisation:", orgError);
        setLoading(false);
        return;
      }
      setOrg(orgData);

      const { data: membersData, error: membersError } = await supabase
        .from("organisation_members")
        .select("id, profile_id, role, joined_at, profiles(username, avatar_url)")
        .eq("organisation_id", id)
        .order("joined_at", { ascending: true });
      if (membersError) {
        console.error("Error fetching members:", membersError);
      } else {
        setMembers(membersData || []);
      }

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .eq("organisation_id", id)
        .order("game_date", { ascending: true });
      if (gamesError) {
        console.error("Error fetching organisation games:", gamesError);
      } else {
        setGames(gamesData || []);
      }

      if (user) {
        const mine = (membersData || []).find((m) => m.profile_id === user.id);
        const role = mine?.role || null;
        setMyRole(role);

        const { data: reqData } = await supabase
          .from("leader_requests")
          .select("id, status")
          .eq("organisation_id", id)
          .eq("requester_id", user.id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setMyRequestStatus(reqData?.status || null);

        if (role === "leader" || role === "founder") {
          const { data: pending, error: pendingError } = await supabase
            .from("leader_requests")
            .select("id, requester_id, status, requested_at, profiles!leader_requests_requester_id_fkey(username)")
            .eq("organisation_id", id)
            .eq("status", "pending")
            .order("requested_at", { ascending: true });
          if (pendingError) {
            console.error("Error fetching leader requests:", pendingError);
          } else {
            setPendingRequests(pending || []);
          }
        }
      }

      setLoading(false);
    }
    fetchOrg();
  }, [params, user]);

  async function handleJoin() {
    if (!user || !orgId) return;
    setJoining(true);
    const { data, error } = await supabase
      .from("organisation_members")
      .insert({ organisation_id: orgId, profile_id: user.id, role: "member" })
      .select()
      .single();
    setJoining(false);

    if (error) {
      console.error("Error joining organisation:", error);
      say("Something went wrong joining.");
      return;
    }

    setMyRole("member");
    setMembers((prev) => [...prev, { ...data, profiles: { username } }]);
    say("You're in!");
  }

  async function handleRequestLeader() {
    if (!user || !orgId) return;
    setRequestingLeader(true);
    const { error } = await supabase
      .from("leader_requests")
      .insert({ organisation_id: orgId, requester_id: user.id, status: "pending" });
    setRequestingLeader(false);

    if (error) {
      console.error("Error requesting leader:", error);
      say("Something went wrong sending the request.");
      return;
    }

    setMyRequestStatus("pending");
    say("Leader request sent");
  }

  async function handleApprove(request) {
    setActioningId(request.id);
    const nowIso = new Date().toISOString();

    const { error: reqError } = await supabase
      .from("leader_requests")
      .update({ status: "approved", reviewed_by: user.id, reviewed_at: nowIso })
      .eq("id", request.id);

    if (reqError) {
      console.error("Error approving request:", reqError);
      setActioningId(null);
      say("Something went wrong approving that request.");
      return;
    }

    const { error: memberError } = await supabase
      .from("organisation_members")
      .update({ role: "leader" })
      .eq("organisation_id", orgId)
      .eq("profile_id", request.requester_id);

    setActioningId(null);

    if (memberError) {
      console.error("Error promoting member:", memberError);
      say("Approved, but failed to update their role.");
    } else {
      say(`@${request.profiles?.username || "player"} is now a leader`);
    }

    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    setMembers((prev) => prev.map((m) => (m.profile_id === request.requester_id ? { ...m, role: "leader" } : m)));
  }

  async function handleReject(request) {
    setActioningId(request.id);
    const { error } = await supabase
      .from("leader_requests")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", request.id);
    setActioningId(null);

    if (error) {
      console.error("Error rejecting request:", error);
      say("Something went wrong.");
      return;
    }

    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    say("Request rejected");
  }

  if (loading) {
    return <LoadingState message="Loading organisation..." />;
  }

  if (!org) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-2xl px-6 pt-14 pb-16 text-center">
          <Icon name="question" className="w-10 h-10 mx-auto mb-2 text-[rgba(26,26,26,.3)]" />
          <p className="text-[rgba(26,26,26,.55)]">Organisation not found.</p>
        </div>
      </div>
    );
  }

  const groupedMembers = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    members: members.filter((m) => m.role === role),
  })).filter((g) => g.members.length > 0);

  const isLeaderOrFounder = myRole === "leader" || myRole === "founder";

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <Link href="/profile" className={BACK_LINK}>&larr; Back to profile</Link>

        <div className={`mt-4 p-6 ${CARD}`}>
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">{org.name}</h1>
          {org.description && (
            <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm leading-[1.5]">{org.description}</p>
          )}

          <div className="mt-4 pt-4 border-t border-[rgba(26,26,26,.06)]">
            {!user ? (
              <Link href="/login" className={BTN_PRIMARY}>Log in to join</Link>
            ) : isLeaderOrFounder ? (
              <span className="inline-block rounded-full bg-[#E8F5EC] text-[#16A34A] text-[11px] font-extrabold uppercase tracking-[.08em] px-3 py-1.5">
                You&apos;re {myRole === "founder" ? "the founder" : "a leader"}
              </span>
            ) : myRole === "member" ? (
              <div className="flex items-center justify-between gap-3">
                <span className="inline-block rounded-full bg-[#E8F5EC] text-[#16A34A] text-[11px] font-extrabold uppercase tracking-[.08em] px-3 py-1.5">
                  You&apos;re a member
                </span>
                {myRequestStatus === "pending" ? (
                  <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[rgba(26,26,26,.45)]">
                    Leader request pending
                  </span>
                ) : (
                  <button
                    onClick={handleRequestLeader}
                    disabled={requestingLeader}
                    className={`rounded-full bg-[rgba(26,26,26,.06)] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.06em] text-[#1A1A1A] hover:bg-[rgba(26,26,26,.1)] disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    {requestingLeader ? "Sending..." : "Request to become leader"}
                  </button>
                )}
              </div>
            ) : (
              <button onClick={handleJoin} disabled={joining} className={BTN_PRIMARY}>
                {joining ? "Joining..." : "Join organisation"}
              </button>
            )}
          </div>
        </div>

        {isLeaderOrFounder && (
          <>
            <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">
              Leader requests
            </h2>
            {pendingRequests.length === 0 ? (
              <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">No pending requests.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-[10px]">
                {pendingRequests.map((req) => (
                  <div key={req.id} className={`flex items-center justify-between gap-3 p-4 ${ROW_CARD}`}>
                    <div className="min-w-0">
                      <p className="font-extrabold text-[#1A1A1A] truncate">@{req.profiles?.username || "Player"}</p>
                      <p className="text-[11px] text-[rgba(26,26,26,.45)] mt-0.5">
                        Requested {new Date(req.requested_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={actioningId === req.id}
                        className={`rounded-full bg-[rgba(26,26,26,.06)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.06em] text-[#1A1A1A] hover:bg-[rgba(26,26,26,.1)] disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actioningId === req.id}
                        className={`rounded-full bg-[#16A34A] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.06em] text-white hover:bg-[#128a3a] disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">Members</h2>
        {groupedMembers.length === 0 ? (
          <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">No members yet.</p>
        ) : (
          <div className={`mt-4 divide-y divide-[rgba(26,26,26,.06)] ${CARD}`}>
            {groupedMembers.map((group) => (
              <div key={group.role} className="p-3">
                <p className="px-2 pt-1 pb-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.4)]">
                  {group.label}
                </p>
                {group.members.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">Games</h2>
        {games.length === 0 ? (
          <EmptyState icon="ball" title="No games posted yet" description="Games hosted by this organisation will show up here." />
        ) : (
          <div className="mt-4 flex flex-col gap-[10px]">
            {games.map((g) => (
              <Link
                key={g.id}
                href={`/games/${g.id}`}
                className={`flex min-h-[68px] w-full items-stretch overflow-hidden text-left ${ROW_CARD} ${FOCUS_RING}`}
              >
                <span className="w-[74px] shrink-0 py-[14px] pl-4">
                  <span className="block text-[19px] font-extrabold tabular-nums tracking-[-.02em]">
                    {g.game_date ? time24(g.game_date) : "—"}
                  </span>
                  <span className="block text-[9px] uppercase tracking-[.1em] text-[rgba(26,26,26,.45)]">
                    {g.game_date ? dayShort(g.game_date) : ""}
                  </span>
                </span>
                <span className="min-w-0 flex-1 px-[10px] py-[14px]">
                  <span className="block truncate text-[15px] font-extrabold tracking-[-.01em]">{g.venue}</span>
                  <span className="block text-[11px] text-[rgba(26,26,26,.55)]">{g.format} · {CREDITS(g.credits_cost)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed inset-x-4 top-[60px] z-[4000] mx-auto max-w-2xl rounded-full bg-[#1A1A1A] px-[18px] py-3 text-xs font-extrabold uppercase tracking-[.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
