---
name: veloxdb-scalable-performance
description: >-
  Guides scalability and performance work for VeloxDB's Tauri + Rust PostgreSQL
  backend and React + TanStack frontend. Covers pnpm-only tooling, src/ file
  layout (features, data, components/ui, lib), connection pooling, bounded query
  results, IPC payload size, TanStack Query defaults, virtualization, memo
  patterns, minimal useEffect usage, and shadcn-style UI consistency. Use when
  the user asks about performance, memory, latency, large result sets, slow
  queries, pooling, caching, N+1 patterns, scaling the UI, effects/hooks, repo
  structure, package manager, or component styling aligned with the design system.
---

# VeloxDB scalable performance

VeloxDB is a **desktop Tauri 2** app: the UI invokes **async Tauri commands** in Rust, which talk to PostgreSQL via **`deadpool_postgres`**. The frontend uses **TanStack Query**, **TanStack Table**, and **TanStack Virtual** where large grids matter. Prefer stack-specific guidance over generic web scaling advice.

## Package manager and file structure

- **pnpm only**: Use **pnpm** for all JavaScript tooling in this repo—`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm exec`, `pnpm add` / `pnpm remove`, and `pnpm tauri` / `pnpm tauri:build`. Do not suggest or run **npm** or **yarn** for installs or scripts unless the user is explicitly migrating lockfiles.
- **Layout (keep new code in the right place)**:
  - **`src/features/<area>/`** — Product features: `components/` for screens/widgets, colocated `queries.ts` (or `*.ts`) for TanStack Query hooks and feature types that are not global. Examples: `features/connections`, `features/queries`, `features/schema`, `features/tables`, `features/commands`.
  - **`src/data/`** — App-wide data layer: `types.ts`, `query-client.ts`, `query-keys.ts`, `repositories/` (Tauri `invoke` boundaries and repository interfaces). Shared fetch/cache contracts live here, not inside random feature folders.
  - **`src/components/ui/`** — Reusable, design-system-style primitives (shadcn-style). **`src/components/`** (outside `ui/`) for shared non-primitive pieces such as `ErrorBoundary.tsx`.
  - **`src/lib/`** — Small shared helpers (e.g. `utils.ts`, `tauri.ts`) with no feature-specific UI.
  - **`src/App.tsx`**, **`src/main.tsx`** — Application shell and bootstrap; avoid bloating them—compose from features instead.
  - **`src-tauri/`** — Rust backend, Tauri config, and commands; pair frontend changes with the right module in `src-tauri/src/` when touching IPC or DB.

## Rust / Tauri (`src-tauri/`)

- Use **async** Tauri commands and the **tokio** runtime; do not block on synchronous I/O in command handlers.
- Reuse **connection pooling** through `AppState` (`RwLock<HashMap<String, Pool>>`), `build_pool`, and `get_or_create_pool` in [`src-tauri/src/db.rs`](src-tauri/src/db.rs). New features that open ad hoc clients should justify why they bypass the pool.
- **`MAX_QUERY_ROWS`** in `db.rs` caps rows materialized for the UI path. [`run_query`](src-tauri/src/commands.rs) sets `truncated` when more rows exist than returned. Any streaming, pagination, or export design must stay consistent with this contract (or deliberately replace it end-to-end).
- **IPC payloads**: Tauri serializes command results to the webview. Avoid returning unbounded `Vec`s; for large exports or dumps, prefer chunking, writing to disk from Rust, or explicit user-scoped limits.
- **Pool lifecycle**: Pools are stored per `connection_id`. If adding many connections or long-lived sessions, consider eviction or caps so the map does not grow without bound.

## Frontend (`src/`)

- **TanStack Query**: Default client behavior lives in [`src/data/query-client.ts`](src/data/query-client.ts) (`staleTime`, `gcTime`, `refetchOnWindowFocus: false`, etc.). Preserve desktop-oriented defaults; override in individual `useQuery` options only when the feature needs different freshness or retries.
- **Large grids**: Follow [`src/features/queries/components/ResultsGrid.tsx`](src/features/queries/components/ResultsGrid.tsx)—**`@tanstack/react-virtual`** for rows, stable keys, and memoized column defs. New heavy tables should virtualize rather than rendering all DOM nodes.
- **Trees / sidebars**: [`src/features/connections/components/ConnectionsSidebarTree.tsx`](src/features/connections/components/ConnectionsSidebarTree.tsx) uses `useMemo` / `useCallback` for filtered data and handlers. Extend in the same style; debounce or narrow dependencies for search/filter so the whole tree is not recomputed on every keystroke without reason.
- **`useEffect`**: Avoid it unless necessary. Prefer **derived state during render**, **event handlers**, **TanStack Query** (`data` / status for render-time branching; **`useMutation`** callbacks such as `onSuccess` when an imperative follow-up is required), and **refs** for values that should not trigger re-renders. Reserve `useEffect` for real **external synchronization**: subscriptions, DOM/layout measurement, imperative browser or third-party APIs, or Tauri listeners that must mount/unmount with the component.
- **shadcn-style UI**: Compose from existing primitives in [`src/components/ui/`](src/components/ui/) (Radix-based patterns, `class-variance-authority`, `tailwind-merge`, Tailwind v4 tokens). Match established spacing, typography, focus rings, and disabled states; extend with `cva` variants instead of one-off inline styles. New shared widgets belong under `src/components/ui/` following the same patterns as [`button.tsx`](src/components/ui/button.tsx), [`dialog.tsx`](src/components/ui/dialog.tsx), etc.
- **React Compiler**: The project uses `babel-plugin-react-compiler`. Avoid piling on `useMemo`/`memo` unless profiling or semantics require it.

## PostgreSQL and product behavior

- Prefer **bounded reads** (`LIMIT`, and keyset/cursor pagination for future features). Make truncation obvious in the UI when `truncated` is true.
- When discussing user databases, mention **indexes** and **`EXPLAIN`**-style reasoning where it helps; keep DBA depth proportional to the task.

## Change checklist

- Identify the **hot path**: IPC serialization, PostgreSQL execution, or React render.
- Reason about **scale**: row counts, number of connections/pools, tree depth, query frequency.
- **Reuse** existing patterns: repositories and `invoke` usage under [`src/data/`](src/data/).
- Keep edits **scoped** to the user’s request; do not refactor unrelated code for performance without cause.

## Optional: slash-only invocation

To require explicit invocation, add `disable-model-invocation: true` to the YAML frontmatter above (see [Cursor Agent Skills](https://cursor.com/docs/skills)).
