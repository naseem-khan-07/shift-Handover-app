import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Event, Team, User } from './data';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shiftflow',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

export async function getUsers(): Promise<User[]> {
  const [rows] = await pool.query('SELECT id, name, role, title, team_id, team_lead_id FROM users');
  return rows as User[];
}

export async function getTeams(): Promise<Team[]> {
  const [rows] = await pool.query('SELECT id, name, lead_id, worker_ids FROM teams');
  return (rows as Array<Team & { worker_ids: string | string[] }>).map((team) => ({
    ...team,
    worker_ids: typeof team.worker_ids === 'string' ? JSON.parse(team.worker_ids) : team.worker_ids,
  }));
}

export async function getEvents(): Promise<Event[]> {
  const [rows] = await pool.query('SELECT id, source, record_id, timestamp, summary, status, priority, worker_id, team_id, team_lead_id, update_type FROM events');
  return (rows as Event[]).map((event) => ({
    ...event,
    timestamp: event.timestamp.includes('T') ? event.timestamp : `${event.timestamp.replace(' ', 'T')}+05:30`,
  }));
}
