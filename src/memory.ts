import type { AskResult, AssertOptions, Constraint, Fact, MemoryOptions, Snapshot } from "./types.js";
import { extract, parseIntent } from "./extract.js";

let _id = 0;
const nextId = () => `c${_id++}`;
const lc = (s: string) => s.toLowerCase();

/**
 * A temporal, typed-constraint memory.
 *
 * Facts are stored as `(subject, predicate, value)` constraints with a validity window.
 * For a single-valued predicate, asserting a new value *retracts* the previous one
 * (closes its window) instead of overwriting it — so "what's true now" stays correct,
 * the history is preserved, and a stale value never silently wins. Out-of-order asserts
 * never produce an inverted window.
 */
export class Memory {
  private constraints: Constraint[] = [];
  private step = 0;
  private readonly multi: Set<string>;

  constructor(options: MemoryOptions = {}) {
    this.multi = new Set(options.multiValued ?? []);
  }

  /** Record a structured fact. Returns the new constraint, or null if it was a no-op. */
  assert(fact: Fact, options: AssertOptions = {}): Constraint | null {
    const at = options.at ?? this.step + 1;
    this.step = Math.max(this.step, at);

    const current = this.currentRaw(fact.subject, fact.predicate);
    if (current.some((c) => lc(c.value) === lc(fact.value))) return null; // idempotent

    let until: number | null = null;
    if (!this.multi.has(fact.predicate)) {
      // Close values that began at or before this one; if a newer value already exists,
      // this (older) fact is born closed at that newer value's start — never inverted.
      const newerStarts = current.filter((c) => c.from > at).map((c) => c.from);
      for (const c of current) if (c.from <= at) c.until = at;
      until = newerStarts.length ? Math.min(...newerStarts) : null;
    }

    const constraint: Constraint = {
      id: nextId(),
      subject: fact.subject,
      predicate: fact.predicate,
      value: fact.value,
      confidence: fact.confidence ?? 1,
      from: at,
      until,
    };
    this.constraints.push(constraint);
    return constraint;
  }

  /** Extract facts from a natural-language statement and assert them. */
  remember(text: string, options: AssertOptions = {}): Constraint[] {
    return extract(text)
      .map((f) => this.assert(f, options))
      .filter((c): c is Constraint => c !== null);
  }

  /** Currently-believed facts about a subject. */
  current(subject: string): Constraint[] {
    return this.constraints.filter((c) => lc(c.subject) === lc(subject) && c.until === null);
  }

  /** The current value of a single-valued predicate, or null. */
  value(subject: string, predicate: string): string | null {
    const c = this.currentRaw(subject, predicate);
    return c.length ? c[c.length - 1]!.value : null;
  }

  /** All current values of a (possibly multi-valued) predicate. */
  values(subject: string, predicate: string): string[] {
    return this.currentRaw(subject, predicate).map((c) => c.value);
  }

  /** Full history for a subject, including retracted facts — the audit trail. */
  history(subject: string): Constraint[] {
    return this.constraints.filter((c) => lc(c.subject) === lc(subject));
  }

  /** Distinct subjects that have at least one constraint, in first-seen order. */
  subjects(): string[] {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of this.constraints) {
      if (!seen.has(lc(c.subject))) {
        seen.add(lc(c.subject));
        order.push(c.subject);
      }
    }
    return order;
  }

  /** Answer a question from current facts. Returns `{ answer: null }` if unknown. */
  ask(question: string): AskResult {
    const intent = parseIntent(question);
    if (intent) {
      const current = this.currentRaw(intent.subject, intent.predicate);
      if (current.length) {
        return { answer: current.map((c) => c.value).join(", "), constraint: current[current.length - 1] };
      }
    }
    return { answer: null };
  }

  /** Serialize the full state for persistence. */
  snapshot(): Snapshot {
    return { version: 1, step: this.step, constraints: this.constraints.map((c) => ({ ...c })) };
  }

  /** Reconstruct a Memory from a snapshot. */
  static from(snapshot: Snapshot, options: MemoryOptions = {}): Memory {
    const m = new Memory(options);
    m.step = snapshot.step;
    m.constraints = snapshot.constraints.map((c) => ({ ...c }));
    return m;
  }

  private currentRaw(subject: string, predicate: string): Constraint[] {
    return this.constraints.filter(
      (c) => lc(c.subject) === lc(subject) && c.predicate === predicate && c.until === null,
    );
  }
}
