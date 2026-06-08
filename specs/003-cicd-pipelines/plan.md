# Implementation Plan: Automated CI/CD Pipelines

**Branch**: `003-cicd-pipelines` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-cicd-pipelines/spec.md`

## Summary

Create two GitHub Actions workflow files — a CI workflow (triggered on feature branch pushes) and a CD workflow (triggered on main branch merges) — that run lint, tests, and builds for both the `extension/` (WXT/React/Vitest) and `functions/` (Azure Functions/TypeScript/Vitest) workspaces in parallel, and on main additionally package the extension as a password-protected .zip (storing the password back to GitHub Secrets) and deploy the Functions app to Azure using publish profile credentials held in GitHub Secrets.

## Technical Context

**Language/Version**: TypeScript (extension: `^5.5.2`, functions: `^5.5.2`)

**Primary Dependencies**:
- Extension: WXT `^0.19.0`, Vitest `^1.6.0`, ESLint `^8.57.0`, Playwright `^1.44.0`
- Functions: Azure Functions `^4.3.0`, Vitest `^1.6.0`, ESLint `^8.57.0`
- CI/CD: GitHub Actions, `azure/functions-action`, `actions/upload-artifact`, `actions/setup-node`

**Storage**: No persistent store; GitHub Secrets for credentials, GitHub Actions artifacts for extension .zip

**Testing**: Vitest (`npm test`) for unit tests in both workspaces; ESLint (`npm run lint`) for static analysis

**Target Platform**: GitHub Actions runners (ubuntu-latest), Azure Functions (existing app)

**Project Type**: Browser extension + Azure Functions backend (monorepo with two independent npm workspaces)

**Performance Goals**: CI wall-clock time ≤ 5 minutes for feature branch runs (per SC-001)

**Constraints**: 
- Zero secrets in logs or source code (FR-013)
- Password must be 8-char alphanumeric (FR-009)
- Password must be masked before any echo (`::add-mask::`)

**Scale/Scope**: Two workflow files; four jobs total in CD pipeline; ~6 steps per job

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|---|---|---|
| **QG-1 Code Quality**: linter passes with zero warnings | ✅ Addressed | CI pipeline enforces `npm run lint` with `--max-warnings 0` already configured in both `package.json` files; any warning fails the job |
| **QG-2 Test Coverage**: CI reports ≥ 80% unit test coverage on changed modules | ⚠️ Partially addressed | Pipeline runs `npm test` (Vitest); coverage collection is available via `npm run coverage` but the 80% gate enforcement is not automated in this feature — noted as a follow-on task |
| **QG-3 UX Review**: loading indicators and error states consistent | N/A | This feature has no user-facing UI; the "UX" is the CI log output, which is clear and actionable per FR-014 |
| **QG-4 Performance Benchmark**: p95 latency ≤ 30 s for 10-min video | N/A | CI/CD infrastructure does not affect summarization latency |

**QG-2 exception**: Coverage gate enforcement (rejecting PRs below 80%) is explicitly deferred. This feature's scope is lint/test/build pipeline setup; enforcing coverage thresholds is a separate, trackable follow-on. No constitution violation — the spec's Assumptions section acknowledges this boundary.

## Project Structure

### Documentation (this feature)

```text
specs/003-cicd-pipelines/
├── plan.md              # This file
├── research.md          # Phase 0 output (decisions on platform, secrets, tooling)
├── data-model.md        # Phase 1 output (workflow entities, secrets schema)
├── quickstart.md        # Phase 1 output (validation scenarios)
├── contracts/
│   └── workflow-contracts.md   # Phase 1 output (interface contracts)
├── checklists/
│   └── requirements.md         # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml           # Feature branch CI: lint + test + build (extension + functions)
    └── cd.yml           # Main branch CD: CI + package extension + deploy functions

extension/               # Existing — no structural changes
└── package.json         # Existing scripts: lint, test, build, zip

functions/               # Existing — no structural changes
└── package.json         # Existing scripts: lint, test, build:production
```

**Structure Decision**: The two workflow files live in `.github/workflows/` (standard GitHub Actions path). All source code in `extension/` and `functions/` is used as-is; no new source files are introduced by this feature.

## Implementation Phases

### Phase A: CI Workflow (Feature Branch)

Create `.github/workflows/ci.yml`:
- Trigger: `push` to branches matching `**` (all branches), excluding `main` (use `branches-ignore: [main]`)
- Two parallel jobs: `extension-ci` and `functions-ci`
- Each job:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node version matching project (18.x or 20.x — check `.nvmrc` or use `node-version-file`)
  3. `npm ci` in the respective workspace directory
  4. `npm run lint`
  5. `npm test`
  6. `npm run build`

### Phase B: CD Workflow (Main Branch)

Create `.github/workflows/cd.yml`:
- Trigger: `push` to `main` only (`branches: [main]`)
- Four jobs:
  1. `extension-ci` — same steps as Phase A's extension job
  2. `functions-ci` — same steps as Phase A's functions job
  3. `package-extension` — depends on `extension-ci`:
     - `npm ci` + `npm run build` in `extension/`
     - `npm run zip` (produces `extension/.output/*.zip` via WXT)
     - Generate password: `openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8`
     - Mask password: `echo "::add-mask::$PASSWORD"`
     - Create password-protected archive: `zip --password "$PASSWORD" extension-$GITHUB_SHA.zip <wxt-zip-output>`
     - Update GitHub Secret: `gh secret set EXTENSION_ZIP_PASSWORD -b "$PASSWORD"` (using `GITHUB_TOKEN` with `secrets: write` permission)
     - Upload artifact: `actions/upload-artifact@v4` with name `extension-${{ github.sha }}`
  4. `deploy-functions` — depends on `functions-ci`:
     - `npm ci` + `npm run build:production` in `functions/`
     - `azure/functions-action@v1` with `app-name: ${{ secrets.AZURE_FUNCTIONAPP_NAME }}` and `publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}`

### Phase C: Permissions and Workflow Settings

- Grant `GITHUB_TOKEN` the `secrets: write` permission in `cd.yml` (needed for `gh secret set`)
- Set `permissions: contents: read` for CI workflow (least privilege)
- Add `concurrency` group per branch to cancel stale runs (optional but recommended)

### Phase D: Validation

Follow all six scenarios in [quickstart.md](quickstart.md) to confirm end-to-end correctness before closing the feature branch.
