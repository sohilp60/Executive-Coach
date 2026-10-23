# Senior PO Executive Coach — Release v0.2.0

**Repository:** `sohilp60/Executive-Coach` (`https://github.com/sohilp60/Executive-Coach/releases`)  
**Tag:** `v0.2.0`  
**Release Title:** `v0.2.0 — GitHub Auto-Updater, Full Backup & Restore, and Notion Status/Delta Sync`

---

## Highlights & New Capabilities

1. **GitHub Release Checker & 1-Click Auto-Updater**
   - Added a dedicated **Extension Updates** module in Settings that queries GitHub Releases (`sohilp60/Executive-Coach`) and branch manifests for newer semantic versions.
   - Automatically triggers native browser extension reload when staged or downloads the latest release package (`.zip` / `.crx`) with release notes and changelog preview.
   - Includes a built-in **GitHub Release Publisher** in Settings to publish new releases and compiled `.zip` bundles directly to `https://github.com/sohilp60/Executive-Coach/releases`.

2. **Full Configuration & PO Memory Backup (Export / Import `.json`)**
   - Export all LLM provider configurations, custom endpoints, router fallback priorities, Notion settings, status filters, synced tasks, chat history, and the PO Memory Vault (profile, stakeholders, product rules, daily commitments) into a portable `.json` backup file.
   - Optional privacy toggle to include or strip API keys and tokens when exporting.
   - 1-click **Import Backup File (.json)** restores your entire workspace immediately on any fresh installation.

3. **Notion Status-Filtered Anti-Clutter Sync**
   - Automatically discovers all available task statuses from your Notion database schema and active pages.
   - Interactive status selector Modal & Settings filter lets you choose the exact Notion statuses you want to sync (defaulting to active statuses and excluding completed/archived clutter).

4. **Configurable Periodic Notion Delta Sync**
   - Set a background sync interval in minutes (`Off`, `5m`, `10m`, `15m`, `30m`, `60m`, or custom) powered by `chrome.alarms`.
   - Performs lightweight **Delta Updates** using Notion `last_edited_time` checkpoints—merging newly created or modified tasks and removing tasks whose status moved outside your selected filter.

5. **Unified Multi-LLM Router & Core Reliability Fixes**
   - Unified the Multi-LLM Router (Groq, NVIDIA NIM, Google Gemini, Anthropic Claude, OpenAI, Cerebras, Mistral, OpenRouter, plus Custom/Local Ollama & LM Studio providers) with dynamic `/models` syncing and PII scrubbing.
   - Persistent **Coach Strategy** callout sync to Notion pages, Universal Context Capture (`Ctrl+Shift+K`), and Morning Triage Must-Win workflow.

---

## Installation & Upgrade Instructions (Chrome & Microsoft Edge)

### Option A: Updating an Existing Installation
1. Before updating (or if doing a clean install), open **Settings → Backup & Restore** and click **Export Full Backup (.json)** to save a snapshot of your keys and PO Memory.
2. Download **`po-executive-coach-v0.2.0.zip`** from the **Assets** section of `https://github.com/sohilp60/Executive-Coach/releases`.
3. Extract the `.zip` archive over your existing unpacked extension folder (or into a new folder).
4. In **Settings → Extension Updates**, click **Reload Extension** (or visit `chrome://extensions` / `edge://extensions` and click the **Reload** icon on *Senior PO Executive Coach*).
5. If you extracted into a new folder on a fresh profile, open **Settings → Backup & Restore** and click **Import Backup File (.json)** to restore all settings in one click.

### Option B: Fresh Unpacked Installation
1. Download and extract **`po-executive-coach-v0.2.0.zip`** to a permanent folder on your computer.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

