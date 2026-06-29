import { test } from "node:test";
import assert from "node:assert/strict";
import { Memory, extract } from "./index.js";
import type { Constraint } from "./index.js";

const noInverted = (rows: Constraint[]) => {
  for (const c of rows) if (c.until !== null) assert.ok(c.until >= c.from, `inverted: ${c.value}`);
};

test("a new value retracts the old one instead of overwriting it", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
  m.assert({ subject: "Priya", predicate: "works_at", value: "Acme" });

  assert.equal(m.value("Priya", "works_at"), "Acme");
  const stripe = m.history("Priya").find((c) => c.value === "Stripe")!;
  assert.notEqual(stripe.until, null, "old value is closed, not deleted");
  noInverted(m.history("Priya"));
});

test("asserting an already-current fact is idempotent", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
  const second = m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
  assert.equal(second, null);
  assert.equal(m.history("Priya").length, 1);
});

test("matching is case-insensitive across subject and value", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
  m.assert({ subject: "priya", predicate: "works_at", value: "stripe" }); // same fact, different case
  assert.equal(m.history("Priya").length, 1, "case variants do not duplicate");
});

test("multi-valued predicates accumulate instead of retracting", () => {
  const m = new Memory({ multiValued: ["tag"] });
  m.assert({ subject: "Priya", predicate: "tag", value: "founder" });
  m.assert({ subject: "Priya", predicate: "tag", value: "infra" });
  assert.deepEqual(m.values("Priya", "tag").sort(), ["founder", "infra"]);
});

test("out-of-order asserts never produce an inverted window", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Acme" }, { at: 5 });
  m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" }, { at: 1 }); // older, late

  assert.equal(m.value("Priya", "works_at"), "Acme", "the newer value is not clobbered");
  const stripe = m.history("Priya").find((c) => c.value === "Stripe")!;
  assert.equal(stripe.until, 5, "the late older fact is born closed at the newer value's start");
  noInverted(m.history("Priya"));
});

test("ask answers from the current fact, or null when unknown", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Acme" });
  assert.equal(m.ask("Where does Priya work?").answer, "Acme");
  assert.equal(m.ask("Where does Zoe work?").answer, null);
});

test("confidence defaults to 1 and is preserved", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Acme", confidence: 0.6 });
  assert.equal(m.current("Priya")[0]!.confidence, 0.6);
  m.assert({ subject: "Dana", predicate: "works_at", value: "Figma" });
  assert.equal(m.current("Dana")[0]!.confidence, 1);
});

test("snapshot and Memory.from round-trip the full state", () => {
  const m = new Memory();
  m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
  m.assert({ subject: "Priya", predicate: "works_at", value: "Acme" });

  const restored = Memory.from(m.snapshot());
  assert.equal(restored.value("Priya", "works_at"), "Acme");
  assert.equal(restored.history("Priya").length, 2);

  // The restored copy is independent of the original.
  m.assert({ subject: "Priya", predicate: "works_at", value: "Globex" });
  assert.equal(restored.value("Priya", "works_at"), "Acme");
});

test("remember() extracts and asserts from natural language, including lowercase", () => {
  const m = new Memory();
  m.remember("priya works at stripe"); // lowercase
  m.remember("Priya now works at Acme.");
  assert.equal(m.value("Priya", "works_at"), "Acme");
  assert.equal(m.history("Priya").filter((c) => c.until !== null)[0]!.value, "stripe");
});

test("the bundled extractor handles common predicates and ignores subject-less input", () => {
  assert.equal(extract("Marcus moved to Seattle.")[0]!.predicate, "lives_in");
  assert.equal(extract("Dana is a designer.")[0]!.value, "designer");
  assert.deepEqual(extract("works at google"), []); // no subject
});
