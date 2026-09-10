# ShiftFlow — Grounded Shift Handover Management System

Full-stack React + Express + TypeScript application for deterministic, grounded shift handovers with dynamic role-based dashboards, previous-shift pending work carry-forward, professional PDF export, and an automated verification suite.

---

## Quick Start

### 1. Install & Run Application
```bash
npm install
npm run dev
```
- **Frontend App**: http://localhost:5173
- **Backend API**: http://localhost:4000/api/health

### 2. Run Automated Verification Suite
```bash
npm test
```
Executes all 12 core pipeline test scenarios and generates `test-report.md`.

---

## Architecture & Grounded Intelligence Pipeline

> [!IMPORTANT]
> **No LLM Required — 100% Deterministic & Auditability-First Architecture**  
> Shift handovers in mission-critical environments require zero hallucination, strict auditability, and complete traceability back to original source records (Jira tickets, incident logs, support escalations). The system's intelligence derives from deterministic rules, timestamp windowing, state progression tracking, and automated carry-forward analysis.

```
REAL SHIFT DATA
       ↓
TIMESTAMP FILTER FIRST
       ↓
DEDUPLICATION (Source + Record ID)
       ↓
FINAL STATE IDENTIFICATION
       ↓
CLASSIFICATION (Completed / In Progress / Blockers / Watch-list)
       ↓
PREVIOUS-SHIFT CARRY-FORWARD
       ↓
TRACEABILITY (Source, Record ID, Timestamp, Status, Origin)
       ↓
NEXT-SHIFT PRIORITY GENERATION
       ↓
HANDOVER & PDF EXPORT
```

### Key Pipeline Stages Explained
1. **Timestamp Filtering First**: Shift start/end times (`09:00 AM – 05:00 PM`) strictly filter eligible events. Events outside the selected shift window are excluded from current shift items.
2. **Deduplication**: Events are grouped by `Source + Record ID`. Multiple updates for a single ticket (e.g. `assigned` → `in_progress` → `completed`) are collapsed into a single item.
3. **Final State Identification**: The chronologically last status within the shift window dictates the final status of the record.
4. **Classification**: Records are classified into exactly four sections:
   - **COMPLETED**: Items resolved in the current shift.
   - **IN PROGRESS**: Active unresolved items without critical blocker status.
   - **BLOCKERS / ESCALATIONS**: Critical items, blocked incidents, or escalations requiring immediate attention.
   - **WATCH-LIST**: Items requiring ongoing observation.
5. **Previous-Shift Carry-Forward**: Unresolved items from previous shifts (`timestamp < shiftStart`) that received zero updates in the current shift are carried forward into the next shift handover with a `[Carried Forward from Previous Shift]` tag. If an unresolved ticket was updated in the current shift, its current shift state takes precedence.
6. **Traceability**: Every item preserves its `Source`, `Record ID`, `Timestamp`, `Final Status`, and `Origin`.
7. **Next-Shift Priorities**: Automatically derived from unresolved blockers, high-priority in-progress items, and watch-list records.
8. **Empty State Formatting**: Sections with zero items display exact string `"Nothing to report"`.

---

## 5 Major System Upgrades Implemented

### 1. Previous-Shift Pending Work Carry-Forward
- Automatically tracks unresolved work from prior shifts.
- Carries items forward with explicit `isCarriedForward: true` and `origin: 'Previous Shift'` attributes.
- Avoids duplicate entries if a ticket was updated in the current shift.

### 2. Dynamic Role-Based Dashboards
- Eliminates hardcoded statistics. All metrics dynamically computed via `/api/dashboard`:
  - **Manager**: Org-wide stats (total teams, leads, workers, active tasks, completed today, pending, blockers, watch-list) and per-team cards.
  - **Team Lead**: Metrics scoped strictly to assigned team workers and tasks.
  - **Worker**: Metrics scoped strictly to worker's own shift activities.

### 3. Comprehensive Verification & Test Suite
- Run `npm test` to validate all 12 test scenarios:
  1. Normal busy shift
  2. Quiet shift
  3. Same ticket updated multiple times
  4. Event before shift (timestamp filter)
  5. Event after shift (timestamp filter)
  6. Shift with no blockers ("Nothing to report")
  7. Shift with no watch-list ("Nothing to report")
  8. Multiple teams (data scoping)
  9. Multiple workers (data isolation)
  10. Same shift generated twice (determinism check)
  11. Previous-shift pending task carried forward
  12. Empty shift
- Automated report output saved to `test-report.md`.

### 4. Professional PDF Export
- Generates a clean, competition-ready PDF via `jsPDF`:
  - Header Banner & Metadata Table (Worker, Team, Team Lead, Shift Start, Shift End)
  - `NEXT-SHIFT SUMMARY` (Completed, Still Pending, Blockers/Escalations, Start With These)
  - `DETAILED HANDOVER` (Completed, In Progress, Blockers/Escalations, Watch-List)
  - `NEXT-SHIFT PRIORITIES`
  - Multi-page page-break protection and page numbering (`Page X of Y`).

### 5. Grounded Intelligence & Viva Readiness
- Full documentation of deterministic processing rules.
- Graceful database fallback: queries `MySQL`, but seamlessly falls back to in-memory datasets (`data.ts`) if MySQL is offline.

---

## Seeded Demo Accounts

- **Manager**: Rohan Mehta (`m1`)
- **Team Lead**: Arun Kumar (`tl1` - Team Alpha)
- **Worker (Normal busy shift + Carry Forward)**: Karthik Rao (`w1` - Team Alpha)
- **Worker (Quiet shift)**: Divya Nair (`w2` - Team Alpha)
- **Worker (Blocker scenario)**: Sanjay Menon (`w3` - Team Alpha)
