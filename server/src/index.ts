import express from 'express';
import cors from 'cors';
import { Event, Handover, HandoverItem, Team, User } from './data';
import { getEvents, getTeams, getUsers } from './db';

const app = express();
app.use(cors());
app.use(express.json());

export function validDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export function generateHandover(
  events: Event[],
  users: User[],
  teams: Team[],
  workerId: string,
  start: string,
  end: string
): Handover {
  const user = (id: string) => users.find((item) => item.id === id);
  const team = (id: string) => teams.find((item) => item.id === id);
  const worker = user(workerId);
  if (!worker || worker.role !== 'worker') throw new Error('Worker not found');
  const workerTeam = team(worker.team_id!);
  if (!workerTeam) throw new Error('Worker team not found');
  const lead = user(worker.team_lead_id!);
  if (!lead) throw new Error('Team lead not found');
  if (!validDate(start) || !validDate(end) || new Date(start) >= new Date(end)) {
    throw new Error('Invalid shift window');
  }

  const warnings: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const workerEvents = events.filter((event) => event.worker_id === workerId);

  // STEP 1: Current Shift Events (Timestamp Filter First)
  const relevant = workerEvents
    .filter((event) => {
      if (!validDate(event.timestamp)) {
        warnings.push(`Skipped ${event.source}/${event.record_id}: invalid timestamp`);
        return false;
      }
      const date = new Date(event.timestamp);
      return date >= startDate && date <= endDate;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // STEP 2: Previous Shift Unresolved Work Carry-Forward Analysis
  const priorEvents = workerEvents
    .filter((event) => {
      if (!validDate(event.timestamp)) return false;
      return new Date(event.timestamp) < startDate;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const priorGrouped = new Map<string, Event[]>();
  for (const ev of priorEvents) {
    const key = `${ev.source}|${ev.record_id}`;
    const group = priorGrouped.get(key) || [];
    group.push(ev);
    priorGrouped.set(key, group);
  }

  const currentKeys = new Set(relevant.map((ev) => `${ev.source}|${ev.record_id}`));

  const carriedForwardItems: HandoverItem[] = [];
  for (const [key, group] of priorGrouped.entries()) {
    const lastPriorEvent = group[group.length - 1];
    const isUnresolved = lastPriorEvent.status !== 'completed';
    // If ticket was unresolved in prior shift AND has 0 updates in current shift, carry forward!
    if (isUnresolved && !currentKeys.has(key)) {
      carriedForwardItems.push({
        source: lastPriorEvent.source,
        record_id: lastPriorEvent.record_id,
        timestamp: lastPriorEvent.timestamp,
        summary: lastPriorEvent.summary,
        priority: lastPriorEvent.priority,
        finalStatus: lastPriorEvent.status,
        updates: group.map((e) => e.update_type),
        isCarriedForward: true,
        origin: 'Previous Shift',
      });
    }
  }

  // STEP 3: Deduplication & Final State Identification for Current Shift
  const grouped = new Map<string, Event[]>();
  for (const event of relevant) {
    const key = `${event.source}|${event.record_id}`;
    const group = grouped.get(key) || [];
    group.push(event);
    grouped.set(key, group);
  }

  const currentItems: HandoverItem[] = [...grouped.values()].map((group) => {
    const finalEvent = group[group.length - 1];
    return {
      source: finalEvent.source,
      record_id: finalEvent.record_id,
      timestamp: finalEvent.timestamp,
      summary: finalEvent.summary,
      priority: finalEvent.priority,
      finalStatus: finalEvent.status,
      updates: group.map((event) => event.update_type),
      isCarriedForward: false,
    };
  });

  const allItems = [...currentItems, ...carriedForwardItems];

  // STEP 4: Classification into 4 exact sections
  const completed = allItems.filter((item) => item.finalStatus === 'completed');
  const blockers = allItems.filter(
    (item) =>
      item.finalStatus === 'blocked' ||
      item.finalStatus === 'escalated' ||
      (item.priority === 'critical' && item.finalStatus !== 'completed')
  );
  const watch = allItems.filter(
    (item) => item.finalStatus === 'watch' && item.finalStatus !== 'blocked' && item.finalStatus !== 'escalated'
  );
  const inProgress = allItems.filter(
    (item) =>
      (item.finalStatus === 'in_progress' || item.finalStatus === 'open') && item.priority !== 'critical'
  );

  // STEP 5: Priorities
  const priorities = [
    ...blockers,
    ...inProgress.filter((item) => item.priority === 'high'),
    ...inProgress.filter((item) => item.priority !== 'high'),
    ...watch,
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.record_id === item.record_id) === index);

  return {
    worker,
    team: workerTeam,
    lead,
    shiftStart: start,
    shiftEnd: end,
    completed,
    inProgress,
    blockers,
    watch,
    priorities,
    eventCount: relevant.length,
    duplicateUpdatesCollapsed: relevant.length - currentItems.length,
    carriedForwardCount: carriedForwardItems.length,
    warnings,
  };
}

export function calculateDashboard(
  users: User[],
  teams: Team[],
  events: Event[],
  userId?: string,
  start?: string,
  end?: string
) {
  const currentUser = users.find((u) => u.id === userId) || users[0];
  const defaultStart = start || '2026-09-03T09:00:00+05:30';
  const defaultEnd = end || '2026-09-03T17:00:00+05:30';

  const validEvents = events.filter((e) => validDate(e.timestamp));
  const currentShiftEvents = validEvents.filter((e) => {
    const d = new Date(e.timestamp);
    return d >= new Date(defaultStart) && d <= new Date(defaultEnd);
  });
  const previousShiftEvents = validEvents.filter((e) => new Date(e.timestamp) < new Date(defaultStart));

  let scopedUsers = users;
  let scopedTeams = teams;
  let scopedEvents = currentShiftEvents;

  if (currentUser.role === 'team_lead') {
    scopedTeams = teams.filter((t) => t.id === currentUser.team_id || t.lead_id === currentUser.id);
    const teamWorkerIds = new Set(scopedTeams.flatMap((t) => t.worker_ids));
    scopedUsers = users.filter((u) => u.id === currentUser.id || teamWorkerIds.has(u.id));
    scopedEvents = currentShiftEvents.filter((e) => teamWorkerIds.has(e.worker_id));
  } else if (currentUser.role === 'worker') {
    scopedUsers = [currentUser];
    scopedTeams = teams.filter((t) => t.id === currentUser.team_id);
    scopedEvents = currentShiftEvents.filter((e) => e.worker_id === currentUser.id);
  }

  const taskMap = new Map<string, Event>();
  const sortedScoped = [...scopedEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const e of sortedScoped) {
    taskMap.set(`${e.source}|${e.record_id}`, e);
  }
  const tasks = [...taskMap.values()];

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress' || t.status === 'open').length;
  const blockersCount = tasks.filter(
    (t) => t.status === 'blocked' || t.status === 'escalated' || (t.priority === 'critical' && t.status !== 'completed')
  ).length;
  const watchCount = tasks.filter((t) => t.status === 'watch').length;
  const totalActiveTasks = tasks.filter((t) => t.status !== 'completed').length;

  const teamBreakdowns = scopedTeams.map((t) => {
    const teamEvents = currentShiftEvents
      .filter((e) => t.worker_ids.includes(e.worker_id))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const teamTaskMap = new Map<string, Event>();
    for (const e of teamEvents) teamTaskMap.set(`${e.source}|${e.record_id}`, e);
    const teamTasks = [...teamTaskMap.values()];

    return {
      id: t.id,
      name: t.name,
      lead_id: t.lead_id,
      worker_ids: t.worker_ids,
      workerCount: t.worker_ids.length,
      activeCount: teamTasks.filter((x) => x.status !== 'completed').length,
      completedCount: teamTasks.filter((x) => x.status === 'completed').length,
      pendingCount: teamTasks.filter((x) => x.status === 'in_progress' || x.status === 'open').length,
      blockerCount: teamTasks.filter((x) => x.status === 'blocked' || x.status === 'escalated').length,
    };
  });

  return {
    role: currentUser.role,
    user: currentUser,
    totalTeams: scopedTeams.length,
    totalLeads: scopedUsers.filter((u) => u.role === 'team_lead').length,
    totalWorkers: scopedUsers.filter((u) => u.role === 'worker').length,
    totalActiveTasks,
    completedToday: completedCount,
    pendingTasks: inProgressCount,
    blockersCount,
    watchCount,
    currentShiftEventCount: scopedEvents.length,
    previousShiftEventCount: previousShiftEvents.length,
    teams: teamBreakdowns,
  };
}

app.get('/api/health', async (_, res) => {
  try {
    await getUsers();
    res.json({ ok: true, service: 'shiftflow', database: 'ready' });
  } catch {
    res.status(503).json({ ok: false, service: 'shiftflow', database: 'unavailable' });
  }
});

app.get('/api/users', async (_, res) => res.json(await getUsers()));
app.get('/api/teams', async (_, res) => res.json(await getTeams()));

app.get('/api/events', async (req, res) => {
  try {
    const events = await getEvents();
    const workerId = String(req.query.workerId || '');
    let output = workerId ? events.filter((event) => event.worker_id === workerId) : events;
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    if (start && end) {
      if (!validDate(start) || !validDate(end)) return res.status(400).json({ error: 'Invalid timestamp filter' });
      output = output.filter(
        (event) => new Date(event.timestamp) >= new Date(start) && new Date(event.timestamp) <= new Date(end)
      );
    }
    res.json(output.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to load events' });
  }
});

app.get('/api/handover', async (req, res) => {
  try {
    const [users, teams, events] = await Promise.all([getUsers(), getTeams(), getEvents()]);
    const workerId = String(req.query.workerId || '');
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    res.json(generateHandover(events, users, teams, workerId, start, end));
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to generate handover' });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const [users, teams, events] = await Promise.all([getUsers(), getTeams(), getEvents()]);
    const userId = String(req.query.userId || '');
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    res.json(calculateDashboard(users, teams, events, userId, start, end));
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to calculate dashboard stats' });
  }
});

app.get('/api/organization', async (_, res) => res.json({ users: await getUsers(), teams: await getTeams() }));

if (require.main === module) {
  app.listen(4000, () => console.log('ShiftFlow API listening on http://localhost:4000'));
}
