# Deski

Deski is a group course project exploring an AI-assisted desktop application.
This delivery contains foundations only: an Electron/TypeScript desktop shell,
local FastAPI HTTP contracts, generated API types, and contribution documentation. It is not a
working AI assistant or a finished course submission.

## Start here

- [Desktop setup and boundaries](apps/desktop/README.md)
- [Backend setup and boundaries](apps/backend/README.md)
- [Architecture: current and planned](docs/architecture.md)
- [Contributing and team workflow](CONTRIBUTING.md)
- [AI usage, challenges, and solutions](docs/ai-usage.md)

The initial independent foundation PRs are merged. The backend-contract delivery
and its dependent tooling/types delivery form a new stacked chain: contracts
first, tooling second, ultimately targeting `main`. Review and merge decisions
belong to the human team.

- [Shared development, type generation, and wheel tooling](docs/development-tooling.md)

## Local setup

Prerequisites: Node.js 22 (`>=22.12.0 <23`), npm 10, Python 3.12
(`>=3.12,<3.13`), and uv. Use the committed npm and uv lockfiles.

From the repository root:

```sh
npm ci
npm run dev
```

`npm run dev` coordinates a loopback backend and the existing desktop build/launch.
It does **not** connect Electron to the backend. Ctrl-C or either child exiting
stops the other process tree. Use `npm run dev:desktop` for desktop-only development.

The pinned Electron package acquires its native binary lazily on first launch,
which may require network access. Development compiles once and opens the built
local page; there is no hot reload. Close and rerun after changes. For compile/test
setup, `npm ci --ignore-scripts` suppresses npm lifecycle scripts, not a later lazy
binary download. Do not run `npm run dev` when download or launch is unwanted.

For backend-only development (do not run alongside `npm run dev` on port 8000):

```sh
cd apps/backend
uv sync --locked
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Stop with Ctrl-C. `GET http://127.0.0.1:8000/api/v1/health` returns HTTP 200
and `{"status":"ok"}`; development API docs are at `/docs`. Keep this
unauthenticated server on loopback. No secrets or environment variables are
needed. The desktop executable itself does **not** start or connect to the backend.
Unwired teammate-owned Chat, Document, Settings, and Token services deliberately
return HTTP 503, never fake success.

## Current scope and verification limits

| Available foundation | Planned, not implemented |
| --- | --- |
| Local Electron window and static TypeScript page | Preload/IPC bridge and backend process management |
| FastAPI contracts, liveness, and in-process tests | SQLite persistence, schema changes, and application services |
| Generated OpenAPI TypeScript types and Python wheel build | Standalone backend executable and installers |
| Type checks, renderer tests, backend tests and Ruff checks | AI integrations, RAG, authentication, and desktop control |

Compile/test setup was checked on macOS, not a running Electron window.
Windows and Linux are unverified; desktop runtime, accessibility, and integration
remain unverified too. The build emits code/assets, not an installer. There is
no installer packaging, signing, or CI configuration. The backend wheel is a
Python package, not a standalone executable. See each app README for exact limits.

## Course and collaboration

Course source: [AI-based development lecture](https://github.com/Jelsin29/ai-based-development-lecture).
Its README calls for at least three PRs, balanced real contributions, documented
AI use, architecture/challenges/solutions, and eventual database use. These
foundations support that work; they do not establish that final requirements are
fulfilled. Coordinate tasks through issues, keep PRs small and focused, and have
another teammate review. Do not fabricate contributions or commit history.
