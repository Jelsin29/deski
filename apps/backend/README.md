# Deski backend

Scaffold only: a FastAPI application with a deterministic health route. There is
no database, AI/RAG implementation, authentication, token issuance, or desktop
process orchestration.

## Requirements and setup

Use uv and Python 3.12 (supported range: `>=3.12,<3.13`, selected in
`.python-version`). The scaffold was checked with Python 3.12.16 and uv 0.13.6.
Run all commands below from `apps/backend`:

```sh
uv sync --locked
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The explicit development bind is loopback only. Stop the server with Ctrl-C.
`GET http://127.0.0.1:8000/api/v1/health` returns HTTP 200 and
`{"status":"ok"}`. This is a liveness response, not a database or AI readiness
check. FastAPI's development API docs are at `/docs`.

No environment variables or secrets are required. No CORS middleware is enabled;
future desktop integration must explicitly decide its permitted origins rather
than enabling wildcard CORS. This unauthenticated development scaffold is not a
production deployment configuration and must not be exposed to a network.

## Checks

```sh
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
```

The health test uses httpx's ASGI transport in process; it does not start a server
or exercise Electron, platform networking, or desktop/backend integration.
`uv.lock` records runtime and development dependencies. Keep it committed and
use locked sync/run commands for reproducibility; do not use pip.

## Responsibility boundaries

- `app/main.py`: ASGI application composition and router registration.
- `app/api/v1/`: versioned HTTP routes; keep transport concerns here.
- `tests/`: observable API behavior through httpx's ASGI transport.

The following boundaries are reserved, documented here instead of creating empty
modules. Create them only when real functionality needs them:

| Future path | Responsibility |
| --- | --- |
| `app/core/` | Validated settings and cross-cutting application policy |
| `app/db/` | Database connections, persistence, and transaction boundaries |
| `app/schemas/` | Request and response data contracts |
| `app/services/` | Application use cases independent of HTTP transport |
| `app/rag/` | Retrieval and indexing workflows |
| `app/llm/` | Model-provider adapters and model-call boundaries |

Future routes should call application services rather than implement persistence
or provider calls directly. Database selection, migrations, model providers,
secrets, authentication, CORS policy, and desktop-managed startup remain separate
work; none are implied or provisioned by this foundation.
