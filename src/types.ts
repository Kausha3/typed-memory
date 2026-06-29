/** A fact to record: who, what relation, what value. Predicate is a free-form string. */
export interface Fact {
  subject: string;
  predicate: string;
  value: string;
  /** Optional confidence in [0,1]. Defaults to 1. */
  confidence?: number;
}

/**
 * A stored fact with a validity window. `until === null` means it is still believed
 * true; a number means it was retracted at that step. Facts are never overwritten, so
 * the full history (and provenance) is preserved.
 */
export interface Constraint {
  id: string;
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  from: number;
  until: number | null;
}

export interface MemoryOptions {
  /**
   * Predicates that may hold several concurrent values (set-valued), e.g. "tag" or
   * "interested_in". For these, a new value is added rather than retracting the old.
   * Everything not listed is single-valued: a new value retracts the prior one.
   */
  multiValued?: string[];
}

export interface AssertOptions {
  /**
   * Explicit logical time for this fact (e.g. a unix timestamp). Defaults to an
   * internal monotonically increasing counter. Out-of-order asserts are handled safely.
   */
  at?: number;
}

export interface AskResult {
  /** The current value, or null if nothing is known for the parsed question. */
  answer: string | null;
  /** The constraint the answer came from, when answered from a typed fact. */
  constraint?: Constraint;
}

export interface Snapshot {
  version: 1;
  step: number;
  constraints: Constraint[];
}
