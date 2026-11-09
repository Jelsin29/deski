# Architecture: foundation and next boundaries

The current foundation has two separate applications. They do not communicate
with each other yet. A root developer convenience command can start both; this
is not desktop-managed backend integration.

## Current responsibilities

| Location | Implemented responsibility |
| --- | --- |
| `apps/desktop/src/main/main.ts` | Electron window lifecycle; loads built local HTML |
| `apps/desktop/src/renderer/` | Static, framework-free TypeScript UI |
| `apps/desktop/src/renderer/pages/` | Concrete scaffold page and safe title rendering |
| `apps/backend/app/main.py` | FastAPI application composition and router registration |
| `apps/backend/app/api/v1/` | Health and Chat/Document/Settings/Token contracts; unwired services return 503 |
| `packages/api-types/` | Generated declarations from public `app.openapi()` |
| `scripts/` | Local generation, developer process coordination, wheel build and fixture tests |
| `docs/` | Architecture and AI-use records |

Electron main is privileged; the renderer must remain separate from Node.js and
operating-system APIs. The scaffold enables sandboxing and context isolation,
disables Node integration, and denies navigation, new windows, and permissions.
Its CSP keeps content local and denies network connections. There is no preload,
IPC bridge, or renderer/backend connection. See the
[desktop contract](../apps/desktop/README.md) for controls and verification limits.

Atomic Design applies to **UI composition**, not the backend. Only the page tier
is warranted now; native HTML provides basic atoms. Add custom atoms, molecules,
organisms, or templates when actual reuse/composition needs them. Five empty
mandatory folders are not architecture. Lower-level UI tiers must not import pages.

FastAPI exposes `GET /api/v1/health` as liveness, not database or AI readiness.
Routes belong in the versioned API layer; future use cases belong in services.
The [backend contract](../apps/backend/README.md) describes its in-process test
and loopback-only development launch. There is no authentication or CORS policy
for desktop integration, and the scaffold must not be exposed to a network.

## Planned architecture — not implemented

A future preload would expose a narrow, typed API through an isolated bridge,
not raw Node.js, shell, or unrestricted IPC access. Before adding it, define
message validation, caller authorization, and error handling. Desktop-managed
backend startup is also future work: define ownership, loopback binding,
readiness checks, bounded startup/shutdown, crash handling, and cleanup so child
processes do not outlive the app. A health response alone is not an integration
security design. Today `npm run dev` only coordinates development processes;
it adds no readiness handshake, IPC, renderer networking, or executable behavior.

Create backend boundaries only when functionality needs them:

| Future module | Responsibility |
| --- | --- |
| `app/core/` | Validated settings and cross-cutting policy |
| `app/db/` | Connections, persistence, and transaction boundaries |
| `app/schemas/` | Request/response data contracts |
| `app/services/` | Application use cases, independent of HTTP transport |
| `app/rag/` | Retrieval and indexing workflows |
| `app/llm/` | Model-provider adapters and model-call boundaries |

Future routes should call services rather than perform persistence or provider
calls directly. Supplied project notes plan **SQLite**; no database, migrations,
or persistence code exists. Storage location, schema, migration strategy, and
privacy policy still need decisions. AI providers, secrets, authentication, and
retrieval design likewise remain future work, not implied scaffold capabilities.

## Reference choices

- [gentle-ai](https://github.com/Gentleman-Programming/gentle-ai): clear README and
  contribution guidance, focused changes, and small PRs; not its mandatory
  approval labels, issue-approval process, or agent harness machinery.
- [gentle-dot](https://github.com/Gentleman-Programming/gentle-dot): separation of
  apps, packages, and docs as a growth pattern. Deski's shared API-types package
  is generated, not a second manually maintained HTTP contract; the reference's
  Tauri/Rust stack is not adopted.
- [gentle-shell](https://github.com/Gentleman-Programming/gentle-shell): a reference
  for organized project material, not a source of specialized assets to copy.

These references inform boundaries, not a product clone or extra implementation
scope. Runtime and platform limitations are summarized in the [root README](../README.md).
