# Workflow Contracts: CI/CD Pipelines

**Branch**: `003-cicd-pipelines` | **Date**: 2026-06-08

These contracts define the interface between the GitHub Actions workflows and the rest of the project. Any change to the repository that affects these contracts must be reflected in the corresponding workflow files.

---

## Contract 1: Extension CI Contract

**What the workflow expects from the extension codebase**:

| Expectation | Command | Location |
|---|---|---|
| Dependency installation | `npm ci` | `extension/` |
| Lint check (zero warnings) | `npm run lint` | `extension/package.json` scripts |
| Unit test run | `npm test` | `extension/package.json` scripts |
| Production build | `npm run build` | `extension/package.json` scripts |
| Extension bundle (CD only) | `npm run zip` (alias for `wxt zip`) | `extension/package.json` scripts |

**Breakage rule**: If any of these scripts are renamed, removed, or changed to a non-zero exit on success, the CI/CD pipeline will fail.

---

## Contract 2: Functions CI/CD Contract

**What the workflow expects from the functions codebase**:

| Expectation | Command | Location |
|---|---|---|
| Dependency installation | `npm ci` | `functions/` |
| Lint check (zero warnings) | `npm run lint` | `functions/package.json` scripts |
| Unit test run | `npm test` | `functions/package.json` scripts |
| Production build + pack | `npm run build:production` | `functions/package.json` scripts |

**Breakage rule**: Same as above. The `build:production` script must produce a deployable artifact (via `func pack`) for the deployment step to succeed.

---

## Contract 3: Secrets Contract

**Secrets that must be pre-configured by a repo admin before the CD pipeline can succeed**:

| Secret Name | Format | Required For |
|---|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | XML string (download from Azure Portal → Function App → Get Publish Profile) | `deploy-functions` job |
| `AZURE_FUNCTIONAPP_NAME` | Plain string (e.g., `ytsummary-functions`) | `deploy-functions` job |

**Secrets managed by the pipeline itself** (no pre-configuration needed):

| Secret Name | Format | Managed By |
|---|---|---|
| `EXTENSION_ZIP_PASSWORD` | 8-char alphanumeric | `package-extension` job |

**Breakage rule**: If `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` or `AZURE_FUNCTIONAPP_NAME` are absent, the deployment job fails. The pipeline must never silently proceed with missing secrets.

---

## Contract 4: Artifact Contract

**The `package-extension` job produces one artifact per CD run**:

| Property | Value |
|---|---|
| Artifact name | `extension-<GITHUB_SHA>` |
| Artifact contents | A `.zip` file, password-protected with AES-256 |
| Password location | `EXTENSION_ZIP_PASSWORD` GitHub Secret (updated by the same job) |
| Retention period | 30 days |

**Consumer contract**: To access the artifact, a team member must:
1. Download the artifact from the GitHub Actions run.
2. Retrieve the password from the `EXTENSION_ZIP_PASSWORD` secret (requires `admin:repo` or `secrets:read` permission).
3. Extract using `unzip -P <password>` or equivalent tool.

---

## Contract 5: Branch Strategy Contract

| Branch pattern | Pipeline triggered | Jobs |
|---|---|---|
| Any branch except `main` | `ci.yml` | `extension-ci`, `functions-ci` |
| `main` | `cd.yml` | `extension-ci`, `functions-ci`, `package-extension`, `deploy-functions` |

**Breakage rule**: Renaming the default branch from `main` requires updating the `branches` filter in both `ci.yml` and `cd.yml`.
