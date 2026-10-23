# GitHub Release v0.2.0 for `sohilp60/Executive-Coach`

This update retargets the **Senior PO Executive Coach** extension's GitHub Release publisher, auto-updater, and release documentation to **`https://github.com/sohilp60/Executive-Coach/releases`**, auto-migrating any previously saved `Sohil56/Executive-Coach` setting and providing both 1-click API publishing and a 1-click pre-filled GitHub web release launcher.

## User Review & Critical Decisions

> [!IMPORTANT]
> Because the AI Studio environment does not hold your personal GitHub credentials on the server, publishing a release to `https://github.com/sohilp60/Executive-Coach/releases` requires either **(A)** clicking **Publish v0.2.0 Release to GitHub** in Settings with your GitHub Personal Access Token, or **(B)** clicking **Open Pre-Filled GitHub Release Page** in Settings (which opens `https://github.com/sohilp60/Executive-Coach/releases/new?tag=v0.2.0&title=...&body=...` directly in your logged-in browser where you only need to drag-and-drop the `.zip` and click Publish).

- **Confirmed Decision 1 — Target Repository**: Set default repository across the Auto-Updater, Release Publisher, and Release Notes to **`sohilp60/Executive-Coach`** (`https://github.com/sohilp60/Executive-Coach/releases`).
- **Confirmed Decision 2 — Automatic Setting Migration**: Automatically migrate any cached `Sohil56/Executive-Coach` repository slug in local extension storage to `sohilp60/Executive-Coach` so the Settings UI immediately targets the right repository without manual typing.
- **Confirmed Decision 3 — Dual 1-Click Release Workflow**: Provide both the direct GitHub REST API publisher (for token-based 1-click publishing + `.zip` upload) and a **1-Click Pre-Filled GitHub Release Web Button** (`releases/new?tag=v0.2.0&title=...&body=...`) that downloads `po-executive-coach-v0.2.0.zip` and opens your repository's New Release page with the tag, title, and changelog already filled in.

---

## 1. Overview & Core Concept

- **What It Does**: Points all release publishing, version checking, and documentation to `https://github.com/sohilp60/Executive-Coach/releases` for version `0.2.0`, and adds a zero-token fallback button that pre-populates the GitHub New Release form on `sohilp60/Executive-Coach` while downloading the compiled `po-executive-coach-v0.2.0.zip` package.
- **Target Audience / Persona**: Product Owner maintaining and distributing the `sohilp60/Executive-Coach` Chrome/Edge extension.
- **Key Value**: Eliminates repository slug mismatches and allows publishing `v0.2.0` to `https://github.com/sohilp60/Executive-Coach/releases` in seconds—either via API token or directly through your active GitHub browser session.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Automatic Repo Retargeting**: Opening **Settings** immediately displays `sohilp60/Executive-Coach` in the **Extension Updates & GitHub Release Publisher** card at the top of the panel.
  2. **1-Click Pre-Filled GitHub Web Release (No Token Needed)**: Clicking **Create Release on GitHub.com (Pre-Filled)** simultaneously downloads `po-executive-coach-v0.2.0.zip` and opens `https://github.com/sohilp60/Executive-Coach/releases/new` with `tag=v0.2.0`, the release title, and the full markdown changelog pre-populated.
  3. **1-Click API Release Publisher (With GitHub Token)**: Pasting a GitHub Personal Access Token (`repo` or `Contents: Read & Write` scope) and clicking **Publish v0.2.0 Release to GitHub** creates the `v0.2.0` tag and release via the GitHub REST API and uploads `po-executive-coach-v0.2.0.zip` automatically.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian SaaS developer console with single-elevation cards and crisp 1px structural borders.
  - *Color Palette & Mood*: Obsidian dark (`#0F172A`) and high-contrast light (`#FFFFFF`) surfaces with indigo (`#4F46E5`) primary actions and emerald (`#16A34A`) release confirmation states.
  - *Typography & Hierarchy*: Clean sans-serif UI labels paired with monospace tabular numerals (`font-mono tabular-nums`) for version tags (`v0.2.0`), repository slugs (`sohilp60/Executive-Coach`), and timestamps.
  - *Component Styling & Layout*: Single-line action buttons (`whitespace-nowrap shrink-0`) placed at the top of the Settings view for zero-scroll access.
- **Interactive Feedback & Motion**: Instant loading spinners during API calls, clear status banners with direct links to `https://github.com/sohilp60/Executive-Coach/releases`, and automatic zip download triggers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Auto-Migrate Cached `Sohil56/Executive-Coach` Storage State**
  - *Chosen Approach*: When loading `po_github_update_config` from `chrome.storage.local`, automatically replace `Sohil56/Executive-Coach` with `sohilp60/Executive-Coach`.
  - *Why*: Ensures existing browser storage from earlier sessions doesn't keep pointing at the old repository username.
  - *Alternatives Considered*: Requiring the user to manually edit the text input (error-prone and easy to miss).
- **Decision 2: Add Pre-Filled GitHub Web Release Launcher Alongside API Publisher**
  - *Chosen Approach*: Construct a URL-encoded `https://github.com/sohilp60/Executive-Coach/releases/new?tag=v0.2.0&title=...&body=...` action button that also triggers the local download of `po-executive-coach-v0.2.0.zip`.
  - *Why*: Even without generating a GitHub Personal Access Token, the user can publish the release in two clicks using their existing logged-in GitHub browser session.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                Settings UI (Extension Updates & Publisher)              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Repo Slug: sohilp60/Executive-Coach  (Auto-migrated from storage) │  │
│  ├─────────────────────────────────┬─────────────────────────────────┤  │
│  │ Option A: API Publisher         │ Option B: Pre-Filled Web Launch │  │
│  │ [Publish v0.2.0 via Token]      │ [Open GitHub Release + Get Zip] │  │
│  └────────────────┬────────────────┴────────────────┬────────────────┘  │
└───────────────────┼─────────────────────────────────┼───────────────────┘
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│ Service Worker / GitHub Updater Core  │ │ Browser Tab + Zip Download    │
│ • POST /repos/sohilp60/.../releases   │ │ • Downloads v0.2.0 .zip asset │
│ • POST uploads.github.com/.../assets  │ │ • Opens github.com/sohilp60/  │
│ • Returns live release & asset URLs   │ │   Executive-Coach/releases/new│
└───────────────────────────────────────┘ └───────────────────────────────┘
```
- **Data Model & State**:
  - `DEFAULT_GITHUB_UPDATE_CONFIG.repoSlug`: Updated to `'sohilp60/Executive-Coach'`.
  - Storage migration hook: Normalizes any stored `Sohil56/Executive-Coach` value to `sohilp60/Executive-Coach` on initialization and persists it.
- **Interactive Component & State Mapping**:
  - **Publish via Token Button**: Validates `repoSlug` (`sohilp60/Executive-Coach`) and `githubToken`, dispatches `PUBLISH_GITHUB_RELEASE`, uploads `po-executive-coach-v0.2.0.zip`, and renders a direct link to the live release.
  - **Open Pre-Filled GitHub Release Button**: Triggers download of `/po-executive-coach-v0.2.0.zip` and opens `https://github.com/sohilp60/Executive-Coach/releases/new` pre-populated with `tag=v0.2.0`, `title`, and `body`.
