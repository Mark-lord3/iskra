import { motion } from "framer-motion";

export type VenueProfile = {
  _id: string;
  displayName: string;
  age?: number | null;
  gender?: "woman" | "man";
  bio?: string;
  zone?: string;
  intentions: string[];
  photos?: string[];
  competitionEligible?: boolean;
  expiresAt?: string;
};

type Props = {
  profile: VenueProfile | null | undefined;
  eventName: string;
  venueName: string;
  onEdit: () => void;
};

function formatExpiry(value?: string) {
  if (!value) return "End of tonight's venue session";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "End of tonight's venue session";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function ProfileIcon({ name }: { name: "eye" | "pin" | "clock" | "crown" | "lock" | "edit" | "person" }) {
  const paths = {
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    crown: <><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z"/><path d="M6 21h12"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
    person: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function ProfileExperience({ profile, eventName, venueName, onEdit }: Props) {
  if (!profile) {
    return (
      <section className="profile-empty-state">
        <div aria-hidden="true"><span>P</span><i /></div>
        <p>People can only find you after your profile is live.</p>
        <h2>Show the room who you are.</h2>
        <button type="button" onClick={onEdit}>Build my profile</button>
      </section>
    );
  }

  const image = profile.photos?.[0] || null;
  const completionParts = [image, profile.displayName, profile.bio, profile.zone, profile.intentions.length > 0];
  const completion = Math.round((completionParts.filter(Boolean).length / completionParts.length) * 100);

  return (
    <section className="profile-experience">
      <div className="profile-experience__lead">
        <div>
          <span>Live in {venueName}</span>
          <h2>This is you, tonight.</h2>
          <p>Your selfie and the details below are exactly what other checked-in guests see in Discover.</p>
        </div>
        <button type="button" onClick={onEdit}><ProfileIcon name="edit" /> Edit</button>
      </div>

      <div className="profile-experience__layout">
        <motion.article
          className="profile-public-preview"
          initial={{ opacity: 0, y: 14, filter: "blur(5px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: .45, ease: [0.22, 0.68, 0, 1] }}
        >
          <div className="profile-public-preview__media">
            {image
              ? <img src={image} alt={`${profile.displayName}'s event selfie`} />
              : <div className="profile-public-preview__fallback">{profile.displayName.slice(0, 1)}</div>}
            <span className="profile-public-preview__live"><i /> Live profile</span>
            <div className="profile-public-preview__scrim">
              <h3>{profile.displayName}{profile.age ? <em>{profile.age}</em> : null}</h3>
              <p className="profile-public-preview__zone"><ProfileIcon name="pin" /> {profile.zone || "Around the venue"}</p>
              <p>{profile.bio || "Here for tonight's ISKRA energy."}</p>
              <div>{profile.intentions.map((intent) => <span key={intent}>{intent}</span>)}</div>
            </div>
          </div>
          <footer><ProfileIcon name="eye" /><span><strong>How others see you</strong><small>Only checked-in guests in this event</small></span></footer>
        </motion.article>

        <div className="profile-experience__details">
          <article className="profile-completion">
            <div><span>Profile strength</span><strong>{completion}%</strong></div>
            <i aria-hidden="true"><b style={{ transform: `scaleX(${completion / 100})` }} /></i>
            <p>{completion === 100 ? "You are ready to meet the room." : "Add every detail so people have an easy way to start a conversation."}</p>
          </article>

          <dl className="profile-facts">
            <div><dt><ProfileIcon name="pin" /> Tonight's area</dt><dd>{profile.zone || "Around the venue"}</dd></div>
            <div><dt><ProfileIcon name="person" /> Profile category</dt><dd>{profile.gender === "woman" ? "Woman" : profile.gender === "man" ? "Man" : "Not set"}</dd></div>
            <div><dt><ProfileIcon name="crown" /> King &amp; Queen</dt><dd>{profile.competitionEligible ? "Selfie entered" : "Not entered"}</dd></div>
            <div><dt><ProfileIcon name="clock" /> Profile disappears</dt><dd>{formatExpiry(profile.expiresAt)}</dd></div>
            <div><dt><ProfileIcon name="lock" /> Event access</dt><dd>{eventName}</dd></div>
          </dl>

          <article className="profile-private-note">
            <ProfileIcon name="lock" />
            <div><strong>Private account details stay private.</strong><p>Your email, payment information, exact location, and account data never appear on your public card.</p></div>
          </article>

          <button type="button" className="profile-edit-action" onClick={onEdit}><ProfileIcon name="edit" /> Update selfie or profile</button>
        </div>
      </div>
    </section>
  );
}
