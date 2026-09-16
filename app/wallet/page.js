"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { topUpCredits, fetchCreditBalance } from "../lib/wallet";
import { MYR, CREDITS } from "../lib/format";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { PAGE_WRAP, CARD, PageTitle, Sheet, Fact, FOCUS_RING, BTN_PRIMARY } from "../components/GameUI";

// 1 credit = RM1. Adjust these anytime — nothing else depends on the values.
const PACKAGES = [10, 25, 50, 100, 200];

function humanizeType(type) {
  return (type || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function WalletPage() {
  const { user, loading: authLoading, credits, setCredits } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingPackage, setPendingPackage] = useState(null);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState(null);

  const say = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("id, amount, type, game_id, booking_id, payment_reference, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching credit transactions:", error);
    } else {
      setTransactions(data || []);
    }
  }, [user]);

  useEffect(() => {
    async function init() {
      if (!user) {
        setLoading(false);
        return;
      }
      await loadTransactions();
      setLoading(false);
    }
    if (!authLoading) init();
  }, [user, authLoading, loadTransactions]);

  async function handleConfirmTopUp() {
    if (!user || !pendingPackage) return;
    setBuying(true);

    try {
      // TODO(payments): placeholder reference until a real payment gateway
      // + webhook generates one — see TODO in lib/wallet.js.
      await topUpCredits({ profileId: user.id, amount: pendingPackage, reference: `manual-${Date.now()}` });
      const newBalance = await fetchCreditBalance(user.id);
      setCredits(newBalance);
      await loadTransactions();
      setPendingPackage(null);
      say(`+${CREDITS(pendingPackage)} added`);
    } catch (err) {
      console.error("Error buying credits:", err);
      say("Something went wrong — see console for details.");
    }

    setBuying(false);
  }

  if (loading || authLoading) {
    return <LoadingState message="Loading wallet..." />;
  }

  if (!user) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-md px-6 pt-10 pb-16">
          <PageTitle>Wallet</PageTitle>
          <EmptyState icon="lock" title="Log in to view your wallet" description="Buy credits and see your balance." actionLabel="Log in" actionHref="/login" />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <PageTitle>Wallet</PageTitle>

        <div className={`mt-4 p-6 text-center ${CARD}`}>
          <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[rgba(26,26,26,.5)]">Balance</p>
          <p className="mt-1 text-[44px] font-extrabold tabular-nums leading-none text-[#16A34A]">{credits}</p>
          <p className="mt-1 text-xs uppercase tracking-[.08em] text-[rgba(26,26,26,.45)]">
            {credits === 1 ? "credit" : "credits"} · 1 credit = RM1
          </p>
        </div>

        <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">Buy credits</h2>
        <div className="mt-4 grid grid-cols-3 gap-[10px]">
          {PACKAGES.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setPendingPackage(amount)}
              className={`flex flex-col items-center gap-0.5 p-4 ${CARD} hover:bg-[#FBF8F0] ${FOCUS_RING}`}
            >
              <span className="text-xl font-extrabold tabular-nums text-[#1A1A1A]">{amount}</span>
              <span className="text-[10px] uppercase tracking-[.06em] text-[rgba(26,26,26,.45)]">{MYR(amount)}</span>
            </button>
          ))}
        </div>

        <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#1A1A1A]">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="text-[rgba(26,26,26,.55)] mt-2 text-sm">No wallet activity yet.</p>
        ) : (
          <div className={`mt-4 divide-y divide-[rgba(26,26,26,.06)] ${CARD}`}>
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-extrabold text-[#1A1A1A] text-sm">{humanizeType(tx.type)}</p>
                    <p className="text-[11px] text-[rgba(26,26,26,.45)] mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`font-extrabold tabular-nums ${isPositive ? "text-[#16A34A]" : "text-[#1A1A1A]"}`}>
                    {isPositive ? "+" : ""}{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={!!pendingPackage} onClose={() => setPendingPackage(null)} kicker="Buy credits">
        {pendingPackage && (
          <>
            <div className="px-5">
              <h3 className="text-[44px] font-extrabold leading-none tabular-nums tracking-[-.04em]">
                {MYR(pendingPackage)}
              </h3>
              <p className="mt-2 text-xs uppercase tracking-[.08em] text-[rgba(26,26,26,.55)]">
                For {CREDITS(pendingPackage)}
              </p>
            </div>
            <div className="flex gap-[10px] px-4 pt-4">
              <Fact label="Credits" value={pendingPackage} />
              <Fact label="Rate" value="1 : 1" />
              <Fact label="New balance" value={credits + pendingPackage} />
            </div>
            <div className="px-4 pb-7 pt-[14px]">
              <button type="button" onClick={handleConfirmTopUp} disabled={buying} className={BTN_PRIMARY}>
                {buying ? "Processing..." : `Pay ${MYR(pendingPackage)} with DuitNow`}
              </button>
            </div>
          </>
        )}
      </Sheet>

      {toast && (
        <div className="fixed inset-x-4 top-[60px] z-[4000] mx-auto max-w-2xl rounded-full bg-[#1A1A1A] px-[18px] py-3 text-xs font-extrabold uppercase tracking-[.08em] text-white shadow-[0_8px_20px_rgba(0,0,0,.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
