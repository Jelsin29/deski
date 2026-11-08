# Contributing to Deski

Coordinate a small, reviewable task before writing code. This is a team project:
contributions should reflect real work, shared understanding, and balanced effort,
not artificial commit counts or invented authorship.

## Task to pull request

1. Check existing issues and open PRs; agree on scope and ownership with teammates
   in an issue or task discussion. Link that context in the PR. No special
   approval label or issue-approval workflow is required.
2. Start from updated `main` with a clean working tree:

   ```sh
   git switch main
   git pull --ff-only origin main
   git switch -c docs/describe-your-task
   ```

   Choose a descriptive branch name for your task (for example, `feat/...`,
   `fix/...`, or `docs/...`). Do not overwrite unrelated local work.
3. Keep code, applicable tests, and documentation together. Explain current
   behavior separately from future plans; avoid empty speculative abstractions.
4. Run relevant checks below before opening a PR. State exact results and any
   checks not run; do not describe untested runtime behavior as verified.
5. Use Conventional Commits, such as `docs: explain local setup` or
   `feat: add a health endpoint`. Keep each commit a coherent, honest work unit.
6. Open a focused PR to `main` using the template. Ask another teammate to review
   intent, behavior, tests, and documentation; address their feedback.

Do not make direct changes on `main`. Agents must not merge PRs or make direct
`main` changes; human teammates own review and merge decisions. The initial three
foundation PRs all independently target `main`; none depends on another PR's
branch. App documentation links resolve only after the corresponding app PR merges.

## Checks before a PR

For desktop changes, from the repository root after dependency installation:

```sh
npm run typecheck
npm test
npm run build
```

For backend changes, from `apps/backend` after `uv sync --locked`:

```sh
uv run --locked pytest
uv run --locked ruff check .
uv run --locked ruff format --check .
```

Use uv, not pip, for backend dependencies. Review dependency and lockfile changes
explicitly. See the [root setup guide](README.md) and app READMEs linked there for
installation and runtime limits. For documentation-only changes, verify links
against the intended tree, commands against actual scripts/configuration, and
current-versus-planned claims. Note cross-PR links rather than hiding them.

## Shared responsibility

- Add behavior-focused tests for new behavior and regressions where runnable.
- Keep Atomic Design focused on UI composition, not backend organization; add
  tiers only when useful. Follow the [architecture boundaries](docs/architecture.md).
- Never commit secrets, credentials, personal data, or private source material.
  Review generated output and staged diffs before committing. If something leaks,
  stop sharing it and coordinate remediation with the team.
- Record meaningful AI assistance and its limitations in the
  [AI usage log](docs/ai-usage.md). Humans must inspect generated work and own it.
- Share implementation, testing, review, and documentation work fairly. Report
  actual contributions; do not fabricate history to satisfy course expectations.
