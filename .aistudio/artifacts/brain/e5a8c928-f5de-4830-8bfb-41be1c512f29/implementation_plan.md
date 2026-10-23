# GitHub Release v0.2.0 Publisher & Extension Packaging

Bump the Senior PO Executive Coach extension to version `0.2.0`, bundle a production-ready extension `.zip` archive with complete release notes and unpacked installation instructions, and add a direct in-app GitHub Release Publisher in Settings to publish `v0.2.0` to `Sohil56/Executive-Coach` using your GitHub Personal Access Token.

## User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below reflect your confirmed choices from Phase 1 and govern how version `0.2.0` will be packaged and published to GitHub.

- **Confirmed Decision 1 — Direct In-App GitHub Release Publishing**: Add a dedicated **Publish Release to GitHub** workflow inside the Settings panel that uses your configured GitHub Personal Access Token to create the release via the GitHub Releases REST API and upload the compiled extension asset.
- **Confirmed Decision 2 — Target Repository & Tag Format**: Pre-configure the release target to `Sohil56/Executive-Coach` on branch `main` with tag `v0.2.0` and release title `v0.2.0 — GitHub Auto-Updater, Full Backup & Restore, and Notion Status/Delta Sync`.
- **Confirmed Decision 3 — Release Scope & Attached Assets**: Include the full `v0.2.0` changelog of features and fixes, step-by-step unpacked Chrome/Edge installation and upgrade instructions, and automatically attach the compiled `po-executive-coach-v0.2.0.zip` extension package to the GitHub Release.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades the application version to `0.2.0` across all runtime manifests, generates a pre-built `po-executive-coach-v0.2.0.zip` extension distribution package, and equips the Settings view with a 1-click GitHub Release Publisher that creates tag `v0.2.0`, populates structured Markdown release notes, and uploads the compiled `.zip` binary asset directly to `Sohil56/Executive-Coach`.
- **Target Audience / Persona**: Senior Product Owners maintaining and distributing the Executive Coach Chrome & Edge extension across personal and work machines.
- **Key Value**: Eliminates manual release drafting and zip packaging—allowing you to publish a verified `v0.2.0` release (complete with binary `.zip` asset and release notes) directly from the extension Settings panel so that the built-in GitHub Auto-Updater immediately recognizes `v0.2.0` as the latest release.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Version `0.2.0` Verification**: Opening the Settings tab displays the updated `Installed: v0.2.0` badge in the Extension Updates section.
  2. **Reviewing & Customizing Release Details**: Expanding the **Publish Release to GitHub (`v0.2.0`)** panel reveals pre-filled fields for:
     - **Tag Name**: `v0.2.0` (targeting `Sohil56/Executive-Coach` on `main`)
     - **Release Title**: `v0.2.0 — GitHub Auto-Updater, Full Backup & Restore, and Notion Status/Delta Sync`
     - **Release Notes (Markdown)**: Pre-populated with a comprehensive changelog of all `v0.2.0` features, architectural improvements, and Chrome/Edge unpacked installation & upgrade steps (with a "Reset to Default v0.2.0 Notes" button).
     - **Release Asset Attachment**: Toggle to automatically attach the bundled `po-executive-coach-v0.2.0.zip` production build (plus an option to download the `.zip` locally at any time).
  3. **Publishing to GitHub**: Clicking **Publish v0.2.0 Release to GitHub** validates that a GitHub Personal Access Token (with `repo` or `contents:write` permission) is entered, creates (or updates if `v0.2.0` already exists) the GitHub Release on `Sohil56/Executive-Coach`, uploads `po-executive-coach-v0.2.0.zip` as a downloadable release asset, and displays a confirmation banner with a direct link to the live GitHub Release page.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast utilitarian SaaS console matching the existing Executive Coach sidepanel design system.
  - *Color Palette & Mood*: Neutral slate/navy surfaces (`bg-white dark:bg-navy-900`), crisp hairline borders (`border-slate-300 dark:border-navy-700`), primary indigo action controls (`bg-indigo-600 hover:bg-indigo-700`), and semantic emerald/amber/crimson status banners.
  - *Typography & Hierarchy*: Clean sans-serif UI labels paired with monospace tabular numerals (`font-mono tabular-nums`) for version tags (`v0.2.0`), asset file sizes, and timestamps.
  - *Component Styling & Layout*: Single-elevation card layout integrated seamlessly into the **Extension Updates (GitHub Release Auto-Updater)** section of Settings, avoiding nested card clutter.

- **Interactive Feedback & Motion**:
  - Multi-stage progress indicator during release creation (`Creating release tag v0.2.0...` → `Uploading po-executive-coach-v0.2.0.zip asset...` → `Published v0.2.0!`).
  - Inline validation if the GitHub Personal Access Token is missing or lacks write permissions, explaining the exact token scope required (`repo` / `Contents: Read and write`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Step GitHub REST + Asset Upload Flow with Idempotent Tag Handling**
  - *Chosen Approach*: When publishing `v0.2.0`, first call `POST /repos/{owner}/{repo}/releases` (and if `v0.2.0` already exists with HTTP 422, automatically look up the existing `v0.2.0` release by tag and update it via `PATCH /repos/{owner}/{repo}/releases/{release_id}`). Then upload the binary `.zip` package to the release's `upload_url` (`https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets?name=po-executive-coach-v0.2.0.zip`).
  - *Why*: Ensures publishing never fails due to a duplicate tag conflict and guarantees that the compiled `.zip` asset is attached so `checkGitHubForUpdates` picks up the `.zip` asset URL immediately.
  - *Alternatives Considered*: Creating only a text release without an attached `.zip` asset (rejected because the user requested attaching the compiled extension `.zip` asset for installation).

- **Decision 2: Bundling Pre-Compiled `po-executive-coach-v0.2.0.zip` for Zero-Friction Upload**
  - *Chosen Approach*: Build the `0.2.0` extension bundle during packaging and serve `po-executive-coach-v0.2.0.zip` as a static asset so the browser/extension can fetch its binary `ArrayBuffer` and upload it directly to GitHub Releases with zero manual file selection required (while also allowing local download or custom `.zip` selection).
  - *Why*: Lets the user publish the complete release and binary asset in a single click right from Settings.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     Settings View (ProviderSettings)                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │        Extension Updates & GitHub Release Publisher (v0.2.0)        │  │
│  │  • Installed Badge: v0.2.0                                          │  │
│  │  • Repo: Sohil56/Executive-Coach | Branch: main | Token Input       │  │
│  │  • Actions: [Check GitHub for Updates] [Publish v0.2.0 Release]     │  │
│  │  • Release Composer: Tag (v0.2.0), Title, Markdown Changelog,       │  │
│  │    Auto-Attach Compiled Asset (po-executive-coach-v0.2.0.zip)       │  │
│  └──────────────────┬───────────────────────────────────┬──────────────┘  │
└─────────────────────┼───────────────────────────────────┼─────────────────┘
                      │                                   │
        CHECK_GITHUB_UPDATE                 PUBLISH_GITHUB_RELEASE
                      ▼                                   ▼
┌─────────────────────────────────────┐ ┌───────────────────────────────────┐
│   GitHub Auto-Updater Service       │ │   GitHub Release Publisher        │
│  • Compares local v0.2.0 vs remote  │ │  1. Fetch bundled v0.2.0 .zip     │
│  • Inspects /releases/latest        │ │  2. POST/PATCH /repos/.../releases│
│  • Triggers auto-download / reload  │ │  3. POST binary to uploads.github │
└─────────────────────────────────────┘ └───────────────────────────────────┘
```

- **Data Model & State**:
  - `ReleasePublishPayload`:
    - `repoSlug`: `'Sohil56/Executive-Coach'`
    - `tagName`: `'v0.2.0'`
    - `targetCommitish`: `'main'`
    - `releaseName`: `'v0.2.0 — GitHub Auto-Updater, Full Backup & Restore, and Notion Status/Delta Sync'`
    - `body`: Complete Markdown release notes covering all `v0.2.0` features, bug fixes, and Chrome/Edge unpacked installation & update instructions.
    - `draft`: `false`, `prerelease`: `false`
    - `attachCompiledZip`: `boolean` (defaults to `true`)
  - `ReleasePublishResult`:
    - `ok`: `boolean`
    - `htmlUrl`: Published GitHub release URL
    - `tagName`: `'v0.2.0'`
    - `assetUploaded`: `boolean`
    - `assetDownloadUrl`: Direct browser download URL for `po-executive-coach-v0.2.0.zip`
    - `error`: Optional error string

- **Interactive Component & State Mapping**:
  - **Manifest & Version Synchronization**: Version updated to `0.2.0` across extension manifest, package metadata, and runtime version fallback.
  - **Release Publisher Panel Toggle & Editor**: Users can inspect or edit the `v0.2.0` tag, title, and Markdown release notes, reset to the default `v0.2.0` changelog template, download the compiled `po-executive-coach-v0.2.0.zip` locally, or click **Publish v0.2.0 Release to GitHub**.
  - **Host Permissions**: Include `https://uploads.github.com/*` alongside `https://api.github.com/*` so binary `.zip` release assets upload cleanly from both the extension service worker and web preview.
