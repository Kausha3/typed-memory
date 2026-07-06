# typed-memory

[![CI](https://github.com/Kausha3/typed-memory/actions/workflows/ci.yml/badge.svg)](https://github.com/Kausha3/typed-memory/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/typed-memory.svg)](https://www.npmjs.com/package/typed-memory)
[![npm downloads](https://img.shields.io/npm/dm/typed-memory.svg)](https://www.npmjs.com/package/typed-memory)
[![license](https://img.shields.io/npm/l/typed-memory.svg)](https://github.com/Kausha3/typed-memory/blob/main/LICENSE)

**A tiny temporal, typed-constraint memory.** Facts are stored with a validity window, so
when one changes it gets **retracted** instead of overwritten — *what's true now* stays
correct, the history is preserved, and a stale value never silently wins.

Zero dependencies. Works in Node and the browser, ESM and CJS, fully typed.

▶︎ **See it run:** [interactive playground](https://memory-playground-kausha-trivedis-projects.vercel.app)

```bash
npm install typed-memory
```

## The problem it solves

Most "memory" for AI agents is a pile of statements with similarity search on top. It
breaks the moment a fact changes: the old value still matches the query, so the agent
confidently cites a job, address, or preference the user updated months ago.

`typed-memory` models each fact as a `(subject, predicate, value)` constraint with a
time window. A new value for a single-valued predicate *closes* the old one rather than
deleting it — correct current answers, full audit trail, and no inverted windows even if
facts arrive out of order.

## Quick start

```ts
import { Memory } from "typed-memory";

const m = new Memory();

// Bring your own extraction (an LLM is ideal) and assert structured facts:
m.assert({ subject: "Priya", predicate: "works_at", value: "Stripe" });
m.assert({ subject: "Priya", predicate: "works_at", value: "Acme" }); // retracts Stripe

m.value("Priya", "works_at");  // "Acme"
m.ask("Where does Priya work?"); // { answer: "Acme", constraint: {...} }

m.history("Priya");
// [ { value: "Stripe", from: 1, until: 2 },   ← retracted, kept
//   { value: "Acme",   from: 2, until: null } ] ← current
```

Or use the built-in natural-language convenience for common predicates:

```ts
m.remember("Marcus lives in Boston.");
m.remember("Marcus moved to Seattle."); // retracts Boston
m.value("Marcus", "lives_in"); // "Seattle"
```

## API

| Method | Description |
|---|---|
| `new Memory(options?)` | `options.multiValued: string[]` — predicates that hold several concurrent values (default: all single-valued). |
| `assert(fact, opts?)` | Record a `{ subject, predicate, value, confidence? }`. `opts.at` sets explicit logical time. Returns the new `Constraint`, or `null` if it was a no-op. |
| `remember(text, opts?)` | Extract facts from natural language and assert them. Returns the created constraints. |
| `current(subject)` | Currently-believed constraints for a subject. |
| `value(subject, predicate)` | Current value of a single-valued predicate, or `null`. |
| `values(subject, predicate)` | All current values (for multi-valued predicates). |
| `history(subject)` | Every constraint, including retracted ones — the audit trail. |
| `subjects()` | Distinct subjects, in first-seen order. |
| `ask(question)` | `{ answer, constraint? }` from current facts, or `{ answer: null }`. |
| `snapshot()` / `Memory.from(snapshot)` | Serialize and restore the full state. |

### Multi-valued predicates

```ts
const m = new Memory({ multiValued: ["tag"] });
m.assert({ subject: "Priya", predicate: "tag", value: "founder" });
m.assert({ subject: "Priya", predicate: "tag", value: "infra" });
m.values("Priya", "tag"); // ["founder", "infra"]  (accumulate, no retraction)
```

## Notes

- **Extraction is pluggable.** The built-in `remember()` recognizes a small set of common
  predicates so it works out of the box; for anything real, do your own extraction (e.g.
  with a model) and call `assert()`. The memory semantics are the point — extraction is
  just a convenience.
- **Out-of-order safe.** Asserting an older fact after a newer one never clobbers the
  newer value or produces a window where `until < from`.

## Related

Part of a line of work on agent memory:
[agent-memory-bench](https://github.com/Kausha3/agent-memory-bench) (benchmark) ·
[memory-playground](https://github.com/Kausha3/memory-playground) (live demo) ·
[kith](https://github.com/Kausha3/kith) (application) ·
[ccc-typed-constraint-memory](https://github.com/Kausha3/ccc-typed-constraint-memory) (research).

## License

MIT
