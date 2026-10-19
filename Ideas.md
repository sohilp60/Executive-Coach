# PO Executive Coach — Detailed Product Roadmap & Ideas Specification

This document provides the in-depth architectural specifications, user journeys, prompting heuristics, and technical implementation blueprints for the **PO Executive Coach**.

---

## 🗺️ Product Vision & Philosophy

Technical Product Managers and Product Owners operate in a high-entropy environment characterized by:
1. **Scope Creep & Stakeholder Pressure:** Constant ad-hoc demands from sales, executive leadership, and engineering.
2. **Ambiguity-Induced Procrastination:** High-friction, ambiguous specifications (e.g., complex data schemas, legacy migrations) lead to avoidance and lost focus.
3. **Execution-Strategy Disconnect:** High-level strategic roadmaps get lost in the weeds of daily Jira/Notion maintenance.

The **PO Executive Coach** bridges this gap as an **in-situ executive operating system**, providing ruthless prioritization, active pushback support, contextual document audits, and automated Notion execution.

---

## ⚡ The Shift: From Reactive Assistant to Proactive Executive Co-Pilot

### Why Reactive AI Fails Busy Product Leaders
Most AI tools sit passively, waiting for the user to open a panel, craft a prompt, and ask for help. In practice, this breaks down:
1. **When Under Stress, We Avoid:** When a PO is overwhelmed or procrastinating on an ambiguous task, they **do not** open a coaching app and ask to be held accountable. They avoid it.
2. **Context Switching Friction:** Having to manually click "Grab Tab", "Run Triage", or copy-paste text introduces enough friction that high-stress days revert to reactive chaos.
3. **The Executive Advantage:** A real human executive coach doesn't wait in their office for you to schedule a meeting. They notice when your calendar is overcrowded, they interrupt your avoidance, they pre-brief you 5 minutes before you pitch to leadership, and they guard your boundaries in real-time.

---

## 💡 Elaborated Feature Specifications

---

### Theme 0: Autonomous & Proactive Systems (Zero-Prompt Intelligence)
*Capabilities where the coach takes the initiative without waiting for user requests.*

---

#### 0.1 Pre-Emptive Morning Kickstart (8:55 AM Pre-Generation)
* **The Concept:** Zero-latency, zero-prompt morning preparation.
* **How It Works:**
  1. The background service worker wakes up 10 minutes before the PO's configured workday (e.g. 8:50 AM).
  2. Silently syncs Notion tasks and today's Google Calendar meetings.
  3. Formulates the day's **Top 2 Must-Wins**, flags the single biggest **Ambiguity Trap**, and drafts a **5-Minute Morning Kickstart**.
  4. When the PO launches their browser or unlocks their machine, an ambient desktop notification/badge appears:
     > *"🎯 Morning Battle Plan Ready: 2 Must-Wins locked in. 1 meeting with Sales flagged for scope defense."*
  5. The PO opens the side panel, and the morning briefing is **already rendered**—no loading spinner, no prompting required.

---

#### 0.2 Inbound Stakeholder Scope-Creep Sentinel (Slack Web & Gmail Ambient Pill)
* **The Concept:** Catching scope creep at the exact moment it arrives in your inbox or Slack feed.
* **How It Works:**
  1. A lightweight content script on `mail.google.com` and `app.slack.com` scans incoming messages from key stakeholders (matched against `memory.stakeholderProfiles`).
  2. Detects scope expansion patterns:
     * *"Can we quickly squeeze this into sprint N?"*
     * *"Client X won't sign unless we include custom reporting by Friday."*
     * *"Quick favor: can engineering take a look at this?"*
  3. Instead of forcing the user to highlight text and open the panel, an ambient, non-intrusive floating pill appears next to the message:
     `[🛡️ Coach: Scope Expansion Detected — Click to View 3 Pushback Options]`
  4. Clicking the pill renders 3 tailored responses (Diplomatic, Hard Boundary, Data-Grounded Trade-off) with a 1-click **"Copy to Reply"** button.

---

#### 0.3 Outbound Scope Commitment Guardrail (Live Typing Interceptor)
* **The Concept:** Protecting the PO from accidentally making verbal or written commitments to unestimated work under pressure.
* **How It Works:**
  1. Monitors text input in Slack, Gmail, and Jira comment textareas.
  2. Detects dangerous commitment phrasing:
     * *"We should be able to get that done by next week..."*
     * *"I'll see if the engineers can squeeze that in..."*
     * *"Sure, no problem, consider it done."*
  3. Underlines the risky sentence with a gentle amber highlight and surfaces a tooltip:
     > *"⚠️ Executive Guardrail: You are committing to unestimated scope without an engineering spike. Recommendation: 'We'll evaluate this in our next grooming session and confirm feasibility by [Date].' [Apply Suggested Fix]"*

---

#### 0.4 The "Avoidance Velocity" / Procrastination Index & Stale Task Interceptor
* **The Concept:** Mathematical detection of task avoidance before it turns into a missed deadline.
* **How It Works:**
  1. The coach computes an **Avoidance Index** for every active Notion task based on:
     * Times postponed or deadline shifted ($>2\times$).
     * Hours spent in "In Progress" with zero status updates ($>72$ hrs).
     * Semantic keyword overlap with the PO's stored `procrastinationTriggers` in Memory Vault (e.g. "mapping", "schema", "reconciliation", "API contracts", "compliance").
  2. When Avoidance Velocity crosses a threshold, the coach proactively intervenes during focus hours:
     > *"⚠️ Avoidance Trap Triggered: 'VCAF Mapping' has been postponed 3 times and matches your trigger 'ambiguous schemas'. Do NOT try to finish it today. Execute this 5-minute micro-step right now: [Open schema and identify 2 blocker fields]. Timer started."*

---

#### 0.5 High-Entropy Context Switching Alert & Focus Shield
* **The Concept:** Detecting "doom-hopping" across browser tabs and stepping in to restore deep work focus.
* **How It Works:**
  1. Background service worker monitors tab transition frequency.
  2. If the user visits $>20$ tabs in a 10-minute window without spending $>90$ seconds on any single document:
  3. Identifies cognitive overwhelm / attention fragmentation.
  4. Surfaces an ambient prompt:
     > *"🧠 Cognitive Fatigue Alert: 24 tab switches in 9 minutes. You are context-thrashing. Activate 25-minute Focus Shield on Must-Win #1?"*
  5. If accepted, the extension temporarily hides or groups secondary tabs, opens the top priority Notion task, and starts a 25-minute Pomodoro timer.

---

#### 0.6 Autonomous Strategy Pre-Generation for High-Priority Notion Tasks
* **The Concept:** Never having to wait for strategy generation—it's already written before you open the task.
* **How It Works:**
  1. During background sync, whenever a new task is detected in Notion with Priority `Urgent` or `High` that lacks a Coach Strategy:
  2. The background service worker automatically analyzes the task notes and acceptance criteria.
  3. Formulates the 3-point strategy and injects the `🎯 COACH STRATEGY` callout directly into the Notion page in the background.
  4. When the PO opens Notion on desktop or mobile, the strategy is already waiting for them at the top of the page.

---

#### 0.7 Executive Assertiveness & Passive Language Enhancer ("Executive Polish")
* **The Concept:** Automatically upgrading minimizing, unassertive communication into decisive executive presence.
* **How It Works:**
  1. Analyzes drafts in email and Slack for minimizing habits:
     * *"Just wanted to follow up and see if..."* $\rightarrow$ *"Following up on..."*
     * *"Sorry for the delay..."* $\rightarrow$ *"Thank you for your patience..."*
     * *"I think maybe we might want to consider..."* $\rightarrow$ *"Our recommendation is to..."*
     * *"Does that make sense?"* $\rightarrow$ *"Let me know if you have any questions before we proceed."*
  2. Surfaces a subtle, 1-click **"✨ Executive Polish"** chip directly inside the typing toolbar.

---

### Theme 1: Ambient Context & In-Browser Intelligence

---

#### 1.1 Context Menu "Pushback & Rejection Drafter"
* **User Problem:** A PO receives an urgent Slack/Email from a high-influence stakeholder requesting custom out-of-scope work for a deal. Writing a diplomatic yet unyielding refusal takes 15–20 minutes of mental energy, often leading to either yielding (scope creep) or procrastination.
* **User Workflow:**
  1. The PO highlights the stakeholder's message in Slack Web, Gmail, or Jira.
  2. Right-clicks $\rightarrow$ Selects **"PO Coach: Draft Firm Pushback"**.
  3. The extension side panel opens (or a compact modal overlay renders) displaying **3 Tailored Response Options**:
     * **Option A: Diplomatic & Alternative-Offering** (*"Here's what we can deliver in sprint N without slipping milestone X"*).
     * **Option B: Firm Scope Boundary** (*"This contradicts our agreed Q3 platform goal. Let's log it in the backlog for Q4 review"*).
     * **Option C: Data-Grounded Trade-off** (*"To take this in, we must drop item Y. Please confirm with leadership if you wish to trade off Y"*).
  4. The PO clicks **"Copy to Clipboard"** or **"Send to Slack"** (if integrated).
* **Prompting & Heuristic Strategy:**
  * System prompt pulls from `memory.stakeholderProfiles` (matching stakeholder by name or email domain).
  * Considers stakeholder influence level (`High`, `Medium`, `Low`) and communication preference (`data-first`, `relationship-first`).
  * Employs the "Yes, and..." or "No, unless..." framework to preserve political capital while protecting the backlog.
* **Technical Architecture:**
  * Background Service Worker creates context menu via `chrome.contextMenus.create({ id: 'po-coach-pushback', contexts: ['selection'], title: 'PO Coach: Draft Firm Pushback' })`.
  * `chrome.contextMenus.onClicked` catches selected text and forwards it to the side panel via `chrome.runtime.sendMessage`.
  * LLM streams the 3 options directly into the UI.

---

#### 1.2 PRD & Spec Critique Lens ("The Scope Cutter")
* **User Problem:** POs write PRDs that look comprehensive but conceal ambiguous edge cases, untestable acceptance criteria, or architectural debt that engineers later stall on.
* **User Workflow:**
  1. The PO navigates to a Notion PRD page, Confluence doc, or Google Doc.
  2. In the side panel or via a floating badge, clicks **"Audit Document for Scope Creep"**.
  3. The coach extracts the page DOM/text and returns an **Executive Spec Audit**:
     * **Scope Health Score (0–100):** Visual progress gauge based on clarity and bloat.
     * **Ambiguity Traps:** Identifies phrases like "support all standard formats", "smooth experience", "real-time updates" without latency specs.
     * **Ruthless Scope Cuts (The 80/20 Rule):** 2–3 features that should be stripped from V1 to ship 2 weeks earlier.
     * **INVEST Check:** Evaluates whether stories are Independent, Negotiable, Valuable, Estimable, Small, and Testable.
* **Technical Architecture:**
  * Reuses `src/content/dom-extractor.ts` injected via `chrome.scripting.executeScript`.
  * Chunks text into semantic sections (Problem Statement, User Personas, Requirements, Non-Goals).
  * Evaluates against `memory.productRules` (e.g., maximum latency constraints, unsupported technologies).

---

#### 1.3 Tab-Drift & Focus Drift Interceptor
* **User Problem:** When facing high-friction tasks (e.g. data mapping, architecture review), POs subconsciously open Reddit, YouTube, news, or low-priority email tabs—spending 45 minutes in unproductive avoidance.
* **User Workflow:**
  1. In the morning, the PO locks in 1–2 Must-Wins.
  2. If the user visits configured non-work sites or switches tabs rapidly without staying on Notion/Docs for $>10$ minutes during a focus block:
  3. The extension badge gently pulses orange/red, and a subtle toast notification appears:
     > *"Are we avoiding the VCAF Schema Mapping? What is the 5-minute micro-step you can take right now?"*
  4. Clicking the notification opens the **Friction Breaker** tab with the top Must-Win pre-loaded.
* **Technical Architecture:**
  * `chrome.tabs.onActivated` and `chrome.idle.onStateChanged` in service worker track active tab domain and focus duration.
  * Completely offline, local-only heuristic (zero URLs transmitted externally for privacy).
  * Strict snooze and customizable focus hours (e.g., 9:00 AM – 1:00 PM).

---

### Theme 2: Deep Notion Automation & Execution

---

#### 2.1 Actionable Sub-Task / Checklist Injection
* **User Problem:** Strategic advice in a Callout block is helpful, but still requires the PO to manually translate that advice into actionable task checkboxes inside Notion.
* **User Workflow:**
  1. In the Task Drawer, the PO clicks **"Generate Strategy & Checklist"**.
  2. The AI generates the 3-point strategy *and* 3–5 atomic 5-minute checkboxes.
  3. In Notion, the page is injected with:
     * The `🎯 COACH STRATEGY` Callout block.
     * Directly nested underneath, actual Notion `to_do` blocks:
       * `[ ] Checkbox 1: Open VCAF schema and verify account_id nullability`
       * `[ ] Checkbox 2: Ping Kshitij for upstream payload sample`
       * `[ ] Checkbox 3: Create delta mapping sheet with 3 core columns`
  4. The PO checks off boxes directly in Notion; when the side panel refreshes, sub-task progress is reflected in the task card.
* **Technical Implementation:**
  * Notion API payload appends `to_do` blocks:
    ```json
    {
      "object": "block",
      "type": "to_do",
      "to_do": {
        "rich_text": [{ "type": "text", "text": { "content": "Open VCAF schema and verify account_id nullability" } }],
        "checked": false
      }
    }
    ```
  * On regeneration, all previously generated `to_do` blocks tagged with metadata are deleted and replaced atomically.

---

#### 2.2 Bi-Directional Status & Blocker Syncing
* **User Problem:** Opening full Notion pages just to flip a task from "In Progress" to "Blocked" or "Done" is slow and distracts from core workflow.
* **User Workflow:**
  1. Directly on each card in the extension's **Task Drawer**, a status dropdown pill is displayed.
  2. The PO changes the status from `In Progress` $\rightarrow$ `Blocked`.
  3. A prompt asks: *"What's the blocker?"* $\rightarrow$ PO types *"Waiting on API specs from Payments team"*.
  4. The extension updates the Notion task status property via `PATCH /v1/pages/{pageId}` and appends a timestamped blocker comment block to the page body.
* **Technical Implementation:**
  * Background service worker handles `UPDATE_NOTION_TASK_STATUS` and `ADD_NOTION_COMMENT`.
  * Updates local task state instantly for optimistic UI response.

---

#### 2.3 Daily Must-Win Tagging in Notion
* **User Problem:** Morning triage commitments made in the coach are isolated from the shared team Notion board.
* **User Workflow:**
  1. During the 9:00 AM Morning Triage flow, the PO selects their 2 Must-Wins.
  2. The extension automatically adds a `🎯 Must-Win` tag (or sets a Notion checkbox property `Today's Must-Win`) on those pages.
  3. At end-of-day sweep (5:00 PM), uncompleted Must-Wins prompt a 30-second retro: *"Carry over to tomorrow or de-scope?"*
  4. Tags are cleared or archived at midnight.

---

### Theme 3: Stakeholder Dynamics & Executive Sparring

---

#### 3.1 Stakeholder Roleplay Simulator ("The Crucible")
* **User Problem:** Preparing to tell a senior VP or client that their deadline cannot be met is nerve-wracking. Without practice, POs over-commit under pressure.
* **User Workflow:**
  1. In the **Coach Chat**, the PO selects **"Sparring Mode"** and picks a stakeholder from their Memory Vault (e.g. *Ankit, Head of Sales*).
  2. The AI adopts Ankit's persona: aggressive, impatient, focused on Q4 quota, skeptical of engineering estimates.
  3. Ankit initiates: *"Hey, the enterprise client needs SSO and custom exports by Friday or we lose the \$250K deal. Make it happen."*
  4. The PO types their pushback.
  5. After a 3-turn exchange, the coach steps out of character and presents an **Executive Scorecard**:
     * **Boundary Firmness (A-F):** Did you hold the engineering scope line?
     * **Political Savvy (A-F):** Did you offer viable alternative paths or make the stakeholder feel heard?
     * **Coaching Tip:** *"You apologized twice. Never apologize for upholding quality and system reliability. Frame it as protecting their client's uptime."*
* **Technical Implementation:**
  * System prompt injects `memory.stakeholderProfiles[id]` with special simulation constraints:
    * *"Stay strictly in character. Push hard. Do not accept vague compromises. Only concede if the user offers a defensible milestone trade-off."*

---

#### 3.2 Autonomous Stakeholder Profile Enrichment
* **User Problem:** Keeping stakeholder notes up to date manually in the Memory Vault never happens.
* **User Workflow:**
  1. The PO pastes 1:1 meeting notes or Slack snippets into the chat.
  2. The action parser scans for stakeholder interaction dynamics and extracts:
     * Known pet peeves (e.g., *"Hates when dates slip without 48h notice"*).
     * Current quarterly KPIs.
     * Key allies or blockers.
  3. The coach displays an inline approval chip:
     > *"Updated Ankit's profile with: 'Prefers weekly async Loom videos over sync meetings'. Click to confirm."*
  4. One click updates `chrome.storage.local` memory store.

---

### Theme 4: Continuous Learning & Autonomous Memory Harvesting

---

#### 4.1 Autonomous Memory Harvesting
* **User Problem:** As the PO works, critical business context (e.g., "Legal requires GDPR audit by Oct 30", "Auth service cannot handle $>500$ RPS") gets dropped into chats and lost.
* **User Workflow:**
  1. Whenever the PO uses chat or grabs tab context, a secondary extraction pass inspects the text for durable facts:
     * **Product Rules:** Architectural guardrails, non-negotiables.
     * **Terminology/Jargon:** Team-specific acronyms and meanings.
     * **Procrastination Triggers:** *"I notice you postponed task X three times when it involved SQL queries."*
  2. Surfaces non-intrusive action chips: `[Add Rule: Auth limit 500 RPS]` `[Add Trigger: Raw SQL writing]`.
* **Technical Implementation:**
  * Standardized XML action block: `<coach_action>{"type": "upsert_memory_fact", "category": "product_rules", "content": "..."}</coach_action>`.
  * Uses `stripActionBlocks()` to keep chat UI clean while triggering state updates.

---

#### 4.2 Weekly Executive Retro & Momentum Analytics
* **User Problem:** POs rarely have time for meta-reflection, leading to recurring burnout patterns.
* **User Workflow:**
  1. Every Friday at 4:30 PM, the coach triggers the **Weekly Retro**:
     * **Must-Win Hit Rate:** Percentage of daily committed outcomes achieved.
     * **Friction Breakdown:** Which task categories took the longest to start.
     * **Executive Leverage Metric:** Ratio of high-leverage strategic work vs. reactive fire-fighting.
  2. Generates an exportable summary formatted for 1:1s with their Manager/VP of Product.

---

### Theme 5: Meeting & Calendar Pre-Flight Briefs

---

#### 5.1 Google Calendar Pre-Flight Briefs
* **User Problem:** POs jump from back-to-back meetings without 60 seconds to prepare, showing up reactive rather than steering the discussion.
* **User Workflow:**
  1. 5 minutes before any calendar event with external or executive attendees:
  2. Side panel surfaces a **Pre-Flight Brief Card**:
     * **The One Objective:** What must be decided before this meeting ends.
     * **2 Diagnostic Questions:** Sharp, high-leverage queries that expose hidden dependencies.
     * **Danger Zone / Defensible Boundary:** What NOT to commit to in this call.

---

### Theme 6: Commercial Jira Connector & Atlassian Marketplace App
*A commercial B2B SaaS application distributed on the Atlassian Marketplace.*

---

#### 6.1 The Commercial Rationale & Enterprise Market Opportunity
* **The Problem:** Enterprise product organizations don't use Notion for sprint tracking—they live in **Jira**. However, poor Jira hygiene is an expensive corporate plague:
  * Vague acceptance criteria cause 20–30% sprint churn and developer re-work.
  * Massive, ambiguous Epics stall in the backlog for months because POs procrastinate breaking them down.
  * Engineering managers and VP Products have zero visibility into sprint scope creep and zombie rollover tickets.
* **Why Companies Buy This:** Engineering VP/Directors will eagerly expense **\$3 to \$6 per user/month** if a tool demonstrably cuts sprint ambiguity, prevents mid-sprint scope creep, and speeds up Jira ticket specification.
* **Distribution Channel:** The **Atlassian Marketplace** provides instant global distribution to over 300,000 corporate Jira Cloud instances with built-in per-seat billing through Atlassian invoices.

---

#### 6.2 Core Product Capabilities

##### A. In-Jira Issue Panel ("The Executive Coach Glance")
* Injects a native panel into Jira Cloud issue views (`jira:issuePanel` via Atlassian Forge):
  1. **INVEST Spec Health Score (0–100):** Real-time gauge evaluating the ticket description and acceptance criteria against INVEST standards.
  2. **Automated Gherkin / Acceptance Criteria Generator:** 1-click generation of concrete `Given / When / Then` scenarios based on the user story.
  3. **5-Minute Technical Spike / Micro-Step Generator:** Breaks down high-friction, ambiguous tickets into 3 immediate unblocking steps for developers or POs.
  4. **Scope Creep & Risk Warning:** Flags missing edge cases (e.g. error states, rate limits, latency tolerances).

##### B. Sprint Board Scope Sentinel & "Zombie Ticket" Sweeper
* An interactive dashboard for Agile teams and Engineering Managers:
  1. **Zombie Ticket Detector:** Flags issues that have been carried over for $\ge 2$ sprints without completion, prompting ruthless de-scoping or archival.
  2. **Mid-Sprint Scope Creep Tracker:** Alerts the PO and Scrum Master whenever new story points are added to an active sprint without dropping an equivalent estimate.
  3. **Sprint Velocity Predictor:** Assesses sprint health based on the clarity scores of committed tickets.

##### C. Bi-Directional Sync with PO Executive Coach
* **OAuth 2.0 (3LO) Integration:** Connects the PO Executive Coach Chrome extension / Android app directly to Jira Cloud.
* **Private Battle Deck Import:** Import active sprint tickets into your personal daily 2 Must-Wins with 1 click.
* **In-Jira Strategy Injection:** Injects formatted Coach Strategies, architectural guardrails, and checklist micro-steps directly into Jira issue comments or a custom field.

---

#### 6.3 Technical Architecture & Enterprise Compliance (Atlassian Forge)
* **Atlassian Forge Framework:** Built using Forge (Atlassian's next-gen serverless runtime hosted inside Atlassian AWS infrastructure).
  * **Zero Egress / Zero Data Leakage:** Code runs inside Atlassian's security boundary, making SOC2, GDPR, and ISO-27001 compliance dramatically simpler.
* **Bring-Your-Own-Key (BYOK) for Enterprises:** Large enterprise customers can configure their own corporate Azure OpenAI, Google Cloud Vertex AI, or AWS Bedrock endpoints so proprietary code/ticket data never touches third-party AI keys.
* **Permission Scopes:** Strict minimal read/write scopes (`read:jira-work`, `write:jira-work`) without administrative or billing access.

---

#### 6.4 Monetization & Packaging Strategy

| Tier | Target Audience | Pricing | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Free / Starter** | Small startups & single squads (up to 10 users) | **\$0 / month** | Up to 15 ticket audits/month, basic Gherkin generation, Chrome extension sync. |
| **Standard** | Growing tech companies (11–100 users) | **\$4.00 / user / month** | Unlimited ticket audits, full In-Jira Coach Glance, Sprint Scope Sentinel, automated micro-steps. |
| **Enterprise** | Large corporate organizations (100+ users) | **\$7.50 / user / month** | Bring-Your-Own-Key (Azure OpenAI / Vertex AI), custom organizational product rules, audit logging, priority SLA. |

---

### Theme 7: Universal Executive Capture Engine (Teams, Outlook, Confluence & Jira → Notion)
*One-click conversion of fragmented corporate discussions into structured Notion execution.*

---

#### 7.1 The Problem & Product Rationale
* **The Reality of a PO:** Action items, scope discussions, and critical specifications are scattered across Microsoft Teams chat threads, Outlook email chains, Confluence product specs, and Jira engineering tickets.
* **The Failure Mode:** Manually reading, formatting, and copying these items into Notion takes 5–8 minutes per item. Consequently, POs either:
  1. Let commitments get buried and forgotten in chat scrolls.
  2. Keep messy, disconnected scratchpad notes that don't connect to their actual task management.
* **The Solution:** A unified **"Capture to Notion"** engine that can ingest context from any Teams conversation, Outlook email, Confluence doc, or Jira issue, distill it using the Executive Coach, and inject it as a **New Notion Task** or append it as fresh context to an **Existing Notion Task** (automatically prompting Coach Strategy regeneration).

---

#### 7.2 Source-Specific Adapters & What Gets Captured

##### 1. Microsoft Teams Adapter (`teams.microsoft.com`)
* **What It Reads:** Highlighted message thread, sender/stakeholder name, timestamp, @mentions, and channel context.
* **AI Distillation:** Strips conversational chit-chat, extracts the actual request or decision, maps the sender to a Stakeholder in Memory Vault, and drafts acceptance criteria.
* **Source Deep Link:** Captures the Teams web message URL (`https://teams.microsoft.com/l/message/...`).

##### 2. Microsoft Outlook Web Adapter (`outlook.office.com`, `outlook.live.com`)
* **What It Reads:** Subject line, sender/recipients, email body, date sent, and deep web link (`https://outlook.office.com/mail/id/...`).
* **AI Distillation:** Detects implicit deadlines (*"need this by Thursday"*), identifies who needs to be unblocked, and summarizes long back-and-forth email chains into a 3-bullet executive summary.

##### 3. Atlassian Confluence Adapter (`*.atlassian.net/wiki/*`)
* **What It Reads:** Page title, author, document headings, decision tables, action item macros (`ac:task-list`), and page URL.
* **AI Distillation:** Turns a 10-page spec into a crisp PO implementation task with clear scope boundaries and links back to the Confluence source of truth.

##### 4. Atlassian Jira Adapter (`*.atlassian.net/jira/*`)
* **What It Reads:** Issue key (e.g. `PROD-2410`), Summary, Description, Comments, Assignee/Reporter, Priority, and Status.
* **AI Distillation:** Bridges the Jira engineering story into the PO's personal executive workflow, extracting dependencies and unblocking steps.

---

#### 7.3 The Two Capture Destination Modes

```
      [Teams / Outlook / Confluence / Jira Context]
                            │
               ┌────────────▼────────────┐
               │   Executive AI Parser   │
               │  - Actionable Title     │
               │  - Scope Summary        │
               │  - Deadlines & Priority │
               │  - Source URL & Author  │
               └────────────┬────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   [Create New Notion Task]    [Append to Existing Task]
   - Creates Notion page       - Appends context block
   - Sets priority & date      - Automatically triggers
   - Injects Coach Strategy      Strategy Regeneration!
```

##### Mode A: "Create New Notion Task"
1. Opens an inline **Executive Capture Modal** in the side panel with pre-filled fields:
   * **Title:** Concise, action-oriented (e.g., *"Align with Sameer on VCAF Schema Delta"*).
   * **Status:** `To Do` or `Not Started`.
   * **Due Date:** Inferred from text (*"by Friday"*) or defaulted to tomorrow.
   * **Priority:** Inferred from stakeholder influence or urgency.
   * **Source Metadata:** Clickable link back to the exact Teams message, Outlook email, Confluence page, or Jira ticket.
   * **Page Body:** Formatted background notes and acceptance criteria.
2. Injects a newly generated **🎯 Coach Strategy** callout directly into the created Notion page.

##### Mode B: "Append to Existing Notion Task" (Context Enrichment)
1. The PO selects an existing Notion task from a searchable dropdown (e.g., *"VCAF Schema Mapping"*).
2. The extension appends the captured context as a timestamped block:
   ```markdown
   📎 SOURCE UPDATE from Outlook (Oct 19, 11:00 AM)
   From: Sameer (VP Engineering)
   Context: Upstream payload will not support account_id before Q4.
   ```
3. **Auto-Regenerates Coach Strategy:** Because new context was injected into the Notion page body, the extension automatically calls `handleGenerateStrategy(task, isRegenerate = true)`, updating the existing Coach Strategy with the new requirements!

---

#### 7.4 Architectural Strategy: Why Browser Content Scripts Win Over Graph API
* **The Enterprise IT Approval Wall:** Corporate IT departments almost universally block third-party Microsoft Graph API app registrations or require months of InfoSec approvals.
* **The Extension Superpower:** Because the PO is already authenticated in Teams Web, Outlook Web, Confluence, and Jira, our Chrome/Edge content script reads the active DOM directly with **zero enterprise admin consent required**.
* **Optional Phase 2 API Connectors:** For users who want headless background syncing without having the browser tabs open, optional Microsoft Graph (`Mail.Read`, `Chat.Read`) and Atlassian Cloud REST API OAuth connectors can be configured in Settings.

---

### Theme 8: Organizational Hierarchy & Team Structure Engine (Org-Aware Prioritization)
*Transforming flat stakeholder lists into a relational organizational graph that automatically detects names in tasks, learns reporting hierarchies, and prioritizes work originating from or blocking executive leaders.*

---

#### 8.1 The Core Problem: Why Flat Task Priority Fails Product Owners
In typical task management (Notion, Jira, Asana), priority is a flat manual tag: "High", "Medium", or "Low". In reality, corporate prioritization is deeply relational:
1. **The "Sponsor Gravity" Principle:** An ambiguous request from your VP of Product or CTO is *never* "Medium priority"—it has high organizational gravity and requires rapid, assertive framing before it derails upcoming sprints.
2. **Context Blindness:** A task like *"Review telemetry payload with Sahil"* has completely different execution urgency depending on whether Sahil is your Lead Architect (unblocking sprint progress) or an external vendor (can be batched async).
3. **Continuous Re-Mapping Friction:** Busy POs capture 10–20 items a day across Teams, Outlook, and Jira. Having to manually look up who requested what, what their title is, and how important they are creates cognitive fatigue.

---

#### 8.2 Hierarchical Data Architecture in Memory Vault
We extend the Memory Vault's `teamAndStakeholders` schema from flat metadata to a structured organizational hierarchy:

```typescript
export type OrgHierarchyTier =
  | 'executive_leadership' // C-Suite, VP Product, VP Engineering, Managing Director
  | 'direct_manager'       // Group PM, Director of Product (User's direct manager)
  | 'peer_lead'            // Peer POs, Engineering Managers, Tech Leads, Staff Architects
  | 'core_team_member'     // Senior/Mid Developers, QA Engineers, Product Designers
  | 'cross_functional'     // Sales Leads, Marketing, Legal, Compliance, Operations
  | 'external_partner';    // Enterprise Clients, Vendors, Contractors

export type ReportingRelationship =
  | 'reports_to_them'      // Senior in user's direct reporting chain
  | 'they_report_to_user'  // Direct report / mentee
  | 'peer'                 // Lateral collaborator
  | 'lateral_senior'       // Senior executive outside direct line (e.g. VP Sales)
  | 'external';            // Outside the company

export interface OrgMemberProfile {
  id: string;
  fullName: string;
  preferredName: string;            // e.g. "Sameer"
  email?: string;                   // e.g. "sameer@company.com"
  teamsHandle?: string;
  jiraUsername?: string;
  titleOrRole: string;              // e.g. "VP of Engineering"
  department: string;               // e.g. "Platform & Core Systems"
  hierarchyTier: OrgHierarchyTier;
  reportingRelationship: ReportingRelationship;
  priorityMultiplier: number;       // 1.5x for VP/Exec, 1.3x for Direct Manager, 1.0x for Peers
  communicationStyle: string;       // e.g. "BLUF (Bottom Line Up Front), no technical fluff"
  aliases: string[];                // ["Sameer", "Sameer G.", "VP Eng"]
  associatedTaskCount: number;      // Running count of captured tasks
  lastInteractedISO: string;
}
```

---

#### 8.3 Smart Name Detection & Extraction Pipeline
When the user triggers Universal Capture (via Floating Pill, Context Menu, Keyboard Shortcut, or Grab Active Tab):
1. **DOM Author & Metadata Matching:**
   * **Teams:** Extracts author from `[data-tid="threadBodyDisplayName"]`.
   * **Outlook:** Extracts from `[data-testid="SenderPersona"]` and email header.
   * **Jira:** Extracts reporter and assignee.
2. **NLP Named Entity Recognition (NER) in Task Content:**
   * A regex + lightweight LLM extraction pass identifies all person entities in the selected text or task description:
     * *"Align with Sameer on X4C payload schema before sprint 15"* $\rightarrow$ Detected Name: `Sameer`
     * *"Sahil mentioned telemetry is blocked on AWS KMS permissions"* $\rightarrow$ Detected Name: `Sahil`
3. **Memory Cross-Referencing:**
   * The detected names are compared against `memory.teamAndStakeholders`:
     * Exact match on `preferredName`, `fullName`, or `aliases`.
     * Fuzzy match on first name.

---

#### 8.4 Interactive Person Mapping Modal During Capture
If a detected person is **unrecognized** or **unmapped** in the Memory Vault, the Capture Modal surfaces a non-intrusive, 1-click **"Map Team Member"** card:

```
┌────────────────────────────────────────────────────────┐
│  👤 Team Member Detected: "Sameer"                     │
│  Map to your org structure to enable smart priority:   │
│                                                        │
│  [⭐ Executive / VP]  [👔 Direct Manager]  [🤝 Peer PO] │
│  [🛠️ Tech Lead]      [💻 Developer]       [💼 Sales]   │
│                                                        │
│  Role / Title: [ VP of Engineering                 ]   │
│  ☑ Auto-boost priority for tasks from Sameer           │
└────────────────────────────────────────────────────────┘
```

* **User Interaction:**
  1. If the PO taps **`[⭐ Executive / VP]`**:
     * Instantly sets `hierarchyTier = 'executive_leadership'` and `priorityMultiplier = 1.5`.
     * Automatically adjusts the current task's priority to `🔺 High`.
     * Saves Sameer to the Memory Vault permanently.
  2. If the person is already known:
     * A subtle chip is displayed: `[👤 Sameer (VP Eng) • 1.5x Priority Boost Active]`.
     * The PO doesn't have to click anything—it happens automatically!

---

#### 8.5 Persistent Memory Learning & Auto-Association
* **Persistent Association Graph:**
  * Once "Sameer" is mapped, the system records his email, Teams username, and name aliases in `chrome.storage.local`.
  * Every subsequent task captured that mentions "Sameer" or originates from his messages **automatically links to his profile**.
* **Task-to-Member Bidirectional Indexing:**
  * In Notion, the task can receive an `@Mention` or a custom `Stakeholder` property.
  * In the extension, the PO can filter tasks by stakeholder: *"Show me all pending tasks involving Sameer"*.

---

#### 8.6 Seniority-Weighted Prioritization & Coach Strategy Framing
Knowing the hierarchy unlocks tailored executive coaching that changes based on who is involved:

##### A. Seniority-Weighted Prioritization Algorithm
```
Effective_Task_Priority = Base_Urgency × Stakeholder_Priority_Multiplier
```
* **Tasks involving Executive Leadership (VP, C-Suite):**
  * Auto-promoted to `High` or `Critical`.
  * Highlighted with a distinct badge: `[⭐ Leadership Request: Sameer]`.
  * Surfaced at the top of the 9:00 AM Morning Triage Must-Wins list.

##### B. Adaptive Coach Strategy Framing Based on Hierarchy
When the PO generates a Coach Strategy, the LLM prompt adapts its advice according to the hierarchy tier:
* **When dealing with Executive Leadership (VP/CPO):**
  * **Angle of Attack:** Bottom-Line-Up-Front (BLUF), executive brevity, silence-as-consent framing. *Do NOT ask open-ended questions—frame decisions with clear recommendations.*
  * **First 5-Min Step:** Draft a 2-sentence forcing function with an EOD deadline.
* **When dealing with Tech Leads / Architects:**
  * **Angle of Attack:** Scope boundaries, schema edge cases, architectural trade-offs, SPIKE timeboxing.
  * **First 5-Min Step:** Define explicit non-goals to prevent gold-plating.
* **When dealing with Sales / Cross-Functional:**
  * **Angle of Attack:** Firm scope defense, trade-off anchoring, protecting sprint velocity.
  * **First 5-Min Step:** Offer 2 structured trade-off alternatives instead of a flat "no".

---

#### 8.7 Visual Org Chart & Stakeholder Radar in Memory Vault
* Inside the **Memory Vault** tab, replace the simple stakeholder list with an interactive **Org Radar / Hierarchy Tree**:
  * Visual tiers: **Leadership & Sponsors**, **Managers**, **Pillars & Peers**, **Engineering & Design**.
  * Shows active task load per member: e.g., *"Sameer: 3 open tasks (1 overdue)"*.
  * 1-click edit for titles, communication preferences, and influence levels.

---

## 📱 Mobile & Android App Architecture & Strategy

*Extending the PO Executive Coach into a native Android companion application.*

---

### 1. Architectural Blueprint (~80–85% Code Reuse)

The Android companion application will be structured as a cross-platform companion using **React Native / Expo** (or **Flutter**):

```
                        ┌────────────────────────────────────────┐
                        │        Common Core Logic (TS)          │
                        │  - LLM Multi-Provider Router & SSE     │
                        │  - Action Parser & XML Scrubber        │
                        │  - Notion REST Client & Chunker        │
                        │  - Memory Vault Schemas & PII Scrubber │
                        └───────────────────┬────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
     ┌─────────────────────────────┐                 ┌─────────────────────────────┐
     │  Desktop Chrome Extension   │                 │     Android Companion App   │
     │  - React 18 + Tailwind      │                 │  - React Native / Expo      │
     │  - chrome.storage.local     │                 │  - MMKV / Encrypted Storage │
     │  - chrome.scripting (DOM)   │                 │  - Android Intent Receivers │
     │  - MV3 Background Worker    │                 │  - WorkManager Background   │
     │  - Side Panel UI            │                 │  - Native Widgets & Glance  │
     └─────────────────────────────┘                 └─────────────────────────────┘
```

---

### 2. Feature Adaptation Matrix: Desktop vs. Android

| Feature Area | Desktop Chrome Extension | Android Companion App | Technical Implementation |
| :--- | :--- | :--- | :--- |
| **Context Extraction** | DOM extraction via `chrome.scripting.executeScript` | **Android Share Sheet (`ACTION_SEND`)** & Text Selection Action | Receives highlighted text from Slack, Gmail, or Chrome Mobile directly into Coach input. |
| **Daily Scheduling** | MV3 `chrome.alarms` (subject to browser open state) | **Android `WorkManager` & Exact `AlarmManager`** | 100% guaranteed delivery of 9:00 AM Triage & 1:00 PM Drift checks even if phone was sleeping. |
| **Urgent Alerts** | Extension Icon Badge + System Notifications | **Interactive Push Notifications (`RemoteInput`)** | Reply with your Must-Win directly inside the notification shade without unlocking/opening the app. |
| **Execution Surface** | Chrome Side Panel (docked alongside tabs) | **Full Screen Dashboard + Bottom Sheet Drawer** | Optimized for one-handed mobile navigation. |
| **Micro-Steps** | Textual 5-min timer in side panel | **Floating Timer Overlay / Picture-in-Picture** | 5-minute countdown floating over Notion or Google Docs apps. |

---

### 3. Mobile "Superpowers" Unique to Android

1. **Hands-Free Voice Coaching (The Walking 1:1):**
   * Uses the **Gemini Live API** or on-device speech recognition to have a natural spoken dialogue during morning walks or commutes.
   * *Example:* *"Coach, I'm heading into the sprint review and Engineering is 3 days behind on auth. How do I frame this to sales?"* $\rightarrow$ Coach speaks back a concise 30-second framing.
2. **Interactive Home Screen Widgets (Glance / RemoteViews):**
   * **4x2 "Executive Command" Widget:**
     * Displays Today's 1–2 Must-Wins with clickable checkboxes.
     * Tap **"Break Friction"** to open a quick voice input.
     * Tap **"Quick Capture"** to dictate a note to Memory Vault.
3. **Lock Screen Quick Actions:**
   * Notification prompts at 9:00 AM with action buttons: `[VCAF Mapping]` `[PRD Review]` `[Custom...]` for 1-tap commitment.

---

### 4. Tech Stack Evaluation

| Technology | Code Reuse | Native OS Integration | Dev Velocity | Architectural Fit |
| :--- | :--- | :--- | :--- | :--- |
| **React Native / Expo** | **~85%** | Excellent (Native modules for Intents, Notifications, Widgets) | Fast (1–2 weeks for MVP) | **Top Recommendation:** Direct reuse of TypeScript schemas, LLM adapters, and Notion logic. |
| **Flutter (Dart)** | **~30%** | Outstanding (Uncompromised 120 FPS, native Android widget support) | Medium (3–4 weeks) | **Strong Alternative:** If high-fidelity animations and desktop/iOS expansion is prioritized. |
| **Capacitor / PWA** | **~95%** | Fair (WebView container, limited widget and background reliability) | Instant (2–3 days) | **PoC Only:** Too restricted for native Android intents and background execution. |

---

### 5. Phased Android Implementation Plan

* **Milestone 1: Core Port (Week 1–2)**
  * Initialize Expo project with TypeScript and NativeWind (Tailwind for React Native).
  * Import `schema.ts`, `router.ts`, `notion-client.ts`, and `action-parser.ts`.
  * Port Task Drawer, Chat, and Memory Vault screens.
* **Milestone 2: Android System Integration (Week 3)**
  * Implement Android Share Sheet intent filter (`expo-sharing` / native Intent Handler).
  * Configure `WorkManager` for rock-solid 9 AM / 1 PM / 5 PM notification triggers.
  * Implement inline notification replies (`RemoteInput`).
* **Milestone 3: Native Widgets & Ambient Features (Week 4)**
  * Build Android Home Screen Widget for Must-Wins.
  * Integrate Speech-to-Text and Gemini Live audio for commute sparring.

---

## 📊 Consolidated Priority Matrix

| Priority | Initiative | Proactive / Reactive | Complexity | Strategic Impact | Target Surface |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P1** | **Universal Executive Capture (Teams, Outlook, Confluence, Jira → Notion)** | Both | Medium | High | Extension |
| **P1** | **Team Hierarchy & Org-Aware Prioritization (Smart Name Mapping)** | **Both** | Medium | Very High | Extension & Mobile |
| **P1** | **Native Executive Task Engine (Local-First)** | Reactive | Low | High | Extension & Mobile |
| **P1** | **Checklist / Sub-Task Injection into Notion** | Reactive | Low | High | Extension |
| **P1** | **Pre-Emptive Morning Kickstart (8:55 AM Pre-Gen)** | **Proactive** | Low | High | Extension & Mobile |
| **P1** | **Inbound Scope-Creep Sentinel (Slack/Gmail Web)** | **Proactive** | Medium | High | Extension |
| **P1** | **Context Menu Pushback Drafter** | Reactive | Low | High | Extension |
| **P2** | **Commercial Jira Marketplace App (Atlassian Forge)** | **Commercial B2B** | Medium | Very High | Jira Cloud & Extension |
| **P2** | **Jira Cloud Connector (OAuth 3LO Extension Sync)** | Reactive | Medium | High | Extension & Mobile |
| **P2** | **"Avoidance Velocity" / Procrastination Interceptor** | **Proactive** | Medium | High | Extension & Mobile |
| **P2** | **Autonomous Strategy Pre-Gen (High-Priority Tasks)** | **Proactive** | Low | High | Extension & Background |
| **P2** | **Outbound Scope Commitment Guardrail** | **Proactive** | Medium | High | Extension |
| **P2** | **Executive Assertiveness Polish ("Executive Polish")** | **Proactive** | Low | Medium | Extension |
| **P2** | **Stakeholder Roleplay Simulator ("The Crucible")** | Reactive | Medium | High | Extension & Mobile |
| **P2** | **Autonomous Memory Harvesting** | **Proactive** | Medium | High | Extension & Mobile |
| **P2** | **Android App Prototype (Core Companion)** | Both | Medium | High | Android Mobile |
| **P3** | **PRD & Spec Critique Lens ("Scope Cutter")** | Both | Medium | Medium | Extension |
| **P3** | **High-Entropy Context Switching Alert & Focus Shield** | **Proactive** | Medium | Medium | Extension |
| **P3** | **Interactive Android Home Screen Widget** | **Proactive** | Medium | High | Android Mobile |
| **P3** | **Google Calendar Pre-Flight Briefs** | **Proactive** | High | Medium | Extension & Mobile |
| **P4** | **Voice Mode / Commute Sparring (Gemini Live)** | Reactive | High | High | Android Mobile |
| **P4** | **Weekly Executive Retro & Momentum Analytics** | **Proactive** | Low | Medium | Extension & Mobile |

