# Backend API contracts

These provisional contracts belong to the HTTP boundary, not to implemented use
cases. All paths below have prefix `/api/v1`. JSON is the request/response format.
Only Health works without an injected service; the other operations return 503,
not simulated success. No persistence, credential storage, document indexing,
provider calls, authentication, or credential verification is implemented.

## Operations

| Method and path | Request | Success (HTTP 200, injected service only) |
| --- | --- | --- |
| `GET /health` | None | `{"status":"ok"}` |
| `POST /chat` | Required `message: string`; optional `chat_id: string or null` (default null) | `chat_id: string`, `message: string` |
| `POST /documents` | Required `document_name: string`, `content: string` | `document_id: string`, `document_name: string` |
| `GET /settings` | None | `provider: Provider`, `model: string` |
| `PATCH /settings` | `provider: Provider` and/or `model: string` | Complete `provider`, `model` pair |
| `PUT /tokens/{provider}` | Required `api_key: secret string` | `provider: Provider`, `configured: boolean` only |

`Provider` is exactly `openai` or `anthropic` (the provider for Claude). `claude`
is not an identifier. IDs are opaque strings, not UUIDs. Chat has no history or
delete operation. Documents accept text, never a filesystem path parameter;
`document_name` is a label, not a path to open. No files are read by these routes.

## Input and output bounds

String lengths are inclusive character counts, not byte/upload limits:

| Field | Minimum | Maximum |
| --- | --- | --- |
| Chat `message` (request and response) | 1 | 10,000 |
| `chat_id`, `document_id` | 1 | 128 |
| `document_name` (request and response) | 1 | 255 |
| Document `content` | 1 | 1,000,000 |
| Settings `model` | 1 | 128 |
| Token `api_key` (request only) | 1 | 4,096 |

Every string above must contain a non-whitespace character. Values are not
trimmed or normalized. Non-string JSON values are rejected. Request objects
reject unknown fields. Explicit null is accepted only for optional `chat_id`.
PATCH must contain at least one known field; `{}` and null field values are
invalid. Omitted PATCH fields must remain unchanged; services use
`payload.model_dump(exclude_unset=True)` to distinguish them. OpenAPI describes
PATCH fields as optional but non-null, with `minProperties: 1` to reject empty
objects. Runtime validators enforce the same rules. Response objects expose
only declared fields.

## Errors and secret handling

Missing service dependencies raise HTTP 503 with these exact JSON bodies:

- Chat: `{"detail":"Chat service unavailable"}`
- Documents: `{"detail":"Document service unavailable"}`
- GET/PATCH Settings: `{"detail":"Settings service unavailable"}`
- Tokens: `{"detail":"Token service unavailable"}`

Dependencies may fail before body validation; an unavailable service can therefore
produce 503 even for an invalid request. With a service wired, invalid input is
422 and is rejected before calling the service. Ordinary validation (including
malformed JSON) now returns only `{"detail":"Invalid request"}`. Validation
inputs, locations and context are not echoed. All JSON error bodies have a string
`detail`; clients must no longer expect FastAPI's validation arrays.

Ordinary HTTP exceptions preserve status codes, headers and intentional string
detail (including the 503 messages above). Non-string detail becomes
`{"detail":"Request failed"}` rather than stringifying potentially sensitive data.
Unexpected exceptions, including invalid service responses, return HTTP 500
`{"detail":"Internal server error"}` without exception details or logging by this
handler. Services must keep intentional HTTP messages/headers safe for clients.
OpenAPI describes 422 and 500 with `ErrorResponse`; regenerate TypeScript with
`npm run gen-types`. Health remains exactly HTTP 200 `{"status":"ok"}`.

Token paths with one or more trailing slashes are rejected without redirects or
`Location` headers: PUT returns HTTP 400 `{"detail":"Invalid token path"}`; other methods
return HTTP 405 `{"detail":"Method Not Allowed"}` (HEAD has no response body).
This transport-only token suffix guard is excluded from OpenAPI and invokes no
service. Other suffixes remain invalid (PUT returns a fixed 404; other methods
return 405). Non-token slash-routing behavior is unchanged.

Token routes alone replace validation errors (including malformed JSON and
invalid provider paths) with HTTP 422 `{"detail":"Invalid token request"}`.
Token service HTTP exceptions keep their status but discard detail and headers:
503 uses the unavailable body above; other statuses use
`{"detail":"Token request failed"}`. Unexpected exceptions, including invalid
service responses, return HTTP 500 `{"detail":"Token service failed"}`. This
boundary does not log request bodies or caught exceptions. Its existing route
handler and path guard take precedence over the ordinary error policy; token
messages and header redaction are unchanged.

`api_key` uses Pydantic `SecretStr`; OpenAPI marks it write-only/password and
contains no credential examples. Plaintext is accessible to the future service
only via `get_secret_value()`. Success contains metadata only. A submitted key is
data for a future secure-storage service, not a credential validated against a
provider. No format/prefix, expiry, or provider-validity assumptions are made.
`configured` reports service metadata, not proof of provider access. Today keys
are neither stored nor forwarded. Future services must not log plaintext, include
it in response metadata, or add credential examples to OpenAPI. This development
API has no authentication; never expose it to a network or use real credentials
until secure storage and access policy are implemented separately.

## Extending the service seams

The team approved routers/contracts now while teammates own business logic,
persistence, and provider adapters. See the ownership/503 comment in
`apps/backend/app/api/v1/dependencies.py`; missing integrations must never become
success fallbacks. `main.py` includes the central `api/v1/router.py`; the existing
Health route stays independent of services.

Implement the corresponding asynchronous Protocol outside the HTTP layer:

- `ChatService.send(ChatRequest) -> ChatResponse`
- `DocumentService.create(DocumentRequest) -> DocumentResponse`
- `SettingsService.get() -> SettingsResponse`
- `SettingsService.update(SettingsPatch) -> SettingsResponse`
- `TokenService.configure(Provider, TokenRequest) -> TokenResponse`

Replace only the relevant `get_*_service` wiring when its real implementation is
ready. Until then leave its explicit 503. Keep provisional schemas close to the
routes; do not create database/service implementations just to populate folders.
Tests use `app.dependency_overrides[get_*_service]` with in-memory fakes and clear
overrides afterwards. Run locked pytest and Ruff from `apps/backend` (see its
README); verify delegation, no calls/mutation for invalid inputs, secret-safe
errors, OpenAPI, and the unchanged Health response. Commit/PR explanations of
this ownership decision are handled by the integration owner separately.
