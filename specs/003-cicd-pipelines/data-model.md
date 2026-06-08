# Data Model: Automated CI/CD Pipelines

**Branch**: `003-cicd-pipelines` | **Date**: 2026-06-08

## Overview

The CI/CD system does not introduce a persistent data store. Its "data" consists of:
1. **Workflow definition files** — declarative YAML configuration consumed by GitHub Actions.
2. **GitHub Secrets** — encrypted key-value pairs managed by GitHub; written by the pipeline and read by job steps.
3. **Workflow artifacts** — binary files (the packaged extension .zip) attached to a workflow run.

---

## Entities

### 1. CI Workflow (`ci.yml`)

Triggered by pushes to non-main branches.

| Attribute | Value |
|---|---|
| File path | `.github/workflows/ci.yml` |
| Trigger | `push` to any branch except `main` |
| Jobs | `extension-ci`, `functions-ci` (parallel) |
| Failure behaviour | Any failing job marks the workflow run as failed |

**Job: `extension-ci`**

| Step | Command | Fail condition |
|---|---|---|
| Install dependencies | `npm ci` in `extension/` | Non-zero exit |
| Lint | `npm run lint` | Any warning or error |
| Unit tests | `npm test` | Any test failure |
| Build | `npm run build` | Non-zero exit |

**Job: `functions-ci`**

| Step | Command | Fail condition |
|---|---|---|
| Install dependencies | `npm ci` in `functions/` | Non-zero exit |
| Lint | `npm run lint` | Any warning or error |
| Unit tests | `npm test` | Any test failure |
| Build | `npm run build` | Non-zero exit |

---

### 2. CD Workflow (`cd.yml`)

Triggered by pushes to `main` (i.e., after a PR merge).

| Attribute | Value |
|---|---|
| File path | `.github/workflows/cd.yml` |
| Trigger | `push` to `main` |
| Jobs | `extension-ci`, `functions-ci` (parallel), then `package-extension`, `deploy-functions` (parallel, depend on CI jobs) |
| Failure behaviour | CI job failure prevents downstream jobs from running |
| Concurrency | `cd-main` group; `cancel-in-progress: false` (deployments are never cancelled mid-run) |
| `deploy-functions` permissions | `contents: read`, `id-token: write` (required for OIDC federated login to Azure) |

**Job: `package-extension`** (depends on `extension-ci`)

| Step | Action | Secret access |
|---|---|---|
| Install dependencies | `npm ci` in `extension/` | — |
| Build extension | `npm run build` | — |
| Zip extension | `npm run zip` in `extension/` (WXT) | — |
| Generate password | `openssl rand` piped through `tr`; mask via `::add-mask::` | — |
| Create password-protected archive | `7za a -p"$PASSWORD" -mhe=on` (AES-256, header encryption) | — |
| Store password | `gh secret set EXTENSION_ZIP_PASSWORD` via `GH_TOKEN: ${{ secrets.GH_PAT }}` | `GH_PAT` (fine-grained PAT with secrets write) |
| Upload artifact | `actions/upload-artifact@v4` | — |

**Job: `deploy-functions`** (depends on `functions-ci`)

| Step | Action | Secret access |
|---|---|---|
| Install dependencies | `npm ci` in `functions/` | — |
| Build TypeScript | `npm run build` | — |
| Login to Azure | `azure/login@v2` (OIDC federated identity) | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` |
| Deploy to Azure | `azure/functions-action@v1` | `AZURE_FUNCTIONAPP_NAME` |

---

### 3. GitHub Secrets

| Name | Type | Set By | Used By |
|---|---|---|---|
| `AZURE_CLIENT_ID` | Azure app registration client ID | Repo admin (one-time setup) | `deploy-functions` job (OIDC login) |
| `AZURE_TENANT_ID` | Azure tenant ID | Repo admin (one-time setup) | `deploy-functions` job (OIDC login) |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Repo admin (one-time setup) | `deploy-functions` job (OIDC login) |
| `AZURE_FUNCTIONAPP_NAME` | String (app name) | Repo admin (one-time setup) | `deploy-functions` job |
| `GH_PAT` | Fine-grained PAT with secrets write scope | Repo admin (one-time setup) | `package-extension` job (to update `EXTENSION_ZIP_PASSWORD`) |
| `EXTENSION_ZIP_PASSWORD` | 8-char alphanumeric string | `package-extension` job (auto-overwritten) | Team members (manual retrieval) |

---

### 4. Extension Artifact

| Attribute | Value |
|---|---|
| Artifact name | `extension-<GITHUB_SHA>` (GitHub Actions artifact) |
| Archive file | `extension-<GITHUB_SHA>.7z` (AES-256 with header encryption) |
| Contents | Password-protected `.7z` wrapping the WXT-produced `.zip` |
| Retention | 30 days (GitHub Actions default) |
| Access | Any user with read access to the repository |

---

## Relationships

```
Push to feature branch
  └─► ci.yml
        ├─► extension-ci job
        └─► functions-ci job

Push to main (PR merge)
  └─► cd.yml
        ├─► extension-ci job ──┐
        │                      ├─► package-extension job ──► EXTENSION_ZIP_PASSWORD (secret, overwritten)
        │                      │                          └─► extension artifact (uploaded)
        └─► functions-ci job ──┤
                               └─► deploy-functions job ──► Azure Functions App (updated)
```

---

## State Transitions

### Extension Artifact Password Lifecycle

```
[Not set]
    │ (first main merge)
    ▼
[Generated & stored in EXTENSION_ZIP_PASSWORD secret]
    │ (next main merge)
    ▼
[Previous password overwritten; new password stored]
```

The password in `EXTENSION_ZIP_PASSWORD` always corresponds to the **latest** successfully packaged artifact. Earlier artifacts remain protected by their original passwords (which are no longer stored — intentional: only the latest artifact is the "current" release).
