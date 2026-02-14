/**
 * Redact known slurs and hate speech from free-text fields.
 * Returns the string with offensive words replaced by ███ blocks.
 * Uses a static blocklist — no AI, fast and predictable.
 */

const SLURS: string[] = [
  // Racial slurs
  "nigger", "nigga", "niggers", "niggas",
  "spic", "spics", "spick", "spicks",
  "wetback", "wetbacks",
  "chink", "chinks",
  "gook", "gooks",
  "kike", "kikes",
  "beaner", "beaners",
  "coon", "coons",
  "darkie", "darkies",
  "raghead", "ragheads",
  "towelhead", "towelheads",
  "camel jockey",
  "jungle bunny",
  "porch monkey",
  "sand nigger",
  // Anti-LGBTQ
  "faggot", "faggots", "fag", "fags",
  "dyke", "dykes",
  "tranny", "trannies",
  // Other
  "retard", "retards", "retarded",
];

// Build regex: word boundaries, case insensitive
const SLUR_PATTERN = new RegExp(
  `\\b(${SLURS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi"
);

export function redactSlurs(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text.replace(SLUR_PATTERN, (match) => "█".repeat(match.length));
}
