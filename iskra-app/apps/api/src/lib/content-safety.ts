const blockedTerms = [
  "fuck", "shit", "bitch", "cunt", "nigger", "faggot", "хуй", "пизд", "ебат", "бляд", "сука",
  "нахуй", "їбати", "пизд", "бляд", "курва"
];

export function containsBlockedLanguage(value: string) {
  const normalized = value.toLocaleLowerCase().replace(/[._\-\s]+/g, "");
  return blockedTerms.some((term) => normalized.includes(term.replace(/\s+/g, "")));
}

export function assertSafeText(...values: Array<string | undefined>) {
  if (values.some((value) => value && containsBlockedLanguage(value))) {
    throw Object.assign(new Error("Please rewrite this without abusive or explicit language."), { status: 400 });
  }
}
