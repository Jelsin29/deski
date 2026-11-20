# Architecture: foundation and next boundaries

The current foundation has two separate applications. The desktop calls the
loopback backend through its IPC bridge, while a root development command can
start both. The desktop does not manage the backend process lifecycle.

## Current responsibilities

| Location | Implemented responsibility |
| --- | --- |
| `apps/desktop/src/main/` | Electron window lifecycle, validated IPC handlers, backend HTTP client and opt-in fake API |
| `apps/desktop/src/preload/` | Narrow typed `window.deski` bridge over IPC |
| `apps/desktop/src/renderer/` | Framework-free TypeScript chat UI (features, Atomic Design components, pages) |
| `apps/backend/app/main.py` | FastAPI application composition and router registration |
| `apps/backend/app/api/v1/` | Health and Chat/Document/Settings/Token contracts; unwired services return 503 |
| `packages/api-types/` | Generated declarations from public `app.openapi()` |
| `scripts/` | Local generation, developer process coordination, wheel build and fixture tests |
| `docs/` | Architecture and AI-use records |

Electron main is privileged; the renderer must remain separate from Node.js and
operating-system APIs. The window enables sandboxing and context isolation,
disables Node integration, and denies navigation, new windows, and permissions.
Its CSP keeps content local and denies network connections: the renderer reaches
the backend only through the preload bridge, whose IPC payloads the main process
validates before forwarding them over HTTP. See the
[desktop contract](../apps/desktop/README.md) for controls and verification limits.

Atomic Design applies to **UI composition**, not the backend. The chat UI now
has real reuse, so it uses atoms (icons, buttons), molecules (attachment chips,
messages, notices), organisms (sidebar, composer, message list) and pages.
Lower-level UI tiers must not import pages.

FastAPI exposes `GET /api/v1/health` as liveness, not database or AI readiness.
Routes belong in the versioned API layer; future use cases belong in services.
The [backend contract](../apps/backend/README.md) describes its in-process test
and loopback-only development launch. There is no authentication or CORS policy
for desktop integration, and the scaffold must not be exposed to a network.

## Planned architecture — not implemented

Desktop-managed backend startup is future work: define ownership, loopback binding,
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
