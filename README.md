# Hummingbird Instinct

Consulting engagement knowledge management platform (Phase 1 — Local Dev).

## Prerequisites

- Node.js 18+
- npm 8+

## First-time Setup

```bash
# 1. Install all dependencies (root + server + client)
npm install

# 2. Copy env file and configure
cp server/.env.example server/.env
# Edit server/.env — at minimum set ANTHROPIC_API_KEY if you have one.
# All AI features degrade gracefully if the key is absent.

# 3. Initialise the database
npm run migrate

# 4. Start the dev servers
npm run dev
```

- **Client**: http://localhost:3000
- **API**: http://localhost:4000/api
- **Health check**: http://localhost:4000/api/health

## Environment Variables

See `server/.env.example` for all available variables with descriptions.

Key variables:
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | 4000 | Express server port |
| `DB_PATH` | No | `./data/hbird.db` | SQLite database location |
| `ANTHROPIC_API_KEY` | No | — | Enables all AI features |
| `RAG_THRESHOLD` | No | 200 | Findings count to switch from full-KB to RAG mode |

SharePoint / Azure AD variables are all optional in Phase 1 — integration is fully stubbed.

## Dev Role Switching

The local auth stub reads `X-User-Role` from `localStorage` in the browser. Open DevTools console and run:

```js
// Switch to Team Member
localStorage.setItem('x-user-role', 'Team Member');

// Switch back to Engagement Lead (default)
localStorage.setItem('x-user-role', 'Engagement Lead');

// Reload to apply
location.reload();
```

## Project Structure

```
hummingbird-instinct/
├── server/
│   ├── src/
│   │   ├── config/         database.js (SQLite singleton)
│   │   ├── db/             schema.sql, migrate.js
│   │   ├── middleware/     auth.js, auditLogger.js
│   │   ├── routes/         engagement, findings, questions, artifacts, ai, ...
│   │   ├── services/       aiProxy, vectorStore, ingestionPipeline, metadataWorkflow
│   │   └── utils/          idGenerator (FND-001 format), hashUtil
│   └── index.js
├── client/
│   ├── src/
│   │   ├── api/            client.js (axios + all API namespaces)
│   │   ├── components/
│   │   │   ├── common/     Button, Badge, Modal, Sidebar, Spinner, EmptyState
│   │   │   ├── InterviewStudio/
│   │   │   ├── ArtifactIngestion/
│   │   │   ├── KnowledgeHub/
│   │   │   ├── TaskTracker/
│   │   │   ├── EngagementSetup/
│   │   │   └── PendingApprovals/
│   │   ├── db/             sessionStore.js (IndexedDB via idb)
│   │   ├── pages/          EngagementList, EngagementShell, NotFound
│   │   └── store/          engagementStore, sessionStore, uiStore (Zustand)
│   └── index.jsx
└── package.json            (npm workspaces root)
```

## Module Build Status

| Module | Status |
|---|---|
| Engagement List (entry screen) | Complete |
| Engagement Shell + Sidebar | Complete |
| Engagement Setup wizard | Placeholder (Step 1 functional) |
| Interview Studio | In progress |
| Artifact Ingestion | Placeholder |
| Knowledge Hub | Placeholder |
| Engagement Task Tracker | Placeholder |
| Pending Approvals | Placeholder |

## Phase 3 Migration Notes

- **Database**: `server/src/config/database.js` — swap `better-sqlite3` for `mssql` connection pool
- **Vector store**: `server/src/services/vectorStore.js` — replace in-memory Map with Azure AI Search client
- **AI proxy**: `server/src/services/aiProxy.js` — already uses `@anthropic-ai/sdk`, no change needed
- **SharePoint**: `server/src/services/graphClient.js` — all stubs marked `SHAREPOINT_STUB` with Phase 3 checklist
- **Auth**: `server/src/middleware/auth.js` — swap stub for Azure AD JWT validation
