# BROWSER AGENT BRIDGE v1

**Artifact ID:** `canon_telega_browser_agent_bridge_v1`
**Status:** LOCKED
**Date:** 2026-04-30
**Author:** Canon System

---

## 1. Purpose

The Browser Agent Bridge establishes a canonical execution surface for agent-driven browser actions.
It extends TeleGPT beyond text/chat into browser interaction: tab management, DOM inspection, navigation, and user consent.

This document defines the foundation layer: types, policy, evidence, and routing skeleton.
Full Chrome Extension integration is deferred to v2.

---

## 2. Scope

### In Scope (v1)
- Type definitions for browser agent intents and evidence
- Policy layer: who can do what, when consent is required
- Evidence builder: immutable audit trail of browser actions
- Router skeleton: intent → plan execution path
- Logging surface: structured events for observability

### Out of Scope (v1)
- Chrome Extension implementation
- CDP (Chrome DevTools Protocol) integration
- Actual browser execution (click, navigate, extract)
- Multi-tab orchestration
- Session persistence across restarts

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  Telegram Surface (existing)                │
│  /browser <command>                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Browser Agent Router (v1)                  │
│  routeBrowserAgentIntent()                  │
│  → policy check → consent → plan            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Browser Agent Policy (v1)                  │
│  assertBrowserAgentAllowed()                │
│  → mode rules, consent requirements         │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Execution Runtime (v2: deferred)           │
│  → CDP / Chrome Extension / Playwright       │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Evidence Layer (v1)                        │
│  buildBrowserAgentEvidence()                │
│  → immutable audit record                   │
└─────────────────────────────────────────────┘
```

---

## 4. Types

### BrowserAgentSurface

Fixed surface identifier: `"browser"`

### BrowserAgentMode

- `public`: restricted to summary, highlight, search only
- `creator`: full access with consent requirements

### BrowserAgentEffect

- `confirmed`: action executed successfully with observable effect
- `failed`: action did not produce expected effect

### BrowserAgentIntent

Represents a parsed user request for browser action:

```
{
  id: string;
  userId: string;
  mode: "public" | "creator";
  command: string;
  target?: "active_tab" | "history" | "dom" | "browser_tab";
  requiresConsent: boolean;
}
```

### BrowserAgentEvidence

Immutable record of a browser agent action:

```
{
  intent: string;
  target: string;
  action: string;
  effect: "confirmed" | "failed";
  evidence: string;
  timestamp: string;
  surface: "browser";
}
```

---

## 5. Policy Rules

### 5.1 No Silent Execution

No browser action may execute without explicit intent detection and, where required, user consent.

### 5.2 Creator-Only for Provider/Web Actions

Only users with `mode === "creator"` may trigger:
- Navigation to URLs
- Tab management (open, close, switch)
- DOM modification
- Provider/web session interactions

### 5.3 Public Mode Restrictions

Public mode may only:
- Request summaries of active tab content
- Search within current page
- Highlight visible elements
- Read page title/URL (read-only)

### 5.4 Consent Requirements

Any action with the following requires explicit user consent:
- `click` on any element
- `navigate` to a new URL
- `close_tab`
- `open_tab`
- `dom_modify`

Consent is requested before execution and logged as evidence.

---

## 6. Evidence Schema

Every browser agent action produces an evidence record:

| Field     | Description                          |
|-----------|--------------------------------------|
| intent    | User command that triggered action   |
| target    | Target context (tab, DOM, history)   |
| action    | What was attempted                   |
| effect    | `confirmed` or `failed`              |
| evidence  | Proof string (DOM snapshot, URL, etc)|
| timestamp | ISO 8601 timestamp                   |
| surface   | Always `"browser"`                   |

Evidence is append-only. No deletion or modification.

---

## 7. Logging Surface

Structured logs for observability:

| Event                    | When                      |
|--------------------------|---------------------------|
| `intent_received`        | Router receives intent    |
| `policy_allowed`         | Policy check passes       |
| `policy_denied`          | Policy check fails        |
| `consent_required`       | Action needs user consent |
| `consent_granted`        | User grants consent       |
| `consent_denied`         | User denies consent       |
| `evidence_created`       | Evidence record written   |

---

## 8. Router Skeleton

v1 router returns a planned execution path. Actual execution is deferred to v2.

```
routeBrowserAgentIntent(intent) → {
  status: "planned",
  plan: [
    "resolve active browser context",
    "request consent if required",
    "execute action through bridge core",
    "confirm effect",
    "write evidence"
  ]
}
```

---

## 9. Dependencies

- None (v1 is standalone)
- v2 will depend on: Chrome Extension API, CDP, or Playwright

---

## 10. Future Work (v2)

- Chrome Extension implementation
- CDP integration for headless automation
- Multi-tab orchestration
- Session persistence
- DOM interaction primitives (click, type, scroll, extract)
- Visual evidence capture (screenshots, DOM diffs)
- Rate limiting and cooldown for browser actions

---

## 11. Canonical Reference

This document is the canonical reference for Browser Agent Bridge v1.
Any implementation must conform to these specifications.

**LOCKED** — modifications require canon amendment process.
