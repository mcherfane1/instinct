-- =============================================================
-- Hummingbird Instinct — Database Schema v1.0
-- Phase 1: SQLite  |  Phase 3: Azure SQL Database
--
-- Design rules:
--   • JSON arrays stored as TEXT (SQLite). Azure SQL will use JSON columns.
--   • All timestamps stored as ISO-8601 TEXT in UTC.
--   • Sequential IDs (FND-001) managed via id_counters table.
--   • audit_log is APPEND-ONLY — no UPDATE or DELETE ever.
--   • Foreign keys enforced via PRAGMA foreign_keys = ON (set in database.js).
-- =============================================================

-- -------------------------------------------------------------
-- ID COUNTERS
-- Provides atomic sequential IDs for all named entity types.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS id_counters (
  entity_type    TEXT PRIMARY KEY,
  current_value  INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO id_counters VALUES ('finding',     0);
INSERT OR IGNORE INTO id_counters VALUES ('question',    0);
INSERT OR IGNORE INTO id_counters VALUES ('stakeholder', 0);
INSERT OR IGNORE INTO id_counters VALUES ('artifact',    0);
INSERT OR IGNORE INTO id_counters VALUES ('assumption',  0);
INSERT OR IGNORE INTO id_counters VALUES ('gap',         0);
INSERT OR IGNORE INTO id_counters VALUES ('action',      0);
INSERT OR IGNORE INTO id_counters VALUES ('decision',    0);
INSERT OR IGNORE INTO id_counters VALUES ('suggestion',  0);
INSERT OR IGNORE INTO id_counters VALUES ('session',     0);

-- -------------------------------------------------------------
-- ENTITY 1: CORE CONFIG (PRD §5.1)
-- One record per engagement. Defines all controlled vocabulary.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core_config (
  engagement_id               TEXT PRIMARY KEY,
  client_name                 TEXT NOT NULL,
  engagement_name             TEXT NOT NULL,
  start_date                  TEXT,

  -- Controlled vocabulary lists (JSON arrays of strings)
  sows                        TEXT NOT NULL DEFAULT '[]',
  contact_centers             TEXT NOT NULL DEFAULT '[]',
  workstreams                 TEXT NOT NULL DEFAULT '[]',
  technologies                TEXT NOT NULL DEFAULT '[]',

  -- Team (JSON array of {name, role, user_id})
  team_members                TEXT NOT NULL DEFAULT '[]',

  -- SharePoint integration (populated in Setup Step 2)
  -- SHAREPOINT_STUB: These fields are stored but not used until credentials provided
  sharepoint_site_url         TEXT,
  sharepoint_parent_folder_id TEXT,
  instinct_folder_id          TEXT,
  session_notes_folder_id     TEXT,

  -- Items permanently excluded from ingestion (JSON array of SharePoint item IDs)
  exclusion_list              TEXT NOT NULL DEFAULT '[]',

  status                      TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Active', 'Closed', 'Archived')),

  sow_review_status           TEXT NOT NULL DEFAULT 'SOW Not Reviewed'
                              CHECK (sow_review_status IN ('SOW Not Reviewed', 'Reviewed')),

  created_by                  TEXT,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -------------------------------------------------------------
-- INTERVIEW SESSIONS
-- Not a canonical entity but required as parent for Notes.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_sessions (
  session_id       TEXT PRIMARY KEY,
  engagement_id    TEXT NOT NULL,
  name             TEXT NOT NULL,
  date             TEXT NOT NULL,

  -- JSON array of {id, name, role, is_active}
  participants     TEXT NOT NULL DEFAULT '[]',

  workstream       TEXT,
  contact_center   TEXT,

  -- TipTap editor JSON document (full rich text state)
  canvas_content   TEXT,
  -- Plain text extraction for search/display
  canvas_text      TEXT,

  elapsed_seconds  INTEGER NOT NULL DEFAULT 0,

  status           TEXT NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active', 'Closed', 'Exported')),

  created_by       TEXT NOT NULL DEFAULT 'system',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_engagement
  ON interview_sessions(engagement_id, status);

-- -------------------------------------------------------------
-- ENTITY 2: NOTES (PRD §5.2) — Raw Live Capture
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  note_id               TEXT PRIMARY KEY,
  session_id            TEXT NOT NULL,
  engagement_id         TEXT NOT NULL,
  text                  TEXT NOT NULL,

  note_type             TEXT
                        CHECK (note_type IN (
                          'Observation', 'Current State', 'Future State',
                          'Gap', 'Risk', 'Action Item', 'Decision'
                        )),

  workstream            TEXT,
  contact_center        TEXT,
  technology            TEXT,
  speaker               TEXT,
  timestamp_in_session  TEXT,           -- Elapsed time e.g. "00:14:32"

  -- JSON arrays
  linked_question_ids   TEXT NOT NULL DEFAULT '[]',

  promoted_to_finding_id TEXT,
  captured_by           TEXT NOT NULL DEFAULT 'system',

  review_status         TEXT NOT NULL DEFAULT 'Draft'
                        CHECK (review_status IN ('Draft', 'Promoted', 'Archived')),

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (session_id)    REFERENCES interview_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id)     ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_session
  ON notes(session_id);
CREATE INDEX IF NOT EXISTS idx_notes_engagement_status
  ON notes(engagement_id, review_status);

-- -------------------------------------------------------------
-- ENTITY 3: FINDINGS (PRD §5.3) — Committed Knowledge
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS findings (
  finding_id          TEXT PRIMARY KEY,    -- FND-001 format
  engagement_id       TEXT NOT NULL,
  finding_text        TEXT NOT NULL,

  state_tag           TEXT
                      CHECK (state_tag IN (
                        'Current State', 'Future State', 'Gap',
                        'Recommendation', 'Decision', 'Risk', 'Assumption'
                      )),

  workstream          TEXT,
  -- Multi-value fields stored as JSON arrays
  contact_center      TEXT NOT NULL DEFAULT '[]',
  technology          TEXT NOT NULL DEFAULT '[]',

  source_type         TEXT
                      CHECK (source_type IN (
                        'Interview', 'Transcript', 'Document',
                        'Questionnaire', 'AI-Extracted', 'Internal'
                      )),

  source_artifact_id  TEXT,
  source_note_id      TEXT,
  provided_by         TEXT,

  -- JSON array of Q IDs
  linked_question_ids TEXT NOT NULL DEFAULT '[]',

  confidence          TEXT NOT NULL DEFAULT 'Unverified'
                      CHECK (confidence IN ('High', 'Medium', 'Low', 'Unverified')),

  review_status       TEXT NOT NULL DEFAULT 'Needs Review'
                      CHECK (review_status IN (
                        'Needs Review', 'Confirmed', 'Rejected', 'Superseded'
                      )),

  created_by          TEXT NOT NULL DEFAULT 'system',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_findings_engagement
  ON findings(engagement_id, review_status);
CREATE INDEX IF NOT EXISTS idx_findings_workstream
  ON findings(engagement_id, workstream);

-- -------------------------------------------------------------
-- ENTITY 4: QUESTIONS & ANSWERS (PRD §5.4)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  question_id         TEXT PRIMARY KEY,   -- Q-001 format
  engagement_id       TEXT NOT NULL,
  section             TEXT,
  question_text       TEXT NOT NULL,
  answer_text         TEXT,
  provided_by         TEXT,
  source_artifact_id  TEXT,
  date_answered       TEXT,

  -- JSON array of FND IDs
  linked_finding_ids  TEXT NOT NULL DEFAULT '[]',

  status              TEXT NOT NULL DEFAULT 'Open'
                      CHECK (status IN (
                        'Open', 'Partially Answered', 'Answered',
                        'AI-Answered (Review)', 'Closed'
                      )),

  created_by          TEXT NOT NULL DEFAULT 'system',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_engagement_status
  ON questions(engagement_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_section
  ON questions(engagement_id, section);

-- -------------------------------------------------------------
-- ENTITY 5: STAKEHOLDERS (PRD §5.5)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stakeholders (
  stakeholder_id   TEXT PRIMARY KEY,      -- STK-001 format
  engagement_id    TEXT NOT NULL,
  name             TEXT NOT NULL,
  role             TEXT,
  organization     TEXT,

  relationship     TEXT
                   CHECK (relationship IN (
                     'Sponsor', 'Decision Maker', 'SME',
                     'Influencer', 'Operational Contact', 'Unknown'
                   )),

  engagement_level TEXT NOT NULL DEFAULT 'Unknown'
                   CHECK (engagement_level IN ('High', 'Medium', 'Low', 'Unknown')),

  notes            TEXT,
  last_interaction TEXT,

  status           TEXT NOT NULL DEFAULT 'Active'
                   CHECK (status IN ('Active', 'Inactive', 'Departed')),

  created_by       TEXT NOT NULL DEFAULT 'system',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_engagement
  ON stakeholders(engagement_id, status);

-- -------------------------------------------------------------
-- ENTITY 6: ARTIFACTS (PRD §5.6)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id        TEXT PRIMARY KEY,    -- ART-001 format
  engagement_id      TEXT NOT NULL,
  name               TEXT NOT NULL,

  artifact_type      TEXT
                     CHECK (artifact_type IN (
                       'Transcript', 'Meeting Notes', 'Report',
                       'Questionnaire Response', 'Presentation', 'SOW', 'Other'
                     )),

  file_format        TEXT
                     CHECK (file_format IN (
                       'PDF', 'DOCX', 'XLSX', 'TXT', 'CSV', 'PPTX', 'MD', 'Other'
                     )),

  date_received      TEXT,
  summary            TEXT,               -- AI-generated 2-3 sentence summary

  -- JSON array of workstream strings
  workstreams_covered TEXT NOT NULL DEFAULT '[]',

  provided_by        TEXT,

  ingestion_status   TEXT NOT NULL DEFAULT 'Pending'
                     CHECK (ingestion_status IN (
                       'Pending', 'Processing', 'Processed', 'Failed',
                       'Duplicate', 'Skipped - Oversized',
                       'Failed - OCR Error', 'Failed - Parse Error', 'Excluded'
                     )),

  file_hash          TEXT,               -- MD5/SHA for duplicate detection
  sharepoint_item_id TEXT,               -- Graph API item ID

  -- PHI flag: if 1, this file is NEVER sent to the Claude API
  phi_flag           INTEGER NOT NULL DEFAULT 0,

  -- Phase 1: local file path. Phase 3: SharePoint is the store of record.
  local_file_path    TEXT,
  file_size_bytes    INTEGER,
  ocr_applied        INTEGER NOT NULL DEFAULT 0,

  created_by         TEXT NOT NULL DEFAULT 'system',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_engagement_status
  ON artifacts(engagement_id, ingestion_status);
CREATE INDEX IF NOT EXISTS idx_artifacts_hash
  ON artifacts(file_hash);

-- -------------------------------------------------------------
-- ENTITY 7: ASSUMPTIONS & GAPS (PRD §5.7)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assumptions_gaps (
  item_id             TEXT PRIMARY KEY,   -- ASM-001 or GAP-001 format
  engagement_id       TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('Assumption', 'Gap')),
  workstream          TEXT,
  statement           TEXT NOT NULL,
  risk_if_wrong       TEXT,
  resolution_plan     TEXT,
  owner               TEXT,

  -- JSON array of FND IDs
  linked_finding_ids  TEXT NOT NULL DEFAULT '[]',

  status              TEXT NOT NULL DEFAULT 'Open'
                      CHECK (status IN (
                        'Open', 'In Progress', 'Resolved', 'Accepted Risk'
                      )),

  created_by          TEXT NOT NULL DEFAULT 'system',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assumptions_engagement
  ON assumptions_gaps(engagement_id, type, status);

-- -------------------------------------------------------------
-- ENTITY 8: DECISIONS & ACTIONS (PRD §5.8)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decisions_actions (
  item_id          TEXT PRIMARY KEY,      -- ACT-001 or DEC-001 format
  engagement_id    TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('Decision', 'Action')),
  workstream       TEXT,
  description      TEXT NOT NULL,
  owner            TEXT,
  due_date         TEXT,                  -- Actions only; ISO date

  -- JSON array of related Finding/Q/Artifact IDs
  linked_ids       TEXT NOT NULL DEFAULT '[]',

  status           TEXT NOT NULL DEFAULT 'Open'
                   CHECK (status IN (
                     'Open', 'In Progress', 'Complete', 'Cancelled'
                   )),

  -- Decisions: immutable once confirmed; can be superseded not edited
  confirmed_date   TEXT,
  is_superseded    INTEGER NOT NULL DEFAULT 0,
  superseded_by    TEXT,                  -- item_id of the superseding Decision

  created_by       TEXT NOT NULL DEFAULT 'system',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decisions_engagement
  ON decisions_actions(engagement_id, type, status);

-- -------------------------------------------------------------
-- AUDIT LOG (PRD §12.3)
-- Append-only. No UPDATE or DELETE statements ever touch this table.
-- Retention: 7 years (aligned with healthcare record-keeping standards).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  field_name     TEXT,
  old_value      TEXT,
  new_value      TEXT,
  changed_by     TEXT NOT NULL,
  changed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  operation_type TEXT NOT NULL
                 CHECK (operation_type IN (
                   'Create', 'Update', 'Delete',
                   'Promote', 'Approve', 'Deny'
                 ))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at
  ON audit_log(changed_at);

-- -------------------------------------------------------------
-- METADATA SUGGESTIONS (PRD §6)
-- AI-Driven Schema Evolution — human approval required.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata_suggestions (
  suggestion_id       TEXT PRIMARY KEY,
  engagement_id       TEXT NOT NULL,

  suggestion_type     TEXT NOT NULL
                      CHECK (suggestion_type IN (
                        'Add new workstream',
                        'Add new technology',
                        'Add new state tag',
                        'Add new contact center',
                        'Rename existing value',
                        'Add new relationship type'
                      )),

  proposed_value      TEXT NOT NULL,
  existing_value      TEXT,              -- For rename suggestions only
  scope               TEXT NOT NULL,     -- Which controlled list is affected

  -- What triggered this suggestion
  trigger_source_type TEXT,              -- 'artifact' | 'session'
  trigger_source_id   TEXT,

  -- JSON array of record IDs that need re-tagging if approved
  affected_record_ids TEXT NOT NULL DEFAULT '[]',

  ai_confidence       REAL,
  example_text        TEXT,              -- Source text excerpt that triggered this

  status              TEXT NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending', 'Approved', 'Denied')),

  -- Populated when Engagement Lead acts on this suggestion
  reviewed_by         TEXT,
  reviewed_at         TEXT,

  -- If denied: result of the deny-and-reconfirm pass
  reconfirm_value     TEXT,             -- What AI re-mapped to after denial
  reconfirm_confidence REAL,
  reconfirm_status    TEXT              -- 'Auto-Committed' | 'Pending-Lead-Review' | 'Unclassified'
                      CHECK (reconfirm_status IN (
                        'Auto-Committed', 'Pending-Lead-Review', 'Unclassified'
                      )),

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (engagement_id) REFERENCES core_config(engagement_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suggestions_pending
  ON metadata_suggestions(engagement_id, status);
