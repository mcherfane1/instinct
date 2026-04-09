/**
 * Artifact routes — Entity 6 (PRD §5.6, §7.2).
 * Handles file upload, ingestion trigger, and artifact registry.
 */

const express  = require('express');
const router   = express.Router({ mergeParams: true });
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const { getDatabase }       = require('../config/database');
const { logAudit }          = require('../middleware/auditLogger');
const { nextId }            = require('../utils/idGenerator');
const { hashFile }          = require('../utils/hashUtil');
const { detectFormat }      = require('../services/textExtractor');
const { runIngestion }      = require('../services/ingestionPipeline');
const asyncHandler          = require('../utils/asyncHandler');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10); // 50 MB
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Multer: store files to disk under uploads/<engagementId>/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.engagementId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|docx?|txt|md|xlsx?|xlsm|csv|pptx?)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Unsupported file type'), { status: 415 }));
    }
  },
});

function parseArtifact(row) {
  if (!row) return null;
  return { ...row, workstreams_covered: JSON.parse(row.workstreams_covered || '[]') };
}

// GET /engagements/:engagementId/artifacts
router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const { ingestion_status, artifact_type } = req.query;
  let sql = 'SELECT * FROM artifacts WHERE engagement_id = ?';
  const params = [req.params.engagementId];
  if (ingestion_status) { sql += ' AND ingestion_status = ?'; params.push(ingestion_status); }
  if (artifact_type)    { sql += ' AND artifact_type = ?';    params.push(artifact_type); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(parseArtifact));
}));

// GET /engagements/:engagementId/artifacts/:artifactId
router.get('/:artifactId', asyncHandler(async (req, res) => {
  const db  = getDatabase();
  const row = db.prepare('SELECT * FROM artifacts WHERE artifact_id = ? AND engagement_id = ?')
    .get(req.params.artifactId, req.params.engagementId);
  if (!row) return res.status(404).json({ error: 'Artifact not found' });
  res.json(parseArtifact(row));
}));

// POST /engagements/:engagementId/artifacts/upload — Upload + queue ingestion
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const db   = getDatabase();
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // Check oversized (multer handles this, but belt-and-suspenders)
  if (file.size > MAX_SIZE) {
    fs.unlinkSync(file.path);
    return res.status(413).json({ error: 'File exceeds 50 MB limit (PRD §7.2.1)' });
  }

  const fileHash   = hashFile(file.path);
  const fileFormat = detectFormat(file.originalname);
  const now        = new Date().toISOString();

  // Duplicate detection
  const duplicate = db.prepare(
    'SELECT artifact_id FROM artifacts WHERE engagement_id = ? AND file_hash = ?'
  ).get(req.params.engagementId, fileHash);

  if (duplicate) {
    fs.unlinkSync(file.path); // Remove duplicate upload
    return res.status(409).json({
      error:      'Duplicate file detected',
      message:    'This file has already been ingested.',
      artifact_id: duplicate.artifact_id,
    });
  }

  const artifact_id    = nextId('artifact');
  const { artifact_type, provided_by, date_received } = req.body;

  db.prepare(`
    INSERT INTO artifacts
      (artifact_id, engagement_id, name, artifact_type, file_format,
       date_received, provided_by, file_hash, local_file_path, file_size_bytes,
       ingestion_status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)
  `).run(
    artifact_id, req.params.engagementId, file.originalname,
    artifact_type || 'Other', fileFormat,
    date_received || now.slice(0, 10),
    provided_by || null,
    fileHash, file.path, file.size,
    req.user.userId, now, now
  );

  logAudit({ entityType: 'artifacts', entityId: artifact_id,
    newValue: { name: file.originalname, fileFormat },
    changedBy: req.user.userId, operationType: 'Create' });

  // Run ingestion asynchronously — don't block the upload response
  setImmediate(() => {
    runIngestion({
      artifactId:   artifact_id,
      engagementId: req.params.engagementId,
      filePath:     file.path,
      fileName:     file.originalname,
      userId:       req.user.userId,
    }).catch(err => {
      console.error(`[Artifacts] Background ingestion failed for ${artifact_id}:`, err.message);
    });
  });

  res.status(201).json({
    artifact_id,
    name:            file.originalname,
    ingestion_status: 'Pending',
    message:         'File uploaded. Ingestion queued.',
  });
}));

// PUT /:artifactId — Update artifact metadata (type, provided_by, phi_flag, etc.)
router.put('/:artifactId', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const UPDATABLE = ['artifact_type', 'provided_by', 'date_received', 'phi_flag',
                     'workstreams_covered', 'ingestion_status'];
  const updates = {};
  for (const f of UPDATABLE) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'workstreams_covered' ? JSON.stringify(req.body[f]) : req.body[f];
    }
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields' });
  updates.updated_at = new Date().toISOString();
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE artifacts SET ${setClauses} WHERE artifact_id = ? AND engagement_id = ?`)
    .run(...Object.values(updates), req.params.artifactId, req.params.engagementId);
  logAudit({ entityType: 'artifacts', entityId: req.params.artifactId,
    newValue: updates, changedBy: req.user.userId, operationType: 'Update' });
  res.json(parseArtifact(db.prepare('SELECT * FROM artifacts WHERE artifact_id = ?').get(req.params.artifactId)));
}));

// POST /:artifactId/reprocess — Re-run ingestion on a failed artifact
router.post('/:artifactId/reprocess', asyncHandler(async (req, res) => {
  const db       = getDatabase();
  const artifact = db.prepare('SELECT * FROM artifacts WHERE artifact_id = ? AND engagement_id = ?')
    .get(req.params.artifactId, req.params.engagementId);
  if (!artifact) return res.status(404).json({ error: 'Artifact not found' });
  if (!artifact.local_file_path || !fs.existsSync(artifact.local_file_path)) {
    return res.status(409).json({ error: 'Local file not found. Cannot reprocess.' });
  }

  setImmediate(() => {
    runIngestion({
      artifactId:   artifact.artifact_id,
      engagementId: req.params.engagementId,
      filePath:     artifact.local_file_path,
      fileName:     artifact.name,
      userId:       req.user.userId,
    }).catch(err => {
      console.error(`[Artifacts] Reprocess failed for ${artifact.artifact_id}:`, err.message);
    });
  });

  res.json({ ok: true, message: 'Reprocessing queued.' });
}));

module.exports = router;
