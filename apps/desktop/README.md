# Desktop foundation

A local-only Electron shell with a static, framework-free TypeScript renderer.
No AI, RAG, database, IPC bridge, backend process, or OS-control features exist.

## Requirements and commands

Use Node.js 22 (>=22.12.0) and npm 10. The setup was checked with Node.js
22.23.3 and npm 10.9.9 on macOS. From the repository root:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`npm ci` installs the locked dependencies. The pinned Electron package acquires
its native binary lazily when first launched, so the first `npm run dev` may
require network access. `npm run dev` compiles once and opens the local built page;
there is no development server or hot reload. After edits, close the app and
run it again. `npm run build` emits application code and assets into
`apps/desktop/dist/`; it does not produce an installer.

The equivalent app-local commands, after installation from the root, are:

```sh
cd apps/desktop
npm run dev
npm run typecheck
npm test
npm run build
```

For compile/test-only environments, `npm ci --ignore-scripts` suppresses npm
lifecycle scripts but does not prevent Electron's later lazy binary download.
Do not run `npm run dev` when binary acquisition or app launch is unwanted.
Verification used a lifecycle-script-free installation without launching Electron;
window rendering, keyboard/visual accessibility, and native runtime security
were not exercised. Neither Windows nor Linux was verified. No installer,
signing, CI, or packaging configuration is included.

## Responsibilities

- `src/main/main.ts`: window lifecycle and restrictions; loads only built local HTML.
- `src/renderer/main.ts`: mounts the concrete page, with no Node.js types or APIs.
- `src/renderer/pages/scaffold-page.ts`: concrete populated page and safe title rendering.
- `src/renderer/index.html` and `styles.css`: semantic document and minimal responsive styles.
- `test/`: Node.js built-in tests for exact output and HTML escaping, without Electron.
- `scripts/copy-assets.mjs`: copies the two static assets after TypeScript compilation.

Atomic Design describes composition responsibilities, not five required folders.
Only the **page** tier is warranted now. Native HTML supplies basic atoms;
there are no reusable custom atoms, cohesive molecules, substantial organisms,
or repeated layouts needing templates yet. Introduce those tiers only when
real composition/reuse calls for them; low-level tiers must not import pages.
No speculative components or framework are included.

## Security and dependency choices

The window explicitly enables context isolation and sandboxing and disables
Node.js integration and webviews. There is no preload or privileged bridge.
New windows, renderer navigation/redirects, and permission requests are denied.
The CSP permits local scripts/styles only and denies network connections and
form submission. Keep all content local; do not add remote URLs or shell APIs.
The pure page renderer escapes its title before HTML insertion.

Dependencies are exact-pinned: Electron 45.2.3 (registry requires Node >=22.12),
TypeScript 5.9.3 (requires Node >=14.17), and host Node 22 types 22.20.5.
Versions and engine requirements were checked with `npm view` during setup;
the committed root `package-lock.json` pins transitive resolution. Separate
strict compiler configurations keep Node types out of the renderer. The test
runner uses Node 22's built-in TypeScript stripping, with no extra framework.
