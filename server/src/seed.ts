import 'dotenv/config';
import { pool } from './db';
import { events, teams, users } from './data';

async function seed() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM events');
    await connection.query('DELETE FROM teams');
    await connection.query('DELETE FROM users');

    for (const user of users) {
      await connection.query(
        'INSERT INTO users (id, name, role, title, team_id, team_lead_id) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.role, user.title, user.team_id ?? null, user.team_lead_id ?? null],
      );
    }
    for (const team of teams) {
      await connection.query(
        'INSERT INTO teams (id, name, lead_id, worker_ids) VALUES (?, ?, ?, ?)',
        [team.id, team.name, team.lead_id, JSON.stringify(team.worker_ids)],
      );
    }
    for (const event of events) {
      await connection.query(
        'INSERT INTO events (id, source, record_id, timestamp, summary, status, priority, worker_id, team_id, team_lead_id, update_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [event.id, event.source, event.record_id, event.timestamp.replace('T', ' ').replace(/[+-]\d\d:\d\d$/, ''), event.summary, event.status, event.priority, event.worker_id, event.team_id, event.team_lead_id, event.update_type],
      );
    }
    await connection.commit();
    console.log(`Seeded ${users.length} users, ${teams.length} teams, and ${events.length} events.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Database seed failed:', error.message);
  process.exitCode = 1;
});
