import express from 'express';
import cors from 'cors';
import { Event } from './data';
import { getEvents, getTeams, getUsers } from './db';

const app = express();
app.use(cors());
app.use(express.json());

function validDate(value: string) { return !Number.isNaN(new Date(value).getTime()); }

async function generate(workerId: string, start: string, end: string) {
  const [users, teams, events] = await Promise.all([getUsers(), getTeams(), getEvents()]);
  const user = (id: string) => users.find((item) => item.id === id);
  const team = (id: string) => teams.find((item) => item.id === id);
  const worker = user(workerId);
  if (!worker || worker.role !== 'worker') throw new Error('Worker not found');
  const workerTeam = team(worker.team_id!);
  if (!workerTeam) throw new Error('Worker team not found');
  const lead = user(worker.team_lead_id!);
  if (!lead) throw new Error('Team lead not found');
  if (!validDate(start) || !validDate(end) || new Date(start) >= new Date(end)) throw new Error('Invalid shift window');

  const warnings: string[] = [];
  const relevant = events.filter((event) => event.worker_id === workerId).filter((event) => {
    if (!validDate(event.timestamp)) {
      warnings.push(`Skipped ${event.source}/${event.record_id}: invalid timestamp`);
      return false;
    }
    const date = new Date(event.timestamp);
    return date >= new Date(start) && date <= new Date(end);
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const grouped = new Map<string, Event[]>();
  for (const event of relevant) {
    const key = `${event.source}|${event.record_id}`;
    const group = grouped.get(key) || [];
    group.push(event);
    grouped.set(key, group);
  }
  const items = [...grouped.values()].map((group) => {
    const finalEvent = group[group.length - 1];
    return { source: finalEvent.source, record_id: finalEvent.record_id, timestamp: finalEvent.timestamp, summary: finalEvent.summary, priority: finalEvent.priority, finalStatus: finalEvent.status, updates: group.map((event) => event.update_type) };
  });
  const completed = items.filter((item) => item.finalStatus === 'completed');
  const blockers = items.filter((item) => item.finalStatus === 'blocked' || item.finalStatus === 'escalated' || (item.priority === 'critical' && item.finalStatus !== 'completed'));
  const watch = items.filter((item) => item.finalStatus === 'watch');
  const inProgress = items.filter((item) => item.finalStatus === 'in_progress' || item.finalStatus === 'open');
  const priorities = [...blockers, ...inProgress.filter((item) => item.priority === 'high'), ...inProgress.filter((item) => item.priority !== 'high'), ...watch].filter((item, index, all) => all.findIndex((candidate) => candidate.record_id === item.record_id) === index);
  return { worker, team: workerTeam, lead, shiftStart: start, shiftEnd: end, completed, inProgress, blockers, watch, priorities, eventCount: relevant.length, duplicateUpdatesCollapsed: relevant.length - items.length, warnings };
}

app.get('/api/health', async (_, res) => {
  try { await getUsers(); res.json({ ok: true, service: 'shiftflow', database: 'mysql' }); }
  catch { res.status(503).json({ ok: false, service: 'shiftflow', database: 'unavailable' }); }
});
app.get('/api/users', async (_, res) => res.json(await getUsers()));
app.get('/api/teams', async (_, res) => res.json(await getTeams()));
app.get('/api/events', async (req, res) => {
  try {
    const events = await getEvents();
    const workerId = String(req.query.workerId || '');
    let output = events.filter((event) => event.worker_id === workerId);
    const start = String(req.query.start || '');
    const end = String(req.query.end || '');
    if (start && end) {
      if (!validDate(start) || !validDate(end)) return res.status(400).json({ error: 'Invalid timestamp filter' });
      output = output.filter((event) => new Date(event.timestamp) >= new Date(start) && new Date(event.timestamp) <= new Date(end));
    }
    res.json(output.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  } catch (error: any) { res.status(500).json({ error: error.message || 'Unable to load events' }); }
});
app.get('/api/handover', async (req, res) => {
  try { res.json(await generate(String(req.query.workerId || ''), String(req.query.start || ''), String(req.query.end || ''))); }
  catch (error: any) { res.status(400).json({ error: error.message || 'Unable to generate handover' }); }
});
app.get('/api/organization', async (_, res) => res.json({ users: await getUsers(), teams: await getTeams() }));
app.listen(4000, () => console.log('ShiftFlow API listening on http://localhost:4000'));
