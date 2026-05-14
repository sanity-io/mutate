# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`@sanity/mutate` is an experimental TypeScript toolkit for working with Sanity mutations: declarative/composable mutation creators, an in-memory document apply engine, and an optimistic local store with rebase semantics. It's a single-package pnpm workspace; `examples/*` are workspace members used only for examples and `typecheck:examples`.

## Common commands

Package manager is **pnpm**.

- `pnpm dev` — `pkg watch` (rebuild dist on change)
- `pnpm build` — `pkg build --strict --check --clean` (uses `@sanity/pkg-utils` with `package.config.ts`; dts via rolldown)
- `pnpm test` — vitest run with typecheck (`--typecheck` uses `tsconfig.dist.json`)
- `pnpm test:watch` / `pnpm test:ui` — watch + UI mode
- `pnpm coverage` — `vitest run --coverage`
- Run a single test file: `pnpm vitest run path/to/file.test.ts` (most live in `src/**/__test__` or `src/**/__tests__`; the few top-level tests are in `test/`)
- Run a single test by name: `pnpm vitest run -t "test name"`
- `pnpm typecheck` — `tsc --noEmit -p tsconfig.dist.json` (src only)
- `pnpm typecheck:examples` — typecheck each example workspace
- `pnpm lint` / `pnpm format` — eslint and prettier
- `pnpm check` — full pre-PR check: `typecheck` → `typecheck:examples` → `pkg:build` → `test`
- Run an example: `pnpm example:web` or `pnpm example:visual-editing`

## Architecture

The package exports four distinct entry points, each backed by a `src/_*.ts` shim that re-exports from a directory. Adding a new public surface means adding both the shim and a corresponding `exports` entry in `package.json`:

- `@sanity/mutate` (`src/index.ts`) — mutation creators, operation creators, encoders, autoKeys
- `@sanity/mutate/path` (`src/_path.ts`) — path parsing/stringifying utilities
- `@sanity/mutate/_unstable_apply` (`src/_unstable_apply.ts` → `src/apply/`) — pure functions that apply mutations to in-memory documents
- `@sanity/mutate/_unstable_machine` (`src/_unstable_machine.ts` → `src/machine/`) — lower-level building blocks (apply/commit/rebase/squash + xstate-based document mutator machine; `xstate` is an optional peer dep)
- `@sanity/mutate/_unstable_store` (`src/_unstable_store.ts` → `src/store/`) — higher-level optimistic store with listeners and client / in-memory backends

### Module layout

- `src/mutations/` — the core data model
  - `types.ts` — `Mutation`, `PatchMutation`, `NodePatch`, `SanityDocumentBase`, `Transaction`
  - `operations/types.ts` + `operations/creators.ts` — `Operation` union (`SetOp`, `InsertOp`, `UpsertOp`, `DiffMatchPatchOp`, …) and the public creator functions (`set`, `insert`, `upsert`, etc.)
  - `creators.ts` — top-level mutation creators (`create`, `createIfNotExists`, `createOrReplace`, `patch`, `at`, `delete_`/`del`/`destroy`)
  - `autoKeys.ts` — automatic `_key` injection for array items
- `src/path/` — path representation (`Path = PathElement[]`, where `PathElement = string | number | {_key: string}`), with a parser/stringifier for the JSONMatch-like string form
- `src/encoders/` — three serialization targets that all consume the internal `Mutation` shape:
  - `sanity/` — Sanity HTTP mutation API payload (`SanityEncoder`)
  - `compact/` — compact JSON form (`CompactEncoder`)
  - `form-compat/` — form-compatible encoding (`FormCompatEncoder`)
- `src/formatters/compact.ts` — human-readable string formatter (`CompactFormatter`)
- `src/apply/` — pure in-memory application
  - `applyPatchMutation` (single doc), `applyInCollection` (array of docs), `applyInIndex` (id-keyed map)
  - `patch/applyNodePatch.ts`, `patch/applyOp.ts` — the operation dispatcher
  - **Referential-integrity invariant**: when a mutation is a no-op (or only affects part of a tree), unaffected nodes/objects must keep the same object identity. Tests in `src/apply/__test__/` and `test/shallow-ops.test.ts` enforce this — preserve it in any change to apply logic.
- `src/store/` — optimistic in-memory dataset replica
  - `optimistic/createOptimisticStore.ts` — public store with `mutate`/`transaction`/`submit`/`listen`/`listenEvents` (see `OptimisticStore` in `store/types.ts`)
  - `optimistic/backend/` — `createOptimisticStoreClientBackend` (real `@sanity/client`) and `createOptimisticStoreInMemoryBackend` (tests)
  - `optimistic/rebase.ts` + `optimistic/optimizations/` — rebase staged mutations onto remote state; squash diff-match-patch strings and consecutive mutation groups
  - `listeners/` — RxJS-based document/idSet/shared listeners on top of the Sanity listener endpoint
  - `documentMap/` — `applyMutations` + `commit` primitives shared with the machine entry point
- `src/machine/` — `documentMutatorMachine.ts` (xstate v5 actor) plus a re-export of the store's apply/commit/rebase/squash primitives
- `src/utils/` — small shared utilities (`arrify`, `isObject`, `typeUtils`)

### Differences from the Sanity API (apply semantics)

`@sanity/mutate` is intentionally a strict subset of Sanity's mutation semantics — keep this in mind when touching `src/apply/`:

- `set` / `setIfMissing` do **not** create intermediate empty objects. They only apply when the parent already exists.
- Patches target a single node. JSON-match multi-target selection is not supported.

## Conventions

- **Strict TypeScript** with `noUncheckedIndexedAccess`. Public APIs are heavily generic-typed (e.g. `at`, `patch`, `set` use `const` type parameters to preserve literal types and path tuples) — when editing creators, keep tuple/literal inference working.
- **Import order** enforced by `simple-import-sort`; **type-only imports** required (`@typescript-eslint/consistent-type-imports`, `prefer-inline`).
- `no-console` is **error**; allowed in `examples/ts/**`.
- Test files live next to source under `__test__/` or `__tests__/` directories (both naming styles exist; match the surrounding directory).
- Releases are managed by **release-please** (`.release-please-manifest.json`, `release-please-config.json`); don't hand-edit `CHANGELOG.md` or bump `version` in `package.json`.
- The `pnpm-workspace.yaml` sets a `minimumReleaseAge` for dependencies (with `@sanity/*`, `groq-js`, and `react-multiplayer-input` excluded as first-party / owned packages) — fresh third-party dependency versions will be rejected by pnpm install until they age. Never add to `minimumReleaseAgeExclude` without explicit approval.

### Error handling

This codebase uses the [**errore**](https://github.com/remorses/errore) convention: errors are values, not exceptions. Read `node_modules/errore/skills/errore/SKILL.md` before writing or reviewing any code that handles errors — it is the authoritative spec.

Core rules (the ones most easily violated):

- **Bare `Error | T` unions, no `Result<T, E>` wrapper.** Discriminate with `instanceof Error`.
- **`import * as errore from 'errore'`** — namespace import only, never destructure.
- **Never `throw` for expected failures.** Throws are reserved for invariant violations and exhaustiveness defaults — i.e. panics. Operational failures return tagged errors.
- **Never reject Promises.** Functions return `Promise<Error | T>`. `.catch((e) => new MyError({cause: e}))` lives only at the lowest boundary with third-party throwing code.
- **Define tagged errors with `errore.createTaggedError`** — gives `_tag`, `$variable` message interpolation, `cause`, `findCause`, `toJSON`, fingerprinting, and a static `.is()` guard.
- **Success types must never extend `Error`.** If they do, `Error | T` collapses and `instanceof Error` matches both sides. This is the single biggest trap. Listener events are emitted as `MutationEvent | DisconnectError | ChannelError | …` — none of the event types extend `Error`.
- **Co-locate error classes per domain** — `src/path/errors.ts`, `src/apply/errors.ts`, `src/store/listeners/errors.ts`, etc. No central taxonomy module.

#### RxJS extension (project-specific — errore's skill doesn't cover Observables)

- **The RxJS `error` channel is reserved for panics** — same rule as `throw`. An Observable that errors operationally is a bug.
- **Translate at the boundary.** Adapt throwing sources with `catchError(e => of(new SomeError({cause: e})))` at the lowest operator chain. After that, every downstream operator handles `T | E`. Inline `instanceof Error` checks in `map`/`filter` are fine for one-offs; lift to internal helpers in `src/store/utils/rxOk.ts` only when duplication is real.
- **Never use RxJS `retry`/`retryWhen`.** They operate on the error channel, which we've reserved for panics. When retry is genuinely needed, implement it as `retryWhile(predicate)` over `T | E` values. Don't build it speculatively — wait for a real call site.
- **xstate boundary exception.** xstate's runtime contract for synchronous code inside `assign` / `input` factories / `enqueueActions` is that throwing routes the actor or assigner to its `onError` transition. The machine already represents errors via context (`error: unknown`) plus three failure states (`connectFailure`, `loadFailure`, `submitFailure`). The four `if (result instanceof Error) throw result` checks in `src/machine/documentMutatorMachine.ts` are deliberate: they translate errore values back into xstate's throw-based error pipeline at the framework boundary. Treat xstate the way the errore skill treats `JSON.parse` or `fetch` — a third-party lib whose API uses throws. Do not refactor these into custom error events.
