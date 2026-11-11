# Deski backend

FastAPI HTTP contracts with a deterministic health route and injectable Chat,
History, Document, Settings, and Token service boundaries. There is no database, AI/RAG
implementation, authentication, credential storage, token issuance, or desktop
process orchestration. Token means a provider credential, not an issued session
or authentication token.

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

## API contracts and teammate integration

All routes use `/api/v1`. Health remains exactly HTTP 200 `{"status":"ok"}`.
The approved team decision is to ship routers/contracts now without implementing
teammates' use cases: every unwired service fails explicitly with HTTP 503,
never a fabricated success. The ownership/503 comment is beside dependency
wiring in `app/api/v1/dependencies.py`.

| Operation | Input | Success with injected service (HTTP 200) |
| --- | --- | --- |
| `POST /chat` | `message`, optional `chat_id`, `document_ids` (default []) | `chat_id`, `message` |
| `POST /chat/stream` | Same as POST /chat | POST SSE: start, delta*, done or error |
| `GET /chats` | None | Chat summaries, newest updated first |
| `GET /chats/{chat_id}/messages` | Chat ID | Messages/documents, oldest created first |
| `DELETE /chats/{chat_id}` | Chat ID | **204**, no body (404 if missing) |
| `GET /tokens` | None | Metadata for openai and anthropic; never keys |
| `POST /documents` | `document_name`, text `content` | `document_id`, `document_name` |
| `GET /settings` | None | `provider`, `model` |
| `PATCH /settings` | `provider` and/or `model` | Complete `provider`, `model` |
| `PUT /tokens/{provider}` | Secret `api_key` | `provider`, `configured` only |

Providers are `openai` and `anthropic` (Claude). Nonblank string bounds are:
message 1–10,000 characters; IDs/model 1–128; document name 1–255; document
content 1–1,000,000; API key 1–4,096. Strings are preserved, not trimmed. Request
objects forbid unknown fields; only optional `chat_id` permits explicit null.
Settings PATCH rejects empty objects and explicit null; omitted fields stay
unchanged. Documents have no filesystem-path input.

Missing-service bodies are `{"detail":"Chat service unavailable"}`,
`{"detail":"History service unavailable"}`,
`{"detail":"Document service unavailable"}`,
`{"detail":"Settings service unavailable"}`, and
`{"detail":"Token service unavailable"}` (HTTP 503). Dependencies can fail
before validation. With a service present, invalid input returns 422 before any
service call. Ordinary validation returns `{"detail":"Invalid request"}` without
input/context. All JSON errors use string `detail`: ordinary HTTP exceptions keep
status, headers and intentional string detail; non-string detail becomes
`{"detail":"Request failed"}`. Unexpected errors (including invalid service
responses) return HTTP 500 `{"detail":"Internal server error"}` without details
or logging by the handler. Services must keep intentional HTTP messages/headers
safe. OpenAPI and generated TypeScript describe the string 422/500 bodies.
Token-only validation returns `{"detail":"Invalid token request"}` without
echoing input; token service HTTP errors discard headers/detail (503 as above; other statuses
use `{"detail":"Token request failed"}`). Unexpected token errors return 500
`{"detail":"Token service failed"}` without logging caught exceptions.
Token provider trailing-slash paths never redirect or emit `Location`: PUT returns
400 `{"detail":"Invalid token path"}`; other methods return 405 (HEAD has no body).
Collection slash-only paths (`/tokens/`, `/tokens//`, etc.) instead preserve 404
`{"detail":"Not Found"}` for GET/PUT/POST/DELETE/HEAD/OPTIONS/PATCH/TRACE/CONNECT
(HEAD body empty),
without redirects or `Location` even with credential-bearing query strings.
These rejection guards never invoke dependencies/services; provider routes and
non-token routing are unchanged.

History dates are timezone-aware and normalized to UTC ISO8601 by the adapter,
which also guarantees ordering. Empty titles are allowed (max 80 characters).
Services own title generation/persistence, unknown-document 422 validation before
mutation, missing-chat 404, and deletion of messages/associations without removing
documents/files. None of these storage effects is implemented.

POST `/chat/stream` uses a separate `ChatStreamService.open` async-generator seam;
missing wiring returns the same Chat 503. Acquisition and the first start event
are preflighted before HTTP 200. Success is `text/event-stream`, with blank-line
framed `event:` and JSON `data:` lines. Events carry start `{chat_id}`, delta
`{text}`, done `{message_id}`, or error `{detail}`. After start all failures use
fixed `Chat stream failed` detail and close, without a subsequent done. Done is
also terminal; disconnect/cancellation closes the upstream generator and
propagates cancellation. No provider/network/persistence implementation is added.
See the complete contracts for producer obligations, bounds, and framing types.

Keys use `SecretStr`, are not echoed, stored, verified, or sent to providers;
there is no expiry assumption. OpenAPI contains no credential examples. Do not
send secrets to other routes: validation is redacted, but their successful
responses or intentional service HTTP errors are not credential boundaries.
This is still an unauthenticated development-only API.

[Complete contracts and extension instructions](../../docs/api-contracts.md)
describe bounds, errors, and service Protocols. Implement those async interfaces
in teammate-owned modules, then replace the corresponding `get_*_service`
wiring. Keep defaults at 503 until real services exist. Tests override these
getters with fakes; no success fallback is enabled in the application.

## Checks

```sh
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
```

The health and contract tests use httpx's ASGI transport in process; they do not
start a server or exercise Electron, platform networking, or desktop/backend
integration. Contract tests verify delegation through fake services, rejected
inputs without service mutation, token redaction, and OpenAPI.
`uv.lock` records runtime and development dependencies. Keep it committed and
use locked sync/run commands for reproducibility; do not use pip.

## Generated types and wheel packaging

From the repository root, `npm run gen-types` derives TypeScript declarations
from public `app.openapi()` without a server. `npm run gen-types:check` checks
freshness without writing. `npm run build-backend` produces a Python wheel, not
a standalone executable; `npm run build-backend -- --verify` inspects its contents
and verifies installed health/503 behavior outside the source checkout. Packaging
uses explicit app discovery and pinned Hatchling; uv now installs the app package
instead of treating this directory as a non-package project.

`npm run dev` is a developer-only coordinator for this loopback backend and the
existing desktop build/launch, not backend/Electron integration. The desktop-only
command remains `npm run dev:desktop`. Read [tooling details](../../docs/development-tooling.md)
for exact commands, lifecycle guarantees, packaging limits, and unverified platforms.

## Responsibility boundaries

- `app/main.py`: ASGI application composition and router registration.
- `app/api/v1/`: central router, HTTP contracts, Protocols and dependency getters;
  keep transport concerns here. These schemas are provisional boundary models.
- `tests/`: observable API behavior through httpx's ASGI transport.

The following boundaries are reserved, documented here instead of creating empty
modules. Create them only when real functionality needs them:

| Future path | Responsibility |
| --- | --- |
| `app/core/` | Validated settings and cross-cutting application policy |
| `app/db/` | Database connections, persistence, and transaction boundaries |
| `app/schemas/` | Shared domain schemas if later needed beyond the API boundary |
| `app/services/` | Application use cases independent of HTTP transport |
| `app/rag/` | Retrieval and indexing workflows |
| `app/llm/` | Model-provider adapters and model-call boundaries |

Future routes should call application services rather than implement persistence
or provider calls directly. Database selection, migrations, model providers,
secrets, authentication, CORS policy, and desktop-managed startup remain separate
work; none are implied or provisioned by this foundation.
