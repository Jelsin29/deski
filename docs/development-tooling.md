# Shared development tooling

Run commands from the repository root using Node 22, npm 10, uv, and an already
installed Python 3.12. Tooling sets `UV_PYTHON_DOWNLOADS=never`; it does not install
an SDK. Use `npm ci` and `cd apps/backend && uv sync --locked` to set up dependencies.
Tooling caches/fixtures stay in ignored `scripts/.cache` and `.test-output`.
No credentials, environment examples, provider calls, or live backend are needed.

## Commands

| Command | Observable result |
| --- | --- |
| `npm run dev` | Start loopback uvicorn on 127.0.0.1:8000 and existing desktop dev build/launch |
| `npm run dev:desktop` | Original desktop-only build then Electron launch |
| `npm run gen-types` | Export public OpenAPI locally, generate `packages/api-types/index.d.ts` |
| `npm run gen-types:check` | Regenerate in memory, fail if declarations differ; never overwrite |
| `npm run typecheck:api` | Compile declarations and type-level contract assertions |
| `npm run build-backend` | Build `apps/backend/dist/deski_backend-0.1.0-py3-none-any.whl` |
| `npm run build-backend -- --verify` | Also inspect wheel and exercise installed health/503 outside source |
| `npm run test:tooling` | Generation/staleness, process fixtures, preserved commands, installed wheel proof |

Root `typecheck`, `test`, and `build` still dispatch exactly the original desktop
commands. They do not implicitly build the wheel or regenerate types. No real
Electron launch occurs in tooling tests. Electron's existing lazy download on
real launch remains unchanged.

## Development process ownership

This coordinator is **not backend/Electron integration**. Neither app discovers,
connects to, or owns the other at runtime. No readiness guarantee is added. Use
backend-only commands in its README or `dev:desktop` when only one app is needed.
Do not start a second backend on the same port.

Commands use argument arrays and `shell:false`; the desktop is invoked via npm's
JavaScript entry point rather than `npm.cmd`. Paths are resolved from script URLs,
not shell string concatenation. Spaces in paths are supported. On POSIX each child
owns a process group; shutdown signals the entire group, then force-kills it after
500 ms, even if its wrapper already exited. On Windows each command has a small
Node/IPC wrapper that remains alive after command exit, so its tree root stays
addressable; `taskkill /PID … /T /F` performs tree termination. The wrapper ignores
console interrupts until the coordinator terminates the tree, and attempts its own
tree cleanup if coordinator IPC disconnects. Do not terminate the coordinator forcibly: neither
SIGKILL nor OS/session crashes allow JavaScript cleanup.

A failed spawn prints `Unable to start <name>: …` and exits 1; a child exit stops
its sibling and propagates its code (including 0). Ctrl-C exits 130; SIGTERM exits
143. Unexpected signal exits use 128 plus the signal number. These are developer
conveniences, not a production process supervisor or installer.

Fixture tests use real small Node subprocesses (including a grandchild), assert
exit codes, and probe PIDs after cleanup. macOS runtime is verified. Real Windows
and Linux runtimes are **not verified**; in particular Windows console delivery
and taskkill tree behavior require platform testing. No real Electron or provider
was launched. Windows wrapper/IPC ownership still needs real platform proof;
this is not a Windows Job Object or a crash-proof production supervisor.

## Single-source API types

`app.openapi()` is the only schema authority. `scripts/export-openapi.py` imports
the local public app with uv and emits sorted JSON. There is no checked-in JSON
copy to synchronize. `openapi-typescript` is pinned exactly to 7.10.1 in the npm
lockfile and generates declarations deterministically. Never edit declarations by
hand. After changing backend contracts, run generation, freshness and compile checks.
For fixture output, `node scripts/gen-types.mjs [--check] [--output FILE]` uses
the same public schema. Stale/missing output exits 1 with
`API types are stale. Run npm run gen-types.` and remains untouched.

Settings PATCH properties are optional but non-null in the public schema and
emitted TS. Type-level assertions catch accidental nullable/required regressions
and missing paths. TS structural types do not enforce every JSON Schema constraint
(e.g. minProperties=1, string bounds); runtime validation remains authoritative.
These types contain no HTTP client, runtime secrets, credential examples, or service
implementation. Team-owned missing services deliberately return **503**, never
fake live success. Health alone remains 200 `{"status":"ok"}`.

## Wheel, not standalone backend

The build uses uv's isolated PEP 517 build with exact `hatchling==1.27.0`, a pure
Python backend compatible with Python 3.12. Explicit `packages = ["app"]` handles
the existing non-src module layout and distribution-name mismatch. This version
was selected and validated by an actual uv wheel build plus installed import/health
proof on Python 3.12.16 (uv 0.13.6); no build-backend upgrade range is implicit.
`uv build` does not accept `--locked`: the build backend is pinned in pyproject;
`uv.lock` locks application/dev dependencies, not isolated build transitive tools.
Build requirements may need network/cache access. No pip commands are used.

Only app modules and wheel metadata are included. The optional verification checks
all source app modules are present, rejects unrelated archive roots/caches, then
uses `uv run --isolated --no-project --with <wheel> --with httpx==0.28.1 python -I`
in a fresh directory. It asserts the import is from site-packages, not the checkout,
and checks exact health 200 and missing Settings service 503 through ASGI transport.
It starts no server. Verification dependencies are separate from the production
wheel; installing the wheel does not include tests or httpx. Isolated verification
resolves the wheel's runtime dependency ranges; normal development uses uv.lock.

A wheel still requires Python and dependencies. It is not an executable, Electron
bundle, installer, signing/release pipeline, or CI integration. Dist artifacts,
cache directories, secrets, docs snapshots and original downloads must not be
committed or bundled. Change the expected wheel filename in tooling when bumping
the backend project version.
