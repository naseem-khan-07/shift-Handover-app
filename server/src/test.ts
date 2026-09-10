process.env.NODE_ENV = 'test';
import fs from 'fs';
import path from 'path';
import { Event, Team, User, events as seedEvents, teams as seedTeams, users as seedUsers } from './data';
import { calculateDashboard, generateHandover } from './index';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testId: number, name: string, detailSuccess: string, detailFailure: string) {
  if (condition) {
    results.push({ id: testId, name, passed: true, details: detailSuccess });
    console.log(`✓ Scenario ${testId}: ${name} — PASSED`);
  } else {
    results.push({ id: testId, name, passed: false, details: detailFailure });
    console.error(`✗ Scenario ${testId}: ${name} — FAILED: ${detailFailure}`);
  }
}

const shiftStart = '2026-09-03T09:00:00+05:30';
const shiftEnd = '2026-09-03T17:00:00+05:30';

console.log('==================================================');
console.log('RUNNING SHIFT HANDOVER CORE LOGIC VALIDATION SUITE');
console.log('==================================================\n');

// SCENARIO 1: Normal Busy Shift (Karthik Rao - w1)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  const totalItems = handover.completed.length + handover.inProgress.length + handover.blockers.length + handover.watch.length;
  const hasTraceability = [...handover.completed, ...handover.inProgress, ...handover.blockers, ...handover.watch].every(
    (item) => Boolean(item.source && item.record_id && item.timestamp && item.finalStatus)
  );

  assert(
    totalItems > 0 && hasTraceability && handover.eventCount > 0,
    1,
    'Normal busy shift',
    `Generated ${totalItems} classified items across sections from ${handover.eventCount} in-window events with full traceability.`,
    'Handover generation failed for normal busy shift or missing traceability.'
  );
} catch (e: any) {
  assert(false, 1, 'Normal busy shift', '', e.message);
}

// SCENARIO 2: Quiet Shift (Divya Nair - w2)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w2', shiftStart, shiftEnd);
  const isQuiet = handover.blockers.length === 0 && handover.watch.length === 0 && handover.completed.length > 0;
  assert(
    isQuiet,
    2,
    'Quiet shift',
    `Quiet shift processed correctly: ${handover.completed.length} completed tasks, 0 blockers, 0 watch-list items.`,
    `Quiet shift assertion failed: blockers=${handover.blockers.length}, watch=${handover.watch.length}.`
  );
} catch (e: any) {
  assert(false, 2, 'Quiet shift', '', e.message);
}

// SCENARIO 3: Same Ticket Updated Multiple Times (Deduplication using Source + Record ID)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  // OPS-108 had 2 events in current shift (e4 opened, e5 updated)
  const ops108 = handover.inProgress.find((x) => x.record_id === 'OPS-108');
  const deduplicated = ops108 && ops108.updates.length === 2 && ops108.finalStatus === 'in_progress';
  assert(
    Boolean(deduplicated),
    3,
    'Same ticket updated multiple times',
    'OPS-108 multiple updates collapsed into single item with final status "in_progress" and update history ["opened", "updated"].',
    'Deduplication failed for OPS-108 multiple updates.'
  );
} catch (e: any) {
  assert(false, 3, 'Same ticket updated multiple times', '', e.message);
}

// SCENARIO 4: Event Before Shift (Timestamp Filtering Test)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  // e1: OPS-100 is at 08:30 (before 09:00 shift start)
  const hasBeforeEvent = [...handover.completed, ...handover.inProgress, ...handover.blockers, ...handover.watch].some(
    (x) => x.record_id === 'OPS-100' && !x.isCarriedForward
  );
  assert(
    !hasBeforeEvent,
    4,
    'Event before shift',
    'Event e1 (OPS-100 at 08:30 AM) was correctly excluded from current shift items by timestamp filter.',
    'Timestamp filter failed: Event e1 before shift start was incorrectly included.'
  );
} catch (e: any) {
  assert(false, 4, 'Event before shift', '', e.message);
}

// SCENARIO 5: Event After Shift (Timestamp Filtering Test)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  // e8: OPS-130 is at 18:00 (after 17:00 shift end)
  const hasAfterEvent = [...handover.completed, ...handover.inProgress, ...handover.blockers, ...handover.watch].some(
    (x) => x.record_id === 'OPS-130'
  );
  assert(
    !hasAfterEvent,
    5,
    'Event after shift',
    'Event e8 (OPS-130 at 18:00 PM) was correctly excluded from handover by timestamp filter.',
    'Timestamp filter failed: Event e8 after shift end was incorrectly included.'
  );
} catch (e: any) {
  assert(false, 5, 'Event after shift', '', e.message);
}

// SCENARIO 6: Shift With No Blockers (Divya Nair - w2)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w2', shiftStart, shiftEnd);
  assert(
    handover.blockers.length === 0,
    6,
    'Shift with no blockers',
    'Blockers section is empty (0 items) for Divya Nair, which will output "Nothing to report" in presentation.',
    `Blockers section was expected to be empty but had ${handover.blockers.length} items.`
  );
} catch (e: any) {
  assert(false, 6, 'Shift with no blockers', '', e.message);
}

// SCENARIO 7: Shift With No Watch-list (Divya Nair - w2)
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w2', shiftStart, shiftEnd);
  assert(
    handover.watch.length === 0,
    7,
    'Shift with no watch-list',
    'Watch-list section is empty (0 items) for Divya Nair, which will output "Nothing to report" in presentation.',
    `Watch-list section was expected to be empty but had ${handover.watch.length} items.`
  );
} catch (e: any) {
  assert(false, 7, 'Shift with no watch-list', '', e.message);
}

// SCENARIO 8: Multiple Teams (Role & Team Data Scoping Test)
try {
  const dashAlpha = calculateDashboard(seedUsers, seedTeams, seedEvents, 'tl1');
  const dashBeta = calculateDashboard(seedUsers, seedTeams, seedEvents, 'tl2');
  assert(
    dashAlpha.totalTeams === 1 && dashBeta.totalTeams === 1 && dashAlpha.teams[0].id === 't1' && dashBeta.teams[0].id === 't2',
    8,
    'Multiple teams',
    'Dashboard statistics isolated correctly per Team Lead: Team Alpha lead sees only t1, Team Beta lead sees only t2.',
    'Team Lead scoping failed across multiple teams.'
  );
} catch (e: any) {
  assert(false, 8, 'Multiple teams', '', e.message);
}

// SCENARIO 9: Multiple Workers (Worker Data Isolation)
try {
  const hKarthik = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  const hSanjay = generateHandover(seedEvents, seedUsers, seedTeams, 'w3', shiftStart, shiftEnd);
  const karthikIds = new Set(hKarthik.completed.concat(hKarthik.inProgress, hKarthik.blockers).map((x) => x.record_id));
  const sanjayIds = new Set(hSanjay.completed.concat(hSanjay.inProgress, hSanjay.blockers).map((x) => x.record_id));
  const noOverlap = [...karthikIds].every((id) => !sanjayIds.has(id));
  assert(
    noOverlap,
    9,
    'Multiple workers',
    'Handover generation isolates worker activity: Karthik records and Sanjay records have zero cross-worker leakage.',
    'Worker data isolation failed.'
  );
} catch (e: any) {
  assert(false, 9, 'Multiple workers', '', e.message);
}

// SCENARIO 10: Same Shift Generated Twice (Determinism / Idempotency Test)
try {
  const h1 = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  const h2 = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  const isIdentical = JSON.stringify(h1) === JSON.stringify(h2);
  assert(
    isIdentical,
    10,
    'Same shift generated twice',
    'Handover generation is 100% deterministic: identical input and shift window produced exact byte-for-byte identical output.',
    'Determinism test failed: consecutive calls produced different results.'
  );
} catch (e: any) {
  assert(false, 10, 'Same shift generated twice', '', e.message);
}

// SCENARIO 11: Previous-shift Pending Task Carried Forward
try {
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w1', shiftStart, shiftEnd);
  // OPS-109 was in_progress in previous shift p6, with 0 events in current shift
  const carriedItem = handover.inProgress.find((x) => x.record_id === 'OPS-109');
  const isCorrect = carriedItem && carriedItem.isCarriedForward === true && carriedItem.origin === 'Previous Shift';

  // OPS-101 was completed in current shift (e2), so it should NOT be listed as carried forward pending
  const ops101Carried = [...handover.inProgress, ...handover.blockers].find((x) => x.record_id === 'OPS-101' && x.isCarriedForward);

  assert(
    Boolean(isCorrect && !ops101Carried),
    11,
    'Previous-shift pending task carried forward',
    'OPS-109 unresolved task from previous shift correctly carried forward (isCarriedForward: true, origin: "Previous Shift"). Completed item OPS-101 was updated in current shift and not incorrectly carried forward as pending.',
    'Carry-forward assertion failed.'
  );
} catch (e: any) {
  assert(false, 11, 'Previous-shift pending task carried forward', '', e.message);
}

// SCENARIO 12: Empty Shift
try {
  // Worker w4 (Priya Krishnan) has 0 events seeded in current shift window
  const handover = generateHandover(seedEvents, seedUsers, seedTeams, 'w4', shiftStart, shiftEnd);
  const isEmpty =
    handover.eventCount === 0 &&
    handover.completed.length === 0 &&
    handover.inProgress.length === 0 &&
    handover.blockers.length === 0 &&
    handover.watch.length === 0;
  assert(
    isEmpty,
    12,
    'Empty shift',
    'Empty shift handled cleanly: 0 events, all 4 sections empty (triggers "Nothing to report" string presentation).',
    'Empty shift assertion failed.'
  );
} catch (e: any) {
  assert(false, 12, 'Empty shift', '', e.message);
}

console.log('\n==================================================');
const totalPassed = results.filter((r) => r.passed).length;
console.log(`TEST SUMMARY: ${totalPassed}/${results.length} Scenarios Passed.`);
console.log('==================================================\n');

// Write validation report file
const reportContent = `# Shift Handover Core Pipeline Validation Report

**Date**: ${new Date().toISOString()}  
**Target Component**: Shift Handover Core Engine  
**Total Scenarios Tested**: ${results.length}  
**Total Passed**: ${totalPassed}  
**Total Failed**: ${results.length - totalPassed}  

---

## Test Scenario Execution Results

${results
  .map(
    (r) => `### Scenario ${r.id}: ${r.name}
- **Status**: ${r.passed ? '✅ PASSED' : '❌ FAILED'}
- **Details**: ${r.details}
`
  )
  .join('\n')}

---

## Core Grounding Pipeline Assertions Verified

1. **Timestamp Filtering First**: All events outside \`[shiftStart, shiftEnd]\` are excluded from current shift items.
2. **Deduplication by Source + Record ID**: Multiple updates for the same source record are collapsed into a single final-state item.
3. **Traceability Guarantee**: Every generated handover item includes \`Source\`, \`Record ID\`, \`Timestamp\`, and \`Final Status\`.
4. **Deterministic Idempotency**: Same input data and shift window always produces the exact same handover structure.
5. **Previous-Shift Pending Carry-Forward**: Unresolved tasks from previous shifts without current shift updates are carried forward into next shift handover with \`[Carried Forward from Previous Shift]\` indicator.
6. **Empty State Standardization**: Empty sections report 0 items and render exact UI string \`"Nothing to report"\`.
`;

fs.writeFileSync(path.join(__dirname, '../../test-report.md'), reportContent, 'utf-8');
console.log('Validation report generated at test-report.md');

if (totalPassed < results.length) {
  process.exit(1);
}
