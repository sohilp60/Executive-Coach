# Master Project Blueprint: Senior PO Executive Coach (Edge Extension MV3)

> **Instructions for Google Antigravity / Cursor:** This document is the single-source-of-truth PRD and technical implementation specification for building a Chromium/Edge Manifest V3 Side-Panel Extension. Read this file completely, follow the exact folder structure, implement all 10 anti-pattern safeguards, and generate the complete working codebase.

---

## 1. The 10 Critical Pitfalls to Avoid (Strict Architectural Rules)

1. **No Service Worker Global State:** Never store chats or active data in global variables inside `background.ts`. Edge terminates service workers after 30 seconds of inactivity. Persist all state immediately to `chrome.storage.local`.
2. **Async Message Port Closing:** Never put `async` directly on `chrome.runtime.onMessage.addListener`. Return `true` explicitly and handle promises via an inner IIFE to prevent Chromium from closing the message port prematurely.
3. **Side Panel Persistence Desync:** Side panels do not reload when switching active tabs. Listen to `chrome.tabs.onActivated` and `chrome.tabs.onUpdated` to track active tab changes in real time.
4. **Edge OAuth Incompatibility:** Never use `chrome.identity.getAuthToken()` for Google Drive sync. It fails in Microsoft Edge. Use `chrome.identity.launchWebAuthFlow()` with PKCE and manage tokens manually.
5. **Google Drive Multipart Malformation:** Uploading `memory.json` to Google Drive requires strict RFC 2387 `multipart/related` headers or a 2-step create-then-patch flow (`/upload/drive/v3/files/{fileId}?uploadType=media`).
6. **Notion API & CORS:** Route all Notion calls through the Service Worker (`https://api.notion.com/*` in `host_permissions`) and explicitly set `Notion-Version: 2022-06-28`.
7. **Enterprise SPA DOM Extraction:** Never scrape SPAs (Jira, Confluence, Teams, Outlook) automatically on page load. Execute scoped DOM extractors *on-demand* via `chrome.scripting.executeScript` when the user clicks "Grab Active Tab".
8. **Anthropic Browser CORS:** Direct browser calls to Anthropic's API require the `"anthropic-dangerous-direct-browser-access": "true"` header.
9. **Free-Tier Tool-Calling Fallbacks:** Many free-tier models on OpenRouter or smaller Groq models fail native tool-calling. Implement dual-mode parsing supporting both native `tool_calls` and hidden `<coach_action>{...}</coach_action>` XML blocks.
10. **Service Worker Streaming Limits:** Do not stream LLM SSE responses inside the background service worker. Execute LLM `fetch()` calls directly from the **Side Panel React context** where streams can render cleanly without service worker time limits.

---

## 2. Project Folder Structure

```text
po-executive-coach/
├── manifest.json
├── vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── alarm-scheduler.ts
│   │   └── badge-manager.ts
│   ├── content/
│   │   ├── dom-extractor.ts
│   │   └── selection-listener.ts
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── CoachChat.tsx
│   │       ├── MorningTriageModal.tsx
│   │       ├── FrictionBreaker.tsx
│   │       ├── TaskDrawer.tsx
│   │       ├── MemoryVault.tsx
│   │       └── ProviderSettings.tsx
│   ├── core/
│   │   ├── llm/
│   │   │   ├── router.ts
│   │   │   ├── openai-adapter.ts
│   │   │   ├── anthropic-adapter.ts
│   │   │   ├── action-parser.ts
│   │   │   └── prompts.ts
│   │   ├── storage/
│   │   │   ├── local-cache.ts
│   │   │   ├── notion-client.ts
│   │   │   └── gdrive-sync.ts
│   │   └── privacy/
│   │       └── pii-scrubber.ts
│   └── types/
│       └── schema.ts