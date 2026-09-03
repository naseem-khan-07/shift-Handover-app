CREATE DATABASE IF NOT EXISTS shiftflow;
USE shiftflow;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role ENUM('manager', 'team_lead', 'worker') NOT NULL,
  title VARCHAR(120) NOT NULL,
  team_id VARCHAR(32) NULL,
  team_lead_id VARCHAR(32) NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  lead_id VARCHAR(32) NOT NULL,
  worker_ids JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(32) PRIMARY KEY,
  source ENUM('jira', 'incident', 'chat', 'commit') NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  timestamp DATETIME NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('completed', 'in_progress', 'blocked', 'escalated', 'watch', 'open') NOT NULL,
  priority ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  worker_id VARCHAR(32) NOT NULL,
  team_id VARCHAR(32) NOT NULL,
  team_lead_id VARCHAR(32) NOT NULL,
  update_type VARCHAR(64) NOT NULL,
  INDEX idx_events_worker_timestamp (worker_id, timestamp),
  INDEX idx_events_record (source, record_id)
);
