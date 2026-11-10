# Desktop app

An Electron chat client for the Deski backend, inspired by Ollama's desktop UI:
a chat history sidebar, a composer that accepts files, streamed replies and a
settings page for choosing the AI provider (Anthropic or OpenAI), model, API key
and theme. The renderer is framework-free TypeScript.

## Requirements and commands

Use Node.js 22 (>=22.12.0) and npm 10. From the repository root:

```sh
npm ci
npm run dev          # backend on 127.0.0.1:8000 + desktop app
npm run dev:desktop  # desktop only, talks to http://127.0.0.1:8000
npm run dev:fake     # desktop only, answered by the built-in fake API
npm run typecheck
npm test
npm run build
```

Set `DESKI_BACKEND_URL` to use another loopback backend address. The pinned
Electron package downloads its native binary on first launch. There is no hot
reload: close the app and run the command again after changes. `npm run build`
emits code and assets into `apps/desktop/dist/`; it does not produce an installer.

### Fake API (`dev:fake`)

The backend services still return 503 until teammates wire them. To build and
demonstrate the UI meanwhile, `npm run dev:fake` starts the app with
`--fake-api`, which swaps the HTTP client for `src/main/fake-backend.ts`. It
implements the same `BackendClient` interface, streams a canned Markdown reply
word by word, mentions uploaded documents and keeps settings in memory. The app
shows a **Demo** badge in this mode so its answers are never mistaken for real
ones. Without the flag the fake API is never used.

## Structure

```
src/
├── shared/deski-api.d.ts   IPC contract types shared by every process
├── main/                   privileged Electron process
│   ├── main.ts             window lifecycle and security restrictions
│   ├── ipc.ts              IPC handlers (trusted sender check + validation)
│   ├── ipc-validation.ts   payload validation mirroring the backend bounds
│   ├── backend-client.ts   typed HTTP client for /api/v1
│   └── fake-backend.ts     opt-in development stand-in with streaming
├── preload/index.cts       exposes window.deski; CommonJS for the sandbox
└── renderer/               UI, no Node.js access
    ├── app.ts              application state and view switching
    ├── features/           pure logic: chat history, Markdown, documents, settings
    ├── components/         atoms → molecules → organisms (Atomic Design)
    ├── pages/              chat and settings pages
    ├── i18n/tr.ts          every user-facing string
    └── styles/             tokens.css (design tokens), base, components, layout
```

Data flows one way: the renderer calls `window.deski`, the preload forwards the
call over IPC, the main process validates the payload and calls the backend.
Every call resolves to an `ApiResult` (`ok` or a typed error) instead of throwing,
because exceptions lose their details across IPC. Streamed replies arrive as
`chat:chunk` events tagged with a stream id.

The backend has no chat history endpoint yet, so the history is stored in
`localStorage` behind the small `ChatStore` interface; replacing it with an
API-backed store does not affect the UI. Files are read as text in the renderer
and sent to `POST /documents` as content (at most 1,000,000 characters), because
the backend contract never accepts filesystem paths. The real backend has no
streaming endpoint, so its reply is delivered as a single chunk.

## Design system

`styles/tokens.css` is the only place with raw colors, sizes and timings; light
and dark themes are two sets of the same tokens. The theme follows the system
or the user's choice in Settings. The brand mark is `assets/logo.svg`;
`assets/icon.png` (512 px) is exported from it for the window and dock icon.
Icons are inline SVG paths adapted from Lucide (ISC License).

## Security

The window keeps context isolation and sandboxing on and Node.js integration and
webviews off. Navigation, redirects, new windows and permission requests are
denied. The CSP allows only local scripts, styles and images and denies network
connections, so all HTTP traffic goes through the main process. IPC handlers
accept calls only from the bundled `file://` page and validate every payload.
Assistant Markdown is HTML-escaped before markup is added; all other text is set
with `textContent`. API keys are sent to the backend once and never stored by the UI.

## Tests and verification limits

`npm test` runs Node.js built-in tests for the pure modules: backend client, IPC
validation, fake API, chat history and storage, Markdown, attachments, message
sending and settings. DOM components are not unit-tested; they were checked by
launching the app on macOS against the fake API in light and dark themes.
Windows and Linux were not verified, and no installer or signing is configured.
