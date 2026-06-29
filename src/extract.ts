// Batteries-included natural-language extractor.
//
// This recognizes a handful of common predicates so `memory.remember("...")` works out
// of the box. It is intentionally small and rule-based — for anything beyond the demo
// vocabulary, do your own extraction (an LLM is ideal) and call `memory.assert(fact)`.

import type { Fact } from "./types.js";

// First-word verbs/triggers that mean the sentence has no subject ("works at…").
const PURE_TRIGGER = new Set([
  "works", "work", "lives", "live", "moved", "joined", "is", "are", "was", "were",
  "send", "switched", "relocated", "headquartered", "based", "interested", "likes",
  "into", "has", "have", "does", "do", "did",
]);

// Words that end the subject (the predicate/verb begins here).
const SUBJECT_END = new Set([
  ...PURE_TRIGGER,
  "worked", "lived", "moving", "joins", "be", "been", "being", "had", "will", "would",
  "can", "could", "now", "recently", "currently", "still", "also", "just", "then",
  "again", "no", "not", "never", "prefers", "prefer", "left", "runs", "leads",
  "founded", "heads", "and", "who",
]);

const TRAILING_FILLER = new Set([
  "again", "now", "currently", "too", "also", "anymore", "instead", "today", "then", "still",
]);

const bare = (tok: string) => tok.toLowerCase().replace(/[^a-z0-9']/g, "");
const cap = (tok: string) => {
  const t = tok.replace(/[.,;:!?]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function cleanValue(raw: string): string {
  const v = raw.split(/\s+and\s+/)[0]!.replace(/[.,;:!?]+$/, "").trim();
  const words = v.split(/\s+/);
  while (words.length > 1 && TRAILING_FILLER.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  return words.join(" ");
}

/** Find the subject as the leading run of words up to the first verb/trigger. */
function subjectOf(text: string): string | null {
  const cleaned = text.replace(/^(actually|correction|note|update|fyi|reminder)[,:]?\s+/i, "").trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  if (PURE_TRIGGER.has(bare(tokens[0]!))) return null;
  const subject: string[] = [cap(tokens[0]!)];
  for (let i = 1; i < tokens.length && subject.length < 4; i++) {
    if (SUBJECT_END.has(bare(tokens[i]!))) break;
    subject.push(cap(tokens[i]!));
  }
  return subject.join(" ");
}

/** Extract zero or more facts from a natural-language statement. */
export function extract(text: string): Fact[] {
  const subject = subjectOf(text);
  if (!subject) return [];
  const facts: Fact[] = [];
  // Match case-insensitively but capture from the original text, so values keep their
  // case ("Acme" stays "Acme", not "acme").
  const add = (predicate: string, m: RegExpMatchArray | null) => {
    if (m) facts.push({ subject, predicate, value: cleanValue(m[1]!) });
  };
  add("works_at", text.match(/(?:works at|joined)\s+([A-Za-z0-9 .&-]+)/i));
  add("lives_in", text.match(/(?:moved to|lives in|based in)\s+([A-Za-z0-9 .&-]+)/i));
  add("role_is", text.match(/\bis (?:now )?(?:an? )([A-Za-z0-9 .&-]+)/i));
  add("hq_in", text.match(/headquartered in\s+([A-Za-z0-9 .&-]+)/i));
  add("interested_in", text.match(/(?:interested in|likes|into)\s+([A-Za-z0-9 .&-]+)/i));
  return facts;
}

/** Map a question to a (subject, predicate) intent, for `memory.ask(...)`. */
export function parseIntent(question: string): { subject: string; predicate: string } | null {
  const rules: Array<[RegExp, string]> = [
    [/where does (.+?) work/i, "works_at"],
    [/where does (.+?) live/i, "lives_in"],
    [/where is (.+?) headquartered/i, "hq_in"],
    [/what is (.+?)'s role/i, "role_is"],
    [/what does (.+?) do\b/i, "role_is"],
    [/what is (.+?) interested in/i, "interested_in"],
  ];
  for (const [re, predicate] of rules) {
    const m = question.match(re);
    if (m) return { subject: m[1]!.replace(/'s$/, "").trim(), predicate };
  }
  return null;
}
