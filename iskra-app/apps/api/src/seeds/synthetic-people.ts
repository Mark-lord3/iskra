/**
 * Synthetic guests for staging.
 *
 * Every name, bio and portrait here is generated. Nothing is scraped, nothing
 * belongs to a real person, and every address is under `@example.test`, a
 * reserved TLD that can never resolve or receive mail.
 */
export const STAGING_EMAIL_DOMAIN = "example.test";

/* Deterministic pseudo-randomness: the same seed always produces the same
   person, so re-running the script cannot quietly reshuffle the fixture. */
export function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const FIRST_WOMAN = ["Mira", "Yeva", "Lena", "Sofiia", "Nadia", "Kalyna", "Oksana", "Vira", "Zoryana", "Iryna",
  "Camille", "Noor", "Anouk", "Ines", "Marta", "Liana", "Dasha", "Katrin", "Solomiia", "Rada"];
const FIRST_MAN = ["Danylo", "Artem", "Yuri", "Marko", "Ostap", "Taras", "Roman", "Lev", "Bohdan", "Vadym",
  "Emile", "Rami", "Julien", "Mateo", "Andrii", "Nazar", "Ihor", "Stas", "Pavlo", "Kyrylo"];
const HANDLE_SUFFIX = ["afterhours", "nocturne", "signal", "ember", "static", "velvet", "midnight", "orbit",
  "cassette", "neon", "drift", "echo", "prism", "tundra", "monolith"];

const BIO_OPENERS = [
  "Here for the second room and the better speakers.",
  "First one on the floor, last one to leave.",
  "I came for the music and stayed for the people.",
  "Somewhere between the bar and the bass bin.",
  "Quiet until the right track, then not quiet at all.",
  "New in the city, learning the room.",
  "I take requests and I take the long way home.",
  "Two drinks in and unreasonably friendly."
];
const BIO_CLOSERS = [
  "Say hello if you like the same track.",
  "Looking for people who dance badly on purpose.",
  "Tell me the best thing you heard tonight.",
  "I will absolutely talk your ear off about the lineup.",
  "Find me near the speakers.",
  "Happy to make room in the circle.",
  "Ask me where the good coffee is after.",
  "Here until the lights come up."
];

export const INTENTIONS = ["Dating", "New friends", "Drinks", "Dancing", "Group hangout", "Networking"];
export const ZONES = ["entrance", "main-bar", "dance-floor", "patio", "vip-lounge"];

export type SyntheticPerson = {
  index: number;
  email: string;
  firstName: string;
  displayName: string;
  gender: "woman" | "man";
  dateOfBirth: Date;
  age: number;
  bio: string;
  zone: string;
  intentions: string[];
  competitionConsent: boolean;
  hue: number;
};

/** Builds the fixture. Same count in, same people out, every time. */
export function buildPeople(count: number, now = new Date()): SyntheticPerson[] {
  const people: SyntheticPerson[] = [];

  for (let index = 0; index < count; index += 1) {
    const random = makeRandom(index * 7919 + 104729);
    const gender: "woman" | "man" = index % 2 === 0 ? "woman" : "man";
    const pool = gender === "woman" ? FIRST_WOMAN : FIRST_MAN;
    const firstName = pool[index % pool.length]!;
    const suffix = HANDLE_SUFFIX[Math.floor(random() * HANDLE_SUFFIX.length)]!;

    // 18 to 40 inclusive; never below the legal minimum.
    const age = 18 + Math.floor(random() * 23);
    const dateOfBirth = new Date(now);
    dateOfBirth.setFullYear(now.getFullYear() - age);
    dateOfBirth.setDate(dateOfBirth.getDate() - Math.floor(random() * 300));

    const wanted = 2 + Math.floor(random() * 3); // two to four
    const shuffled = [...INTENTIONS].sort(() => random() - 0.5);

    people.push({
      index,
      email: `guest${String(index + 1).padStart(3, "0")}@${STAGING_EMAIL_DOMAIN}`,
      firstName,
      displayName: `${firstName} ${suffix}`.slice(0, 32),
      gender,
      dateOfBirth,
      age,
      bio: `${BIO_OPENERS[Math.floor(random() * BIO_OPENERS.length)]} ${BIO_CLOSERS[Math.floor(random() * BIO_CLOSERS.length)]}`,
      zone: ZONES[Math.floor(random() * ZONES.length)]!,
      intentions: shuffled.slice(0, wanted),
      // Roughly a third opt in to King & Queen, so the competition has a field
      // without every guest being in it.
      competitionConsent: random() < 0.34,
      hue: Math.floor(random() * 360)
    });
  }

  return people;
}

/**
 * A generated portrait: an abstract figure, not a face and not a photograph of
 * anyone. Deterministic from the person's hue so the fixture is stable.
 */
export function portraitSvg(person: SyntheticPerson): Buffer {
  const { hue } = person;
  const initials = person.displayName
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 46% 26%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 28) % 360} 38% 15%)"/>
      <stop offset="1" stop-color="#0d0a0e"/>
    </linearGradient>
    <radialGradient id="l" cx="0.68" cy="0.24" r="0.7">
      <stop offset="0" stop-color="hsl(22 92% 60%)" stop-opacity="0.34"/>
      <stop offset="1" stop-color="hsl(22 92% 60%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <rect width="800" height="1000" fill="url(#l)"/>
  <circle cx="400" cy="392" r="132" fill="#000" opacity="0.30"/>
  <path d="M188 1000 C 208 742, 300 636, 400 636 C 500 636, 592 742, 612 1000 Z" fill="#000" opacity="0.30"/>
  <text x="400" y="424" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="118" font-weight="700" fill="#ffffff" fill-opacity="0.82">${initials}</text>
  <text x="400" y="946" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="30" letter-spacing="7" fill="#ffffff" fill-opacity="0.34">STAGING TEST DATA</text>
</svg>`);
}
