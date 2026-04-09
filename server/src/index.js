require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const { validateEnv }    = require('./config/env');
const { getDatabase }    = require('./config/database');
const { authMiddleware } = require('./middleware/auth');
const errorHandler       = require('./middleware/errorHandler');

// Route modules
const engagementRoutes  = require('./routes/engagement');
const sessionRoutes     = require('./routes/sessions');
const noteRoutes        = require('./routes/notes');
const findingRoutes     = require('./routes/findings');
const questionRoutes    = require('./routes/questions');
const stakeholderRoutes = require('./routes/stakeholders');
const artifactRoutes    = require('./routes/artifacts');
const assumptionRoutes  = require('./routes/assumptions');
const decisionRoutes    = require('./routes/decisions');
const metadataRoutes    = require('./routes/metadata');
const aiRoutes          = require('./routes/ai');
const sharepointRoutes  = require('./routes/sharepoint');
const exportRoutes      = require('./routes/export');

// ── Startup ──────────────────────────────────────────────────────────────────
validateEnv();

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// ── Health check (no auth required) ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    phase: 'Phase 1 — Local Development',
    ai_available: !!process.env.ANTHROPIC_API_KEY,
    sharepoint_configured: !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID),
  });
});

// ── AI status (no engagement context needed) ──────────────────────────────────
app.use('/api/ai', aiRoutes);
app.use('/api/sharepoint', sharepointRoutes);

// ── Engagement-scoped routes ──────────────────────────────────────────────────
app.use('/api/engagements', engagementRoutes);
app.use('/api/engagements/:engagementId/sessions',     sessionRoutes);
app.use('/api/engagements/:engagementId/notes',        noteRoutes);
app.use('/api/engagements/:engagementId/findings',     findingRoutes);
app.use('/api/engagements/:engagementId/questions',    questionRoutes);
app.use('/api/engagements/:engagementId/stakeholders', stakeholderRoutes);
app.use('/api/engagements/:engagementId/artifacts',    artifactRoutes);
app.use('/api/engagements/:engagementId/assumptions',  assumptionRoutes);
app.use('/api/engagements/:engagementId/decisions',    decisionRoutes);
app.use('/api/engagements/:engagementId/metadata',     metadataRoutes);
app.use('/api/engagements/:engagementId/ai',           aiRoutes);
app.use('/api/engagements/:engagementId/export',       exportRoutes);
app.use('/api/engagements/:engagementId/sharepoint',   sharepointRoutes);

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  // Verify DB is reachable on startup
  try {
    getDatabase();
    console.log(`[Server] Hummingbird Instinct API running on http://localhost:${PORT}`);
    console.log(`[Server] Health: http://localhost:${PORT}/api/health`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[Server] ℹ️  AI features disabled — add ANTHROPIC_API_KEY to .env to enable');
    }
  } catch (err) {
    console.error('[Server] Database failed to initialize:', err.message);
    console.error('[Server] Run: npm run migrate --workspace=server');
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  const { closeDatabase } = require('./config/database');
  closeDatabase();
  process.exit(0);
});
