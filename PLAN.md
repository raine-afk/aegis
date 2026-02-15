# AEGIS — Agent Enhancement & Governance Intelligence System

> "The senior engineer that watches over your coding agents."

**Fork of:** [anomalyco/opencode](https://github.com/anomalyco/opencode)
**Purpose:** Hackanova 5.0 (March 13-14, 2026) — Agentic AI hackathon at TCET Mumbai

---

## What is Aegis?

Aegis is a fork of OpenCode that adds a **supervisor layer** natively into the coding agent's loop. Instead of watching file changes externally, the supervisor:

1. **Lives inside the agent harness** — intercepts tool calls before execution
2. **Learns codebase patterns** — from git history, conventions, architecture
3. **Reviews changes in real-time** — every file write, edit, patch goes through review
4. **Intervenes when needed** — injects guidance, blocks dangerous changes, suggests fixes
5. **Shows reasoning in a meta-panel** — TUI shows supervisor's analysis alongside agent activity

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                   AEGIS TUI                 │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │ Agent Panel   │    │ Supervisor Panel  │  │
│  │ (normal OC)   │    │ (meta-reasoning)  │  │
│  └──────────────┘    └───────────────────┘  │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │   Session Processor   │
        │   (agent loop)        │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │   Supervisor Hook     │  ← NEW: intercepts tool results
        │   (pre-write review)  │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │   Pattern Memory      │  ← NEW: learned codebase patterns
        │   (SQLite store)      │
        └───────────────────────┘
```

### Key Integration Points in OpenCode

1. **`src/session/processor.ts`** — The agent loop. Tool calls flow through here. We add a supervisor hook that reviews tool results (file writes/edits) before they're committed.

2. **`src/agent/agent.ts`** — Agent definitions. We add a `supervisor` agent type that has its own model + prompt for code review.

3. **`src/tool/registry.ts`** — Tool registration. We wrap write/edit/patch tools with supervisor middleware.

4. **`src/session/system.ts`** — System prompts. We inject supervisor context (learned patterns) into the agent's system prompt.

5. **TUI (packages/ui)** — We add a supervisor panel showing real-time analysis.

---

## Implementation Plan (Phased TODOs)

### Phase 1: Pattern Memory Store
**Goal:** SQLite-backed store that learns and retrieves codebase patterns.

- [ ] Create `src/supervisor/` directory
- [ ] Create `src/supervisor/store.ts` — PatternStore class using OpenCode's existing SQLite infrastructure
  - Schema: patterns table (id, project, pattern_type, pattern_value, confidence, examples, source_commit, created_at)
  - Methods: addPattern, getPatterns, getPatternsByType, clearProject
- [ ] Create `src/supervisor/extractor.ts` — Extract patterns from codebase
  - Scan for: naming conventions, import style, error handling patterns, file structure
  - Read .eslintrc, .prettierrc, tsconfig for convention signals
  - Parse recent git commits for architectural decisions
- [ ] Create `src/supervisor/index.ts` — Export namespace

### Phase 2: Supervisor Analysis Engine
**Goal:** Code review engine that checks changes against learned patterns.

- [ ] Create `src/supervisor/analyzer.ts` — Core analysis engine
  - analyzeCode(content, filePath, patterns) → Finding[]
  - Security checks: hardcoded secrets, SQL injection, eval(), unsafe patterns
  - Convention checks: naming, import style, formatting consistency
  - Quality checks: deep nesting, large functions, any types, missing error handling
- [ ] Create `src/supervisor/types.ts` — Shared types (Finding, Severity, PatternType)
- [ ] Add TF-IDF based semantic similarity (reuse from meta-supervisor)
  - Detect code duplication across codebase
  - Flag inconsistent patterns vs similar code

### Phase 3: Tool Interception Middleware
**Goal:** Wrap OpenCode's file-writing tools so every change goes through supervisor review.

- [ ] Create `src/supervisor/middleware.ts` — Tool wrapper
  - Wraps: write, edit, multiedit, apply_patch tools
  - Before a tool executes: run analyzer on the proposed content
  - If critical findings: block execution, inject findings as assistant message
  - If warnings: allow execution but log findings to supervisor panel
- [ ] Modify `src/tool/registry.ts` — Apply middleware to relevant tools
  - Add supervisor wrapper around write/edit tools when supervisor is enabled
- [ ] Create `src/supervisor/intervention.ts` — Intervention logic
  - generateFixPrompt(findings) → string to inject into agent context
  - Severity-based decisions: critical=block, warning=warn, info=log

### Phase 4: Supervisor Agent Type
**Goal:** Add a "supervisor" agent definition that uses its own model for review.

- [ ] Add supervisor agent in `src/agent/agent.ts`
  - Name: "supervisor"
  - Mode: background/passive (doesn't take user input directly)
  - Model: configurable (default: smaller/faster model for quick review)
  - Prompt: code review specialist prompt
- [ ] Create `src/supervisor/prompt.txt` — Supervisor system prompt
  - Role: senior code reviewer
  - Context: project patterns, conventions, recent decisions
  - Output format: structured JSON findings
- [ ] Wire supervisor agent into session processor
  - On tool completion (file write/edit): spawn quick supervisor review
  - Feed findings back into agent context if issues found

### Phase 5: TUI Supervisor Panel
**Goal:** Show supervisor activity in the OpenCode TUI.

- [ ] Study `packages/ui/` structure for TUI components
- [ ] Add supervisor panel component
  - Shows: current analysis status, recent findings, pattern count
  - Color-coded severity: red=critical, yellow=warning, blue=info
  - Expandable finding details with suggestions
- [ ] Add supervisor status to header bar
  - Icon + finding count in the status area
- [ ] Wire bus events for supervisor → TUI communication
  - New bus events: supervisor.finding, supervisor.status, supervisor.intervention

### Phase 6: Learn Command & Integration
**Goal:** CLI command to learn patterns and end-to-end integration.

- [ ] Add `aegis learn <path>` CLI command
  - Triggers pattern extraction on a codebase
  - Stores patterns in SQLite
  - Shows summary of learned patterns
- [ ] Add config options in opencode config
  - `supervisor.enabled: boolean`
  - `supervisor.model: string` (model for supervisor agent)
  - `supervisor.strictness: "strict" | "moderate" | "lenient"`
  - `supervisor.autoLearn: boolean` (learn patterns on first run)
- [ ] End-to-end test: start aegis → agent codes → supervisor catches issues → agent corrects

---

## Demo Flow (Hackathon)

1. `aegis learn ./my-project` — learns 50+ patterns from codebase
2. User starts aegis, asks agent: "Add user authentication"
3. Agent starts writing auth code
4. **Supervisor panel lights up:**
   - "⚠️ Hardcoded password detected in auth-service.ts"
   - "⚠️ File 'AuthService.ts' violates kebab-case convention"
   - "🔴 SQL injection risk in user query"
5. Supervisor injects fix guidance into agent context
6. Agent self-corrects without human intervention
7. Show pattern memory: "Aegis learned 47 patterns from this codebase"

---

## Tech Stack

- **Runtime:** Bun
- **Agent Framework:** OpenCode (forked)
- **Pattern Storage:** SQLite (OpenCode's existing drizzle-orm setup)
- **Embeddings:** TF-IDF (pure TypeScript, no external deps)
- **TUI:** Ink (OpenCode's existing React-based TUI)
- **LLM:** Any provider (OpenCode supports all major providers)

---

## File Structure (New Files)

```
packages/opencode/src/supervisor/
├── index.ts           # Namespace exports
├── types.ts           # Finding, Severity, PatternType types
├── store.ts           # SQLite pattern memory
├── extractor.ts       # Pattern extraction from codebase
├── analyzer.ts        # Code analysis engine
├── middleware.ts       # Tool interception wrapper
├── intervention.ts    # Fix prompt generation
├── prompt.txt         # Supervisor agent system prompt
└── semantic.ts        # TF-IDF embeddings for similarity
```
