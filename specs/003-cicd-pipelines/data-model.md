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

**Job: `package-extension`** (depends on `extension-ci`)

| Step | Action | Secret access |
|---|---|---|
| Install dependencies | `npm ci` in `extension/` | — |
| Build extension | `npm run build` | — |
| Zip extension | `wxt zip` in `extension/` | — |
| Generate password | `openssl rand` piped through `tr`; mask via `::add-mask::` | — |
| Create password-protected archive | `zip --password $PASSWORD` wrapping wxt output | — |
| Store password | `gh secret set EXTENSION_ZIP_PASSWORD` | `GITHUB_TOKEN` (write:secrets) |
| Upload artifact | `actions/upload-artifact` | — |

**Job: `deploy-functions`** (depends on `functions-ci`)

| Step | Action | Secret access |
|---|---|---|
| Install dependencies | `npm ci` in `functions/` | — |
| Build for production | `npm run build:production` | — |
| Deploy to Azure | `azure/functions-action` | `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`, `AZURE_FUNCTIONAPP_NAME` |

---

### 3. GitHub Secrets

| Name | Type | Set By | Used By |
|---|---|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Azure publish profile XML | Repo admin (one-time setup) | `deploy-functions` job |
| `AZURE_FUNCTIONAPP_NAME` | String (app name) | Repo admin (one-time setup) | `deploy-functions` job |
| `EXTENSION_ZIP_PASSWORD` | 8-char alphanumeric string | `package-extension` job (auto-overwritten) | Team members (manual retrieval) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | GitHub (automatic) | `package-extension` job (to update secrets) |

---

### 4. Extension Artifact

| Attribute | Value |
|---|---|
| Artifact name | `extension-<GITHUB_SHA>.zip` |
| Contents | Password-protected .zip of built extension |
| Retention | 30 days (GitHub default) |
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
