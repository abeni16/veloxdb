# AGENTS.md — VeloxDB

Compact guidance for AI agents working in this repo. Read before making changes.

## What This Is

VeloxDB is a **Tauri 2 desktop app** — a PostgreSQL/MySQL/SQLite client. React 19 + TypeScript frontend, Rust backend via Tauri IPC bridge. Local-first: no cloud, no middleware, data flows directly to your database.

## Quick Reference

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install JS dependencies |
| `pnpm dev` | Frontend-only dev server (port 3000, no Rust backend) |
| `pnpm tauri` | Full desktop app with hot-reload (Rust + React) |
| `pnpm build` | TypeScript check (`tsc -b`) + Vite build → `build/` |
| `pnpm tauri:build` | Production desktop bundle |
| `pnpm test` | Run Vitest tests |
| `pnpm lint` | Run ESLint |

**Local dev database**: `docker compose -f docker-compose.pg.yml up -d` (localhost:15432, user=velox, password=velox, db=veloxdb)

## Architecture

```
src/                          # Frontend (React + TypeScript)
  main.tsx                    # Entry point
  App.tsx                     # Root component (sidebar, workspaces, dialogs)
  features/<area>/            # Feature modules (UI + local query hooks)
  data/                       # Shared data layer
    repositories/             # Repository pattern (VeloxDbRepository interface)
    query-keys.ts             # TanStack Query key factory
    types.ts                  # TypeScript types for all data contracts
    query-client.ts           # Desktop-friendly TanStack Query defaults
  components/ui/              # shadcn/ui primitives (button, dialog, tabs, etc.)
  lib/                        # Shared utilities (tauri.ts, app-error.ts, settings.ts, etc.)

src-tauri/                    # Rust backend (Tauri commands + DB access)
  src/
    lib.rs                    # App bootstrap, IPC handler registration
    commands.rs               # All Tauri IPC command handlers
    db.rs                     # Connection pool management (deadpool-postgres, sqlx)
    models.rs                 # Rust data models
    ssh_tunnel.rs             # SSH tunnel implementation
    credentials.rs            # OS keychain integration
    export.rs                 # Diagram/query export (PNG, CSV, JSON)
```

## Key Patterns

### Repository Pattern
All data access goes through `VeloxDbRepository` interface (`src/data/repositories/VeloxDbRepository.ts`). The Tauri implementation (`TauriVeloxDbRepository.ts`) calls `invoke()` to cross the IPC bridge. New data operations must:
1. Add method to `VeloxDbRepository` interface
2. Implement in `TauriVeloxDbRepository` using `invokeCommand()` wrapper
3. Add corresponding `#[tauri::command]` in `src-tauri/src/commands.rs`
4. Register command in `lib.rs` `invoke_handler` list

### TanStack Query
Desktop-friendly defaults in `src/data/query-client.ts`:
- `staleTime: 60s`, `gcTime: 30min`
- `refetchOnWindowFocus: false`, `refetchOnReconnect: false`
- `retry: 1` for queries, `retry: 0` for mutations

Query keys are centralized in `src/data/query-keys.ts`. Use them — don't create ad-hoc key strings.

### Multi-Engine Support
The app supports PostgreSQL, MySQL, and SQLite. Backend routing uses `DatabaseEngine` enum. When adding features, handle all three engines or explicitly gate (e.g., Model workspace is PostgreSQL-only).

### State Management
- **Zustand**: Local UI state (stores in `src/features/*/state/`)
- **TanStack Query**: Server state (connections, tables, schema, query results)
- **localStorage**: Layout preferences (sidebar width, results height, last active connection)

### Components
shadcn/ui with `radix-lyra` style. Components in `src/components/ui/`. Extend via variants, not one-off inline styling. Icon library: Phosphor Icons (`@phosphor-icons/react`).

## Conventions

### Must Follow
- **pnpm only** — never npm or yarn
- **Path alias**: `@/*` maps to `./src/*`
- **TypeScript strict** — no `any`, proper typing required
- **No `useEffect` for derivable state** — prefer render-time derivation, event handlers, refs, TanStack Query callbacks
- **Virtual scrolling** for large result sets — respect `truncated` behavior from backend
- **Async Rust handlers** — no blocking I/O in Tauri command handlers
- **Scoped changes** — don't refactor unrelated areas
- **Error handling**: Use `AppErrorLike` + `normalizeError` pattern for IPC errors. Never swallow errors silently.

### File Naming
- Components: `PascalCase.tsx` (e.g., `QueryWorkspace.tsx`)
- Utilities/hooks: `camelCase.ts` or `kebab-case.ts` (e.g., `app-error.ts`, `query-keys.ts`)
- Tests: `*.test.ts` co-located with source files

### Rust Conventions
- Follow `rustfmt` defaults
- `unwrap()` is not allowed — use proper error handling with `?` or `.map_err()`
- New commands: register in `lib.rs`, implement in `commands.rs`, add frontend repository method
- Connection pool constants in `db.rs`: `MAX_QUERY_ROWS=1000`, `POOL_MAX_SIZE=6`

## Testing

- **Framework**: Vitest (frontend only, no Rust tests in this repo)
- **Location**: Tests co-located with features (`src/features/*/...test.ts`, `src/lib/*.test.ts`)
- **Run**: `pnpm test` (runs all), or `pnpm vitest run <path>` for specific files
- **Pattern**: Table-driven tests preferred

## Build & CI

- **Dev server**: `localhost:3000` (strict port, configured in `vite.config.ts`)
- **Build output**: `build/` directory (Vite), `src-tauri/target/` (Rust)
- **CI**: GitHub Actions (`desktop-build.yml`) — builds for Linux, Windows, macOS on push/PR to main
- **Node**: 20+ (CI uses 22)
- **Rust**: stable toolchain

## Gotchas

- **Tauri IPC**: Frontend calls Rust via `invoke('command_name', { args })`. Errors cross the bridge as strings — use `normalizeError()` to parse them.
- **SSH tunnels**: Managed in `AppState.ssh_tunnels`. Tunnels are auto-closed when window is destroyed.
- **Credentials**: Stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux secret-service). SQLite connections don't use keychain.
- **Connection store**: Persisted via `tauri-plugin-store` at `connections.json`.
- **Model workspace**: PostgreSQL-only. Other engines show a disabled state.
- **React Compiler**: Uses `babel-plugin-react-compiler` via Vite plugin. The compiler auto-memoizes — don't add manual `useMemo`/`useCallback` unless the compiler can't optimize (e.g., hooks with stable references).
- **Tailwind CSS 4**: Uses `@tailwindcss/vite` plugin, not PostCSS. Config in `tailwind.config.js` is minimal — most styling is via utility classes.

## Existing Instruction Files

- `.cursor/rules/veloxdb-core-standards.mdc` — Cursor-specific conventions (always-apply). Contains additional guidance on TanStack Query defaults, virtualization, and component patterns. Referenced rules are consistent with this file.
