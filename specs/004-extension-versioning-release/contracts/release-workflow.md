# Contract: Release Workflow (`release.yml`)

**File**: `.github/workflows/release.yml`
**Trigger**: `push: tags` matching `v[0-9]+.[0-9]+.[0-9]+`

## Workflow Schema

```yaml
name: Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

concurrency:
  group: release-${{ github.ref_name }}
  cancel-in-progress: false

permissions:
  contents: write      # required for gh release create and asset upload

jobs:
  release:
    name: Build and Release Extension
    runs-on: ubuntu-latest
    steps:

      # 1. Checkout full history (needed for --generate-notes to find previous tag)
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # 2. Validate: package.json version must match the pushed tag
      - name: Validate version matches tag
        run: |
          PKG_VERSION=$(jq -r '.version' extension/package.json)
          TAG_VERSION="${GITHUB_REF_NAME#v}"
          if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
            echo "ERROR: package.json version ($PKG_VERSION) does not match tag ($TAG_VERSION)"
            exit 1
          fi
          echo "VERSION=$PKG_VERSION" >> "$GITHUB_ENV"

      # 3. Duplicate guard: fail if this release already exists
      - name: Check for duplicate release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if gh release view "$GITHUB_REF_NAME" &>/dev/null; then
            echo "ERROR: GitHub Release $GITHUB_REF_NAME already exists"
            exit 1
          fi

      # 4. Node.js setup and install
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
          cache-dependency-path: extension/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: extension

      # 5. CI gate (lint, test, build)
      - name: Lint
        run: npm run lint
        working-directory: extension

      - name: Unit tests
        run: npm test
        working-directory: extension

      - name: Build extension
        run: npm run build
        working-directory: extension

      # 6. Produce WXT zip
      - name: Zip extension
        run: npm run zip
        working-directory: extension

      # 7. Create password-protected archive
      - name: Create password-protected archive
        env:
          GH_TOKEN: ${{ secrets.GH_PAT }}
        run: |
          PASSWORD=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8)
          echo "::add-mask::$PASSWORD"
          ARCHIVE="ytsummary-v${{ env.VERSION }}.7z"
          7za a -p"$PASSWORD" -mhe=on "$ARCHIVE" extension/.output/*.zip
          echo "ARCHIVE=$ARCHIVE" >> "$GITHUB_ENV"
          gh secret set EXTENSION_ZIP_PASSWORD -b "$PASSWORD" --repo "$GITHUB_REPOSITORY"

      # 8. Create GitHub Release and upload archive asset
      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "$GITHUB_REF_NAME" \
            --title "$GITHUB_REF_NAME" \
            --generate-notes \
            "${{ env.ARCHIVE }}"
```

## Invariants

| Invariant | Enforcement |
|---|---|
| Tag and `package.json` version match | Step 2 exits non-zero if mismatch |
| No duplicate releases | Step 3 exits non-zero if `gh release view` succeeds |
| Password never appears in logs | `::add-mask::` applied before any use |
| Archive filename includes version | `ytsummary-v${{ env.VERSION }}.7z` |
| Archive stored as release asset only | Passed as argument to `gh release create`; no `actions/upload-artifact` call |
| Contents: write permission | Set at workflow level on `GITHUB_TOKEN` |
| `GH_PAT` used only for `gh secret set` | All other `gh` calls use `GITHUB_TOKEN` |

## Required Secrets

| Secret | Purpose | Already Exists? |
|---|---|---|
| `GH_PAT` | Write password back to GitHub Secrets via `gh secret set` | Yes (from 003-cicd-pipelines) |
| `GITHUB_TOKEN` | Create release + upload asset | Auto-provided by Actions |

## Workflow Guarantees

- If any step fails, no GitHub Release is created (steps are sequential; `gh release create` is the final step)
- The `concurrency` group `release-${{ github.ref_name }}` prevents two simultaneous runs for the same tag
- `cancel-in-progress: false` ensures an in-flight release is never abandoned mid-flight
