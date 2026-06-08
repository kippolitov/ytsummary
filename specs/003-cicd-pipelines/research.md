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

**Decision**: Use `npm run zip` (`wxt zip`) to produce the extension bundle, then wrap it in a password-protected `.7z` archive using `7za a -p"$PASSWORD" -mhe=on` (AES-256 with header encryption).  
**Rationale**: `wxt zip` already produces a correctly structured extension archive. Using `7za` with `-mhe=on` encrypts both file contents and the archive's file listing, preventing even metadata leakage. The `zip --password` flag does not encrypt the central directory, so `.7z` is the stronger choice.  
**Alternatives considered**:
- `zip --password` — weaker (central directory unencrypted); replaced by `7za`.
- Custom packaging script — unnecessary complexity; `wxt zip` + `7za` is sufficient.
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

**Decision**: Use `azure/login@v2` with OIDC federated identity (workload identity federation), then deploy via `azure/functions-action@v1`.  
**Rationale**: OIDC eliminates long-lived credentials — no publish profile XML needs to be stored as a secret. The three secrets required (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) are non-sensitive identifiers; the actual authentication token is short-lived and issued by GitHub Actions at runtime. The `id-token: write` permission on the job enables this flow. The job runs `npm run build` (TypeScript compilation) before deploying the `functions/` directory.  
**Alternatives considered**:
- Publish profile — stores a long-lived credential XML as a secret; replaced by OIDC.
- Azure CLI in a generic step — more verbose; `azure/functions-action` handles the deployment packaging automatically.

---

## 6. Secrets Required

| Secret Name | Purpose | Who Sets It |
|---|---|---|
| `AZURE_CLIENT_ID` | OIDC login — Azure app registration client ID | Repo admin |
| `AZURE_TENANT_ID` | OIDC login — Azure tenant ID | Repo admin |
| `AZURE_SUBSCRIPTION_ID` | OIDC login — Azure subscription ID | Repo admin |
| `AZURE_FUNCTIONAPP_NAME` | Target Function App name | Repo admin |
| `GH_PAT` | Fine-grained PAT (secrets write) — used by `gh secret set` to store `EXTENSION_ZIP_PASSWORD` | Repo admin |
| `EXTENSION_ZIP_PASSWORD` | Password for extension `.7z` archive (overwritten each main merge) | Set by CD pipeline automatically |

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
