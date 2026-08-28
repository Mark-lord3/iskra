import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { prepareUploadImage } from "../lib/image";
import { useDialogLifecycle } from "../hooks/useDialogLifecycle";

type User = { id: string; firstName: string; email: string };
type EventContext = { event: { _id: string; name: string }; venue: { _id: string; name: string; locationLabel?: string } };
type ExistingProfile = { displayName: string; bio?: string; zone?: string; intentions: string[]; photos?: string[]; competitionEligible?: boolean } | null;
type AccessStatus = { paid: boolean; amountCents: number; registeredCount: number };
const intentions = ["Dating", "New friends", "Drinks", "Dancing", "Group hangout", "Networking"];

export function EntryFlow({ context, hasAccount, access, existingProfile, onComplete, onClose }: {
  context: EventContext;
  hasAccount: boolean;
  access?: AccessStatus;
  existingProfile?: ExistingProfile;
  onComplete: () => void;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"register" | "login" | "paywall" | "profile">(hasAccount ? (access?.paid ? "profile" : "paywall") : "register");
  const [error, setError] = useState("");
  const [submissionStage, setSubmissionStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [selected, setSelected] = useState(existingProfile?.intentions || ["Dating", "Dancing"]);
  const dialogRef = useDialogLifecycle(true, onClose);
  const stage = mode === "profile" ? 3 : mode === "paywall" ? 2 : 1;
  const adultDate = new Date();
  adultDate.setFullYear(adultDate.getFullYear() - 18);

  useEffect(() => {
    if (hasAccount && access?.paid && mode === "paywall") {
      setError("");
      setMode("profile");
    }
  }, [access?.paid, hasAccount, mode]);

  const mutation = useMutation({
    mutationFn: async ({ form, kind }: { form: HTMLFormElement; kind: typeof mode }) => {
      const values = Object.fromEntries(new FormData(form));
      if (kind === "profile") {
        const photo = values.photo;
        let photos: string[] | undefined;
        if (photo instanceof File && photo.size > 0) {
          setSubmissionStage("uploading");
          // Shrunk and re-encoded here so a full-size camera photo cannot blow
          // the server's size limit, and so its EXIF GPS never leaves the phone.
          const prepared = await prepareUploadImage(photo);
          const uploadBody = new FormData();
          uploadBody.set("file", prepared);
          uploadBody.set("eventId", context.event._id);
          uploadBody.set("venueId", context.venue._id);
          uploadBody.set("kind", "profile");
          const uploaded = await api<{ url: string }>("/media/upload", { method: "POST", body: uploadBody });
          photos = [uploaded.url];
        }
        setSubmissionStage("saving");
        const competitionConsent = values.competitionConsent === "on";
        return api(`/profiles/event`, {
          method: "POST",
          body: JSON.stringify({
            eventId: context.event._id,
            displayName: values.displayName,
            bio: values.bio,
            zone: values.zone,
            intentions: selected,
            photos: photos || existingProfile?.photos,
            competitionConsent
          })
        });
      }
      return api<{ user: User }>(`/auth/${kind}`, {
        method: "POST",
        body: JSON.stringify(kind === "login" ? {
          email: values.email,
          password: values.password
        } : {
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          dateOfBirth: values.dateOfBirth,
          gender: values.gender
        })
      });
    },
    onSuccess: async (_, variables) => {
      setError("");
      setSubmissionStage("idle");
      if (variables.kind === "register") {
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        await queryClient.invalidateQueries({ queryKey: ["access", context.event._id] });
        setMode("paywall");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["my-profile", context.event._id] }),
        queryClient.invalidateQueries({ queryKey: ["discover", context.event._id] })
      ]);
      if (variables.kind === "login") {
        const status = await api<AccessStatus>(`/access/${context.event._id}/status`);
        if (!status.paid) {
          queryClient.setQueryData(["access", context.event._id], status);
          setMode("paywall");
          return;
        }
        const profile = await api<{ profile: unknown | null }>(`/profiles/event/${context.event._id}/me`);
        if (!profile.profile) {
          setMode("profile");
          return;
        }
      }
      onComplete();
    },
    onError: (requestError) => {
      setSubmissionStage("idle");
      setError(requestError instanceof Error ? requestError.message : "Please try again.");
    }
  });

  const checkout = useMutation({
    mutationFn: () => api<{ url?: string; paid?: boolean }>(`/access/${context.event._id}/checkout`, { method: "POST" }),
    onSuccess: (result) => {
      if (result.paid) {
        queryClient.invalidateQueries({ queryKey: ["access", context.event._id] });
        setMode("profile");
      } else if (result.url) {
        window.location.assign(result.url);
      } else {
        setError("Checkout could not be opened. Please try again.");
      }
    },
    onError: (requestError) => setError(requestError instanceof Error ? requestError.message : "Checkout could not open.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    mutation.mutate({ form: event.currentTarget, kind: mode });
  }

  return (
    <div ref={dialogRef} className="entry-flow" role="dialog" aria-modal="true" aria-labelledby="entry-title">
      <div className="entry-flow__art" aria-hidden="true">
        <div className="entry-flow__signal"><i /><i /><i /></div>
        <p>VENUE MODE / {context.venue.name}</p>
        <strong>THE ROOM IS LIVE.</strong>
      </div>
      <section className="entry-flow__panel">
        {onClose && <button type="button" className="entry-flow__close" onClick={onClose} aria-label="Close">Close</button>}
        <div className="entry-progress" aria-label={`Step ${stage} of 3`}><span style={{ transform: `scaleX(${stage / 3})` }} /><small>{stage} / 3</small></div>
        <p className="entry-flow__eyebrow">{mode === "profile" ? "ONE LAST STEP" : mode === "paywall" ? "YOUR ACCOUNT IS READY" : "WELCOME TO ISKRA"}</p>
        <h1 id="entry-title">{mode === "register" ? "Enter tonight." : mode === "login" ? "Welcome back." : mode === "paywall" ? `${access?.registeredCount || 0} people signed up.` : "Build tonight's profile."}</h1>
        <p className="entry-flow__intro">{mode === "profile" ? "This temporary profile disappears after the venue session." : mode === "paywall" ? "Unlock tonight's venue room, matching, and King & Queen voting with one $5 CAD event pass." : "18+ only. Create a private account before you meet people in the room."}</p>

        {mode !== "profile" && mode !== "paywall" && (
          <div className="entry-flow__tabs">
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          </div>
        )}

        {mode === "paywall" ? <div className="entry-paywall">
          <div><span>TONIGHT'S ACCESS</span><strong>$5</strong><small>CAD · ONE-TIME EVENT PASS</small></div>
          {error && <p className="entry-form__error" role="alert">{error}</p>}
          <button type="button" className="entry-form__submit" disabled={checkout.isPending} onClick={() => checkout.mutate()}>{checkout.isPending ? "Opening secure checkout..." : "Unlock the room with Stripe"}</button>
          <button type="button" className="entry-paywall__back" onClick={() => setMode("login")}>Use another account</button>
        </div> : <form onSubmit={submit} className="entry-form">
          {mode === "register" && <label><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={40} required placeholder="Your first name" /></label>}
          {mode !== "profile" && <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>}
          {mode !== "profile" && <label><span>Password</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" /></label>}
          {mode === "register" && <div className="entry-form__row"><label><span>Date of birth</span><input name="dateOfBirth" type="date" max={adultDate.toISOString().slice(0, 10)} autoComplete="bday" required /></label><label><span>Competition category</span><select name="gender" defaultValue="" required><option value="" disabled>Choose one</option><option value="woman">Woman</option><option value="man">Man</option></select></label></div>}

          {mode === "profile" && <>
            <label className="entry-photo"><span>Event selfie {existingProfile?.photos?.length ? "(replace optional)" : "(required)"}</span><input name="photo" type="file" required={!existingProfile?.photos?.length} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" /></label>
            <label className="entry-consent"><input name="competitionConsent" type="checkbox" defaultChecked={existingProfile?.competitionEligible} required /><span>I agree that this event selfie can appear anonymously in tonight's King & Queen swipe competition. It expires with my event profile.</span></label>
            <label><span>Display name</span><input name="displayName" defaultValue={existingProfile?.displayName} maxLength={40} required placeholder="How people see you tonight" /></label>
            <label><span>Short intro</span><textarea name="bio" defaultValue={existingProfile?.bio} maxLength={280} required placeholder="A conversation starter, not a resume." /></label>
            <fieldset><legend>Open to tonight</legend><div className="entry-intents">{intentions.map((intent) => <button type="button" key={intent} className={selected.includes(intent) ? "active" : ""} onClick={() => setSelected((current) => current.includes(intent) ? current.filter((item) => item !== intent) : current.length < 4 ? [...current, intent] : current)}>{intent}</button>)}</div></fieldset>
            <label><span>Approximate area</span><select name="zone" defaultValue={existingProfile?.zone || "Dance Floor"}><option>Entrance</option><option>Main Bar</option><option>Dance Floor</option><option>Patio</option><option>VIP Lounge</option></select></label>
          </>}

          {error && <p className="entry-form__error" role="alert">{error}</p>}
          <button className="entry-form__submit" disabled={mutation.isPending || (mode === "profile" && selected.length === 0)}>{mutation.isPending ? submissionStage === "uploading" ? "Uploading selfie..." : submissionStage === "saving" ? "Saving your profile..." : "Please wait..." : mode === "register" ? "Create account" : mode === "login" ? "Sign in" : "Enter the room"}</button>
        </form>}
        <p className="entry-flow__legal">By continuing, you confirm you are 18+ and agree to respectful, consent-first interactions.</p>
      </section>
    </div>
  );
}
