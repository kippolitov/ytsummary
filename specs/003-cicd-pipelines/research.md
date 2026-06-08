# Research: Automated CI/CD Pipelines

**Branch**: `003-cicd-pipelines` | **Date**: 2026-06-08

## 1. CI/CD Platform

**Decision**: GitHub Actions  
**Rationale**: The repository is already on GitHub (confirmed from project context). GitHub Actions is native, requires no additional service accounts for basic use, and supports secrets management, artifact upload, and Azure deployment out of the box.  
**Alternatives considered**: CircleCI, Azure DevOps Pipelines — both add external platform dependencies for a repo that is already on GitHub.

---

## 2. Monorepo Workflow Strategy

**Decision**: Two separate jobs within a single workflow file per trigger (CI + CD), with each job scoped to its own subdirectory (`extension/` and `functions/`).  
**Rationale**: The extension and Functions are independent workspaces with separate `package.json` files and different toolchains. Running them as parallel jobs in the same workflow file gives fast feedback (both results visible in one CI run) without coupling them. A single workflow per trigger avoids workflow sprawl.  
**Alternatives considered**:
- Two entirely separate workflow files (one per component) — increases maintenance surface.
- A single sequential job — slower; a Functions lint failure would block extension tests unnecessarily.

---

## 3. Extension Packaging Format

**Decision**: Use the `wxt zip` command (already in the extension's `package.json` `scripts`) to produce the extension bundle, then apply password protection using `zip` with AES-256 encryption at the shell level.  
**Rationale**: `wxt zip` already produces a correctly structured extension archive. Wrapping it in a password-protected outer .zip (via the `zip -e` / `zip --password` flag or `7z a -p`) adds the security layer without modifying the WXT build process.  
**Alternatives considered**:
- Custom packaging script — unnecessary complexity; `wxt zip` is already correct.
- PGP encryption — team workflow requires a password, not a key pair.

---

## 4. Password Generation and Storage Strategy

**Decision**: Generate an 8-character alphanumeric password using `openssl rand -base64 6 | tr -dc 'A-Za-z0-9' | head -c 8` in the GitHub Actions job, then immediately write it back to GitHub Secrets via the GitHub CLI (`gh secret set`) so it overwrites the previous value and is retrievable by repo admins.  
**Rationale**: Generating per-run keeps the password fresh and tied to the latest artifact. Writing it back to Secrets via `gh secret set` is the only durable, non-logged storage mechanism available in GitHub Actions. The password is never echoed to logs (use `echo "::add-mask::$PASSWORD"` to mask it).  
**Alternatives considered**:
- Fixed password stored as a secret (never rotated) — lower security hygiene.
- Storing password in artifact description or annotation — visible in UI, not secret.
- Azure Key Vault — adds infrastructure dependency; GitHub Secrets is sufficient.

---

## 5. Azure Functions Deployment Method

**Decision**: Use the Azure Functions GitHub Actions action (`azure/functions-action`) with a publish profile stored as a GitHub Secret (`AZURE_FUNCTIONAPP_PUBLISH_PROFILE`).  
**Rationale**: The publish profile approach is well-documented, scoped to a single Function App (least-privilege), and does not require creating a service principal or managing RBAC. It works with the existing `npm run build:production` script in `functions/package.json` which calls `func pack`.  
**Alternatives considered**:
- Service principal / federated identity (OIDC) — more powerful and reusable but adds AAD configuration overhead for this single-app scenario.
- Azure CLI in a generic step — more verbose, same security posture as publish profile.

---

## 6. Secrets Required

| Secret Name | Purpose | Who Sets It |
|---|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Deploy Functions to Azure | Repo admin (from Azure Portal) |
| `AZURE_FUNCTIONAPP_NAME` | Target Function App name | Repo admin |
| `EXTENSION_ZIP_PASSWORD` | Password for extension .zip (overwritten each main merge) | Set by CD pipeline automatically |
| `OPENAI_API_KEY` | Functions runtime API key (if needed for integration tests) | Repo admin |

---

## 7. Trigger Strategy

| Trigger | Jobs |
|---|---|
| Push to any branch (including feature branches) | Lint + Test + Build for both extension and functions |
| Push to `main` (merge) | Same as above, then package extension + deploy functions |

**Decision**: Use `on: push` with `branches` filter. Main merge detection is `push: branches: [main]` (or the repo's default branch name as confirmed during setup). Feature branch CI is `push: branches-ignore: [main]` — this avoids double-running on main.

---

## 8. Artifact Retention

**Decision**: Extension .zip artifact is retained for 30 days (GitHub Actions default) per CI run. Only the latest run's artifact is practically "current"; older ones auto-expire.  
**Rationale**: 30 days is sufficient for release candidate review. No custom retention configuration needed.

---

## 9. Constitution Alignment

All quality gates from the constitution are addressed:
- **QG-1 (Lint)**: `npm run lint` with `--max-warnings 0` already enforced in both `package.json` scripts — CI will fail on any warning.
- **QG-2 (Tests)**: `npm test` (Vitest) with coverage is run; CI fails if tests fail. Coverage reporting is included but coverage gate enforcement (80%) is noted as a future enhancement (see Assumptions in spec).
- **QG-4 (Performance)**: Not directly testable in this pipeline; out of scope for CI/CD feature.
