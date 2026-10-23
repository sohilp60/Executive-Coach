# Senior PO Executive Coach — Core Bug Fixes, Module Unification & Runtime Stabilization

> **Status: COMPLETED**  
> All core bug fixes, module unifications, and runtime stabilizations have been implemented, verified, and compiled with zero errors.

This plan resolves all broken workflows, unifies split LLM and storage modules, wires up disconnected components (Morning Triage, PII Scrubber, Active Tab Context, and Google Drive PKCE Sync), and ensures seamless dual-mode execution as both a Chromium/Edge Manifest V3 extension and a standalone web application preview.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Scope & Architectural Decisions**
> Based on your selections, this plan focuses strictly on stabilizing and unifying existing capabilities before expanding to new roadmap items:
> - **Confirmed Decision 1 — Fix Core Bugs & Wire Disconnected Modules**: Repair the broken Google Drive backup/restore flow, connect the orphaned `MorningTriageModal` and `pii-scrubber`, fix "Grab Active Tab" in Coach Chat, and wire autonomous memory action parsing end-to-end.
> - **Confirmed Decision 2 — Unify Duplicate LLM & Storage Layers**: Consolidate the split LLM logic (`router`, `openai-adapter`, `anthropic-adapter`, `action-parser`, and `prompts`) and standardize all storage keys through the typed storage layer so components and background workers never desync.
> - **Confirmed Decision 3 — Focus on Existing Feature Stabilization**: Defer new P1 `Ideas.md` expansion features so that every currently built workflow operates reliably without regressions.
> - **Recommended Default — Dual-Mode Runtime (Extension + Web Preview)**: Provide a lightweight browser-safe `chrome.*` storage/messaging polyfill when running outside an extension context so the app works both as an installed Chrome/Edge MV3 extension and in the port 3000 web preview.

---

## 1. Overview & Core Concept

- **What It Does**: **Senior PO Executive Coach** is an executive productivity and anti-procrastination system for Product Owners. It provides ruthless daily triage, 5-minute friction breaking with a live sprint countdown, multi-provider AI coaching with autonomous memory harvesting, bi-directional Notion task and strategy injection, universal DOM context capture from Teams/Outlook/Jira/Confluence, and Google Drive memory vault backups.
- **Target Audience / Persona**: Senior Product Owners and Technical Product Managers managing high-entropy backlogs, complex technical specifications, and cross-functional stakeholders.
- **Key Value**: Eliminates ambiguity-induced procrastination and context-switching drag by keeping daily Must-Win commitments, stakeholder dynamics, Notion tasks, and executive coaching unified in a zero-latency workspace.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Morning Triage & Daily Must-Wins**: Users can launch the 3-step **Morning Triage** modal directly from the header or Triage view (or automatically when today's triage is incomplete) to lock in 1–2 Must-Win outcomes, assign missing deadlines directly to undated Notion tasks, and log their top procrastination risk into the Memory Vault.
  2. **Executive Coach Chat & Active Tab Context**: Clicking **Grab Active Tab** dispatches a unified context extraction request to the background worker, displays a clean context indicator with character count and source title, and streams responses from the configured LLM queue. When the AI identifies new product rules, stakeholder facts, or Must-Wins via `<coach_action>` blocks, the parser automatically updates the Memory Vault and surfaces a subtle confirmation toast.
  3. **Task Board & Notion Strategy Injection**: Users filter tasks across *Active*, *Focus (Overdue & No Deadline)*, *All*, and *Done* views, run an AI Triage Briefing across their active backlog, or generate a 3-point **Coach Strategy** (*Angle of Attack*, *First 5-Min Micro-Step*, *Downstream Alignment*) that injects directly into the Notion page as a structured callout block.
  4. **Memory Vault & Google Drive Sync**: Users manage their Role Profile, Stakeholder Profiles, Product Rules, and 14-day Commitments Log, with working 1-click **Backup to Google Drive** and **Restore from Google Drive** powered by the configured OAuth Client ID and PKCE / WebAuthFlow.
  5. **Provider Router & Privacy Guard**: Users configure primary and ordered fallback LLM providers, sync live model lists, test connectivity, and toggle **Strict Work Privacy Mode** to automatically scrub emails, phone numbers, SSNs, credit cards, and IPv4 addresses before any prompt leaves the browser.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft SaaS executive command console — crisp, distraction-free, and engineered for rapid scannability in both narrow side-panel docking ($400\text{px}$–$440\text{px}$) and full desktop web preview ($1440\text{px}$).
  - *Color Palette & Mood* (**60-30-10 Discipline**):
    - **60% Dominant Neutral Canvas**: Deep obsidian slate (`#070B14` / `bg-navy-950`) in dark mode; crisp alabaster (`#F8FAFC` / `bg-slate-50`) in light mode.
    - **30% Structural Surfaces**: Single-elevation cards (`#0F172A` / `bg-navy-900` dark, `#FFFFFF` / `bg-white` light) bounded by 1px hairline borders (`border-slate-200 dark:border-navy-800`) without nested card-in-card clutter or thick left accent borders.
    - **10% Accent Budget**: Executive Indigo (`#4F46E5`) for primary interactive actions, paired with semantic status tokens (`#16A34A` Emerald for completed/nominal, `#D97706` Amber for due-today/warnings, `#DC2626` Crimson for overdue/errors) always accompanied by explicit text labels.
  - *Typography & Hierarchy* (**2+1 Font Rule**):
    - **Display & Navigation**: `Plus Jakarta Sans` (SemiBold/Bold 600–700) with `text-wrap: balance` and optical tracking compensation in dark mode.
    - **Body & Dense Scannability**: `DM Sans` / `Plus Jakarta Sans` (Regular/Medium 400–500) at `13px`–`15px` for comfortable reading across chat bubbles and task rows.
    - **Data, Timestamps & Countdown Timers**: `JetBrains Mono` with strict `tabular-nums` (`font-mono tabular-nums`) on all task counters, 5-minute sprint timers, and date stamps to prevent layout jitter.
  - *Zero-Pill Metadata Discipline*: Informational metadata on task cards and logs (due dates, timestamps, categories) renders as clean, unboxed inline text separated by `·` dividers, reserving pill/button styling strictly for interactive filter controls and clickable triggers.

- **Interactive Feedback & Motion**:
  - Fast $\le 150\text{ms}$ compositor transitions (`transform`, `opacity`) on view switches, modal overlays, and collapsible strategy drawers.
  - Explicit loading states, inline error banners with actionable recovery hints, and confirmation badges for Notion sync, Google Drive backup/restore, and memory updates.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Consolidating the Split LLM Pipeline & Action Schema**
  - *Chosen Approach*: Route all OpenAI-compatible requests through the buffered SSE implementation in `openai-adapter`, route Anthropic requests through `anthropic-adapter`, apply `scrubPII()` inside the central router whenever `strictWorkPrivacyMode` is active, and unify `<coach_action>` parsing through the dedicated `action-parser` module.
  - *Why*: Currently, `router` duplicates `openai-adapter` with a less resilient line splitter that drops partial JSON chunks, `pii-scrubber` is completely bypassed, and `CoachChat` looks for `{"tool": "upsert_memory_fact"}` while `action-parser` looks for `{"type": "upsert_memory_fact"}` and `prompts` defines neither format. Unifying them makes streaming rock-solid, enforces PII scrubbing globally, and makes autonomous memory harvesting actually work.
  - *Alternatives Considered*: Keeping inline fetch logic in `router` and removing `openai-adapter` — rejected because modular adapters keep provider-specific protocol quirks cleanly isolated.

- **Decision 2: Unifying Storage Keys via the Typed Cache Layer**
  - *Chosen Approach*: Standardize storage keys across `local-cache`, `App`, `MemoryVault`, `ProviderSettings`, and `service-worker` (supporting seamless migration/fallback for both `po_memory` / `po_memory_store` and `po_providers` / `po_llm_providers`).
  - *Why*: Eliminates the key mismatch where `local-cache` read from `po_memory_store` and `po_llm_providers` while `App` wrote to `po_memory` and `po_providers`.

- **Decision 3: Fixing "Grab Active Tab" via Service Worker Messaging**
  - *Chosen Approach*: Update `CoachChat` to send `{ type: 'GRAB_TAB_CONTEXT' }` to the background service worker (with an automatic fallback to querying the active tab if `_activeTabId` is not yet set in storage) rather than injecting a raw `.ts` source path from the side panel.
  - *Why*: In a bundled Vite/CRX build, `files: ['src/content/dom-extractor.ts']` fails at runtime because `.ts` files are compiled into bundle chunks, whereas `service-worker` already imports `extractPageContext` as a bundled function reference and executes it safely via `func: extractPageContext`.

- **Decision 4: Dual-Mode Runtime Polyfill for Web Preview & Extension**
  - *Chosen Approach*: Provide a lightweight browser environment adapter that delegates to native `chrome.*` APIs when running inside the Chrome/Edge extension and falls back to `localStorage` + in-app message handling when opened in a standard browser tab on port 3000.
  - *Why*: Preserves 100% Manifest V3 extension compliance while allowing instant visual inspection, testing, and usage inside the standard web preview environment.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      SIDE PANEL / WEB WORKSPACE UI (React)                    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                       App Shell & State Coordinator                     │  │
│  │   - Theme & Storage Sync   - Active Tab Listener   - Triage Trigger     │  │
│  └──────┬──────────────┬──────────────┬──────────────┬──────────────┬──────┘  │
│         │              │              │              │              │         │
│         ▼              ▼              ▼              ▼              ▼         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ CoachChat  │ │   Triage   │ │ TaskDrawer │ │MemoryVault │ │  Settings  │   │
│  │ + Tab Grab │ │ + Friction │ │ + Strategy │ │ + GDrive   │ │ + Router   │   │
│  │ + Actions  │ │ + Morning  │ │ + Analyzer │ │   Backup   │ │ + Notion   │   │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘   │
│         │              │              │              │              │         │
│         └──────────────┴──────────────┼──────────────┴──────────────┘         │
│                                       │                                       │
│         ┌─────────────────────────────┴─────────────────────────────┐         │
│         ▼                                                           ▼         │
│  ┌────────────────────────────────────┐   ┌────────────────────────────────┐  │
│  │     Unified LLM Router Engine      │   │  Typed Storage & Runtime Bus   │  │
│  │  1. PII Scrubber (Strict Privacy)  │   │  - Chrome Storage / Polyfill   │  │
│  │  2. Primary -> Fallback Queue      │   │  - Unified Storage Keys        │  │
│  │  3. OpenAI & Anthropic SSE Stream  │   │  - Runtime Message Dispatcher  │  │
│  │  4. Dual-Mode Action Parser        │   └────────────────┬───────────────┘  │
│  └────────────────────────────────────┘                    │                  │
└────────────────────────────────────────────────────────────┼──────────────────┘
                                                             │
                                      chrome.runtime.sendMessage / Polyfill Bus
                                                             │
┌────────────────────────────────────────────────────────────▼──────────────────┐
│                     BACKGROUND SERVICE WORKER & INTEGRATIONS                  │
│                                                                               │
│  ┌────────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │   DOM Capture Engine   │  │  Notion REST Client  │  │ Google Drive Sync │  │
│  │  - Teams / Outlook     │  │  - Direct or Proxy   │  │ - OAuth WebFlow   │  │
│  │  - Jira / Confluence   │  │  - Schema Inspector  │  │ - Multipart JSON  │  │
│  │  - Floating Pill & Cmd │  │  - Callout Injector  │  │   Upload/Download │  │
│  └────────────────────────┘  └──────────────────────┘  └───────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **`POMemoryStore`**: Stores `userProfile` (`role`, `platformDomain`, `coreResponsibilities`, `procrastinationTriggers`), `teamAndStakeholders`, `productRulesAndContext`, and `dailyCommitmentsLog` (indexed by `YYYY-MM-DD` with `mustWinTaskIds`, `morningTriageCompleted`, and `midDayCheckStatus`).
- **`LLMProviderConfig` & `RouterSettings`**: Configures `primaryProviderId`, ordered `fallbackProviderIds`, `strictWorkPrivacyMode`, and per-provider credentials/models.
- **`NotionTask` & `NotionConfig`**: Tracks synced Notion database tasks (`id`, `title`, `status`, `dueDate`, `priority`, `url`, `archived`, `coachStrategy`, `coachStrategyBlockId`) and connection settings (`apiKey`, `databaseId`, `notionProxyUrl`).
- **`CapturePayload`**: Discriminated union (`teams` | `outlook` | `jira` | `confluence` | `generic`) holding structured DOM metadata and selected text.

### Interactive Component & State Mapping
1. **`App` & `MorningTriageModal` Integration**:
   - Adds a `showMorningTriage` state in `App` with a trigger button in the Triage/Tasks header and an indicator banner when today's entry in `memory.dailyCommitmentsLog[today]?.morningTriageCompleted` is false.
   - Completing Step 1–3 in `MorningTriageModal` saves `mustWinTaskIds` and `morningTriageCompleted: true` to `memory.dailyCommitmentsLog`, appends any new procrastination risk to `userProfile.procrastinationTriggers`, and updates local Notion task deadlines (`dueDate`) via `persistTasks` + optional Notion property patch.
2. **`CoachChat` & Unified Action Parsing**:
   - Clicking **Grab Active Tab** sends `{ type: 'GRAB_TAB_CONTEXT' }` to the service worker. In the service worker, if `_activeTabId` is missing, it falls back to `chrome.tabs.query({ active: true, currentWindow: true })` before executing `extractPageContext`.
   - `buildSystemPrompt` explicitly documents the `<coach_action>` XML schema (`upsert_memory_fact`, `set_must_win`, `friction_break`) so any model can emit structured actions.
   - On stream completion, `parseActions` from `action-parser` extracts both native tool calls and XML blocks (supporting both `type`/`payload` and legacy `tool`/`args` shapes), updates `memory` (`productRulesAndContext`, `teamAndStakeholders`, or `dailyCommitmentsLog`), and displays a non-intrusive badge showing what was saved to Memory Vault.
3. **`executeLLMRequest` & `pii-scrubber` Integration**:
   - Before dispatching messages and `systemPrompt` to `executeOpenAICompatibleRequest` or `executeAnthropicRequest`, `executeLLMRequest` checks `settings.strictWorkPrivacyMode`. When `true`, it runs `scrubPII()` on all outbound user messages and system context.
4. **`MemoryVault` Google Drive Backup & Restore**:
   - Reads `po_gdrive_client_id` from storage before invoking `{ type: 'GDRIVE_AUTH', clientId }`. If no `clientId` is configured, surfaces a clear inline prompt directing the user to enter their Google OAuth Client ID in Settings.
   - Properly unwraps `authRes.data.token` for `GDRIVE_UPLOAD` and unwraps `downloadRes.data` for `GDRIVE_DOWNLOAD`, validating the restored `POMemoryStore` schema and displaying a status banner (`✓ Backed up to Google Drive` / `✓ Restored from Google Drive` or specific error message).
5. **`MarkdownRenderer` & Design Polish**:
   - Replaces thick left borders on blockquotes with clean hairline borders and subtle surface contrast, applies `tabular-nums` to all numeric badges/timers, and formats static task metadata with clean typographic separators.
