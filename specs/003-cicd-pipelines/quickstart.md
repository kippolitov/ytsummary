# Quickstart Validation Guide: CI/CD Pipelines

**Branch**: `003-cicd-pipelines` | **Date**: 2026-06-08

This guide describes how to validate that the CI/CD pipelines work end-to-end after implementation. It covers prerequisites, secrets setup, and runnable validation scenarios.

---

## Prerequisites

1. The repository is pushed to GitHub (not just a local git repo).
2. GitHub Actions is enabled for the repository (enabled by default; check under **Settings → Actions → General**).
3. An Azure Functions app exists and is accessible. Download its publish profile from the Azure Portal.
4. You have **Admin** access to the repository to configure secrets and view workflow runs.

---

## One-Time Secrets Setup

Before the CD pipeline can succeed, configure these secrets under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | How to get the value |
|---|---|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Azure Portal → Function App → **Get Publish Profile** (downloads an XML file; paste its full contents) |
| `AZURE_FUNCTIONAPP_NAME` | The name of your Azure Function App (e.g., `ytsummary-functions`) |
| `GH_PAT` | A GitHub Personal Access Token with `repo` scope (needed so the pipeline can call `gh secret set` to store the extension zip password — `GITHUB_TOKEN` cannot write secrets). Create at **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, grant **Secrets → Read and write** for this repository. |

`EXTENSION_ZIP_PASSWORD` is managed automatically by the pipeline — do not create it manually.

---

## Validation Scenario 1: Feature Branch CI (Happy Path)

**Goal**: Confirm that pushing to a feature branch triggers lint, tests, and build for both components.

**Steps**:

1. Create and push a test branch:
   ```
   git checkout -b test/ci-validation
   git commit --allow-empty -m "chore: trigger CI validation"
   git push origin test/ci-validation
   ```
2. Navigate to **Actions** tab in GitHub.
3. Find the `CI` workflow run for this push.

**Expected outcome**:
- Two jobs appear: `extension-ci` and `functions-ci`.
- Both jobs complete successfully (green checkmarks).
- Total wall-clock time is under 5 minutes.

---

## Validation Scenario 2: Feature Branch CI (Failure Path — Lint)

**Goal**: Confirm that a lint error causes the pipeline to fail.

**Steps**:

1. On the `test/ci-validation` branch, introduce a deliberate lint violation in `extension/` (e.g., add `var x = 1` to a `.ts` file, which ESLint will flag).
2. Commit and push.
3. Find the new CI workflow run in the **Actions** tab.

**Expected outcome**:
- The `extension-ci` job fails.
- The job log identifies the offending file and rule.
- The `functions-ci` job is unaffected (passes independently).
- The overall workflow run is marked as failed.

**Cleanup**: Revert the deliberate violation and push again.

---

## Validation Scenario 3: Main Branch CD (Happy Path)

**Goal**: Confirm that merging to main produces a packaged extension artifact and deploys the Functions app.

**Steps**:

1. Push the `test/ci-validation` branch (now clean from Scenario 2) and open a PR to `main`.
2. Merge the PR.
3. Navigate to **Actions** tab and find the `CD` workflow run triggered by the merge.

**Expected outcome**:
- Four jobs appear: `extension-ci`, `functions-ci`, `package-extension`, `deploy-functions`.
- All four jobs complete successfully.
- Under **Artifacts**, an artifact named `extension-<SHA>` is present.
- In GitHub Secrets (`Settings → Secrets → EXTENSION_ZIP_PASSWORD`), the secret now has an updated "last modified" timestamp.
- The Azure Functions app reflects the deployed code (verify via Azure Portal or by calling a known endpoint).

---

## Validation Scenario 4: Artifact Extraction

**Goal**: Confirm the packaged extension .zip is password-protected and extractable with the correct password.

**Steps**:

1. After Scenario 3 completes, download the `extension-<SHA>` artifact from the **Actions** run.
2. Attempt to unzip without a password:
   ```
   unzip extension-<SHA>.zip
   ```
   **Expected**: Extraction fails with a "password required" error.
3. Retrieve the password from **Settings → Secrets → EXTENSION_ZIP_PASSWORD** (requires admin access to copy the value — use `gh secret list` or the GitHub API if needed, noting that secrets cannot be read back through the UI but can be used in scripts).
4. Extract with the password:
   ```
   unzip -P <retrieved-password> extension-<SHA>.zip
   ```
   **Expected**: Archive extracts successfully and contains the built extension files.

> **Note on secret retrieval**: GitHub does not expose secret values in the UI after creation. To retrieve the password, use the `gh` CLI:
> ```
> gh secret list  # confirms it exists
> ```
> The value itself must be retrieved programmatically via the GitHub API with appropriate token permissions, or by re-running the CD pipeline and capturing the value during a debug step (only in a controlled environment).

---

## Validation Scenario 5: No Secrets Leaked in Logs

**Goal**: Confirm no sensitive values appear in any CI/CD log.

**Steps**:

1. Open any completed `CD` workflow run.
2. Click into the `package-extension` job and review each step's log output.
3. Search (Ctrl+F / browser search) for any alphanumeric string that matches the known password pattern (8 characters) — this should not match any coherent sequence in the logs.
4. Repeat for the `deploy-functions` job; verify no credential values appear.

**Expected outcome**: All secrets are masked (shown as `***`) in the logs. No recognizable credential or password string appears.

---

## Validation Scenario 6: Deployment Failure Recovery

**Goal**: Confirm the pipeline fails clearly when Azure credentials are wrong and recovers after correction.

**Steps**:

1. Temporarily set `AZURE_FUNCTIONAPP_NAME` to an invalid value (e.g., `nonexistent-app`).
2. Re-run the CD pipeline (push an empty commit to main via a PR).
3. Observe the `deploy-functions` job.

**Expected outcome**:
- The `deploy-functions` job fails with a clear error message referencing the invalid app name.
- The `package-extension` job completes successfully (independent of deployment).

4. Restore the correct `AZURE_FUNCTIONAPP_NAME` and re-run — deployment succeeds.

---

## Definition of Done

All six validation scenarios must pass before the CI/CD feature is considered complete:

- [ ] Scenario 1: Feature branch CI passes on clean push
- [ ] Scenario 2: Lint failure causes CI to fail; other jobs unaffected
- [ ] Scenario 3: Main merge produces artifact and deploys Functions
- [ ] Scenario 4: Extension .zip is password-protected and extractable
- [ ] Scenario 5: No secrets appear in any log
- [ ] Scenario 6: Deployment failure is clear; recovery works without code changes
