# Deski

Deski is a group course project exploring an AI-assisted desktop application.
This delivery contains foundations only: an Electron/TypeScript desktop shell,
a local FastAPI health endpoint, and contribution documentation. It is not a
working AI assistant or a finished course submission.

## Start here

- [Desktop setup and boundaries](apps/desktop/README.md)
- [Backend setup and boundaries](apps/backend/README.md)
- [Architecture: current and planned](docs/architecture.md)
- [Contributing and team workflow](CONTRIBUTING.md)
- [AI usage, challenges, and solutions](docs/ai-usage.md)

**Independent PRs:** the Electron foundation, FastAPI foundation, and documentation
are three independent PRs, each targeting `main`, not a stacked chain. The app
links above become available only after their respective PRs merge. This docs
branch does not contain either app; the instructions below describe the intended
combined checkout. Merge decisions belong to the human team.

## Local setup

Prerequisites: Node.js 22 (`>=22.12.0 <23`), npm 10, Python 3.12
(`>=3.12,<3.13`), and uv. Use the committed npm and uv lockfiles.

From the repository root, after the Electron PR merges:

```sh
npm ci
npm run dev
```

The pinned Electron package acquires its native binary lazily on first launch,
which may require network access. Development compiles once and opens the built
local page; there is no hot reload. Close and rerun after changes. For compile/test
setup, `npm ci --ignore-scripts` suppresses npm lifecycle scripts, not a later lazy
binary download. Do not run `npm run dev` when download or launch is unwanted.

In a separate terminal, after the backend PR merges:

```sh
cd apps/backend
uv sync --locked
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Stop with Ctrl-C. `GET http://127.0.0.1:8000/api/v1/health` returns HTTP 200
and `{"status":"ok"}`; development API docs are at `/docs`. Keep this
unauthenticated server on loopback. No secrets or environment variables are
needed. Starting Electron does **not** start or connect to the backend.

## Current scope and verification limits

| Available foundation | Planned, not implemented |
| --- | --- |
| Local Electron window and static TypeScript page | Preload/IPC bridge and backend process management |
| FastAPI liveness endpoint and in-process test | SQLite persistence, schema changes, and application services |
| Type checks, renderer tests, backend tests and Ruff checks | AI integrations, RAG, authentication, and desktop control |

Compile/test setup was checked on macOS, not a running Electron window.
Windows and Linux are unverified; desktop runtime, accessibility, and integration
remain unverified too. The build emits code/assets, not an installer. There is
no packaging, signing, or CI configuration. See each app README for exact limits.

## Course and collaboration

Course source: [AI-based development lecture](https://github.com/Jelsin29/ai-based-development-lecture).
Its README calls for at least three PRs, balanced real contributions, documented
AI use, architecture/challenges/solutions, and eventual database use. These
foundations support that work; they do not establish that final requirements are
fulfilled. Coordinate tasks through issues, keep PRs small and focused, and have
another teammate review. Do not fabricate contributions or commit history.
