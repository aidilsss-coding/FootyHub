"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/AuthContext";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import { PAGE_WRAP, CARD, PageTitle, LABEL, INPUT, BACK_LINK, BTN_PRIMARY } from "../../components/GameUI";

export default function CreateOrganisation() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setErrorMsg("Give your organisation a name (at least 2 characters).");
      setSubmitting(false);
      return;
    }

    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .insert({ name: trimmedName, description: description.trim(), founder_id: user.id })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organisation:", orgError);
      setErrorMsg("Something went wrong creating the organisation.");
      setSubmitting(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("organisation_members")
      .insert({ organisation_id: org.id, profile_id: user.id, role: "founder" });

    setSubmitting(false);

    if (memberError) {
      console.error("Error adding founder as member:", memberError);
      setErrorMsg("Organisation created, but something went wrong setting you as founder.");
      return;
    }

    router.push(`/organisations/${org.id}`);
  }

  if (authLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (!user) {
    return (
      <div className={PAGE_WRAP}>
        <div className="mx-auto max-w-md px-6 pt-10 pb-16">
          <PageTitle>Create organisation</PageTitle>
          <EmptyState icon="lock" title="Log in to create an organisation" description="You need an account to start one." actionLabel="Log in" actionHref="/login" />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_WRAP}>
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        <a href="/profile" className={BACK_LINK}>&larr; Back to profile</a>
        <div className="mt-4">
          <PageTitle>Create organisation</PageTitle>
        </div>

        <form onSubmit={handleSubmit} className={`mt-6 flex flex-col gap-4 p-6 ${CARD}`}>
          <div>
            <label className={LABEL}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kelana Jaya FC"
              className={INPUT}
              required
            />
          </div>

          <div>
            <label className={LABEL}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this organisation about?"
              rows={4}
              className={`${INPUT} resize-none`}
            />
          </div>

          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

          <button type="submit" disabled={submitting} className={`mt-2 ${BTN_PRIMARY}`}>
            {submitting ? "Creating..." : "Create organisation"}
          </button>
        </form>
      </div>
    </div>
  );
}
