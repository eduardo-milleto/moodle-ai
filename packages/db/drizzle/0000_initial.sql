CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE task_source AS ENUM ('moodle', 'ics', 'manual');
CREATE TYPE task_status AS ENUM ('pending', 'submitted', 'graded', 'overdue', 'unknown');
CREATE TYPE sync_status AS ENUM ('success', 'partial', 'failed');

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source task_source NOT NULL DEFAULT 'moodle',
  external_id text NOT NULL,
  course text NOT NULL,
  title text NOT NULL,
  due_at timestamptz,
  moodle_status task_status NOT NULL DEFAULT 'unknown',
  link text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  manually_done boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX tasks_due_at_idx ON tasks (due_at);
CREATE INDEX tasks_course_idx ON tasks (course);
CREATE INDEX tasks_manually_done_idx ON tasks (manually_done);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status sync_status NOT NULL DEFAULT 'success',
  source text NOT NULL,
  tasks_seen integer NOT NULL DEFAULT 0,
  tasks_upserted integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX sync_runs_started_at_idx ON sync_runs (started_at DESC);
