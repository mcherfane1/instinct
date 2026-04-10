# Hummingbird Instinct — Product Requirements Document

**Version 1.5 | April 2026 | Confidential — Internal Use Only**

| Document Property | Value |
|---|---|
| Product Name | Hummingbird Instinct |
| Version | 1.5 (Interview Studio & SharePoint Updates) |
| Status | Draft — Revised April 2026 (v1.5) |
| Owner | Michael (Engagement Lead, Hummingbird Healthcare) |
| Prepared By | Hummingbird Healthcare Product Team |
| Date | April 2026 |
| Classification | Confidential — Internal Use Only |

---

## 1. Executive Summary

Hummingbird Instinct is a purpose-built engagement knowledge management platform for Hummingbird Healthcare's consulting practice. It solves a fundamental problem in client delivery: insights, findings, stakeholder intelligence, and interview content accumulate across dozens of formats and locations — transcripts, PDFs, spreadsheets, meeting notes, live interview sessions — and are never unified into a queryable, structured repository that can drive deliverable creation.

Instinct addresses this by providing a single platform where the entire knowledge lifecycle of a consulting engagement lives: from live note-taking during client interviews, to automated ingestion of uploaded artifacts, to an AI-powered knowledge hub that lets consultants query everything the project knows in natural language. It is not a project management tool and not a document repository. It is the system of record for what a consulting team knows about a client engagement.

> **Design Principle:** Every feature in Hummingbird Instinct exists to serve one goal: enabling a consultant to produce a better, faster, more defensible client deliverable. Features that do not serve that goal are out of scope.

---

## 2. Problem Statement

Consulting engagements generate knowledge in fragments. A stakeholder says something critical in a pre-kickoff call that never makes it into a finding. A PDF from the client contains data that contradicts an assumption no one has formally logged. A team member's notes from an interview have context that isn't in the official transcript. By the time the deliverable is being drafted, the team is reconstructing knowledge from memory rather than querying a structured record of what was actually learned.

The specific pain points this product addresses:

- Live interviews produce notes never connected to the formal questionnaire or finding log.
- Artifacts arrive in incompatible formats and require manual extraction to be useful.
- The team cannot answer basic questions mid-engagement without digging through files.
- Assumptions carried through an engagement are never formally tracked or resolved.
- At deliverable time, the team drafts from memory rather than from a structured knowledge base.
- Knowledge does not persist across engagements — what was learned on one client does not inform the next.

---

## 3. Product Overview

### 3.1 Product Vision

Hummingbird Instinct becomes the operating system for a consulting engagement — the place where everything known about a client is captured, structured, and made queryable, so that the final deliverable is assembled from accumulated evidence rather than reconstructed from memory.

### 3.2 V1 Scope

V1 is a single-engagement build. Multi-engagement support is architecturally planned but not exposed in the V1 UI. The following five modules are in scope:

| Module | Description | Primary User |
|---|---|---|
| Engagement Setup | Guided wizard: SharePoint connection, document scope, SOW review, Core Config proposal, metadata model approval, questionnaire seeding. | Engagement Lead |
| Interview Studio | Live note-taking with real-time AI assistance, question linking, and session export. | All team |
| Artifact Ingestion | Upload any document; AI extracts findings, Q&A, stakeholders, writes back to knowledge model. | All team |
| Knowledge Hub | Natural-language query over the full engagement knowledge base. | All roles |
| Engagement Task Tracker | Client-engagement task and decision log — actions, owners, due dates. | Engagement Lead |

### 3.3 Out of Scope — V1

- Deliverable drafting / AI-assisted assessment generation (planned V2)
- Multi-engagement management UI (data model supports it; UI does not expose it)
- Client-facing portal or read-only reviewer access (planned V2)
- Integration with external systems (Genesys, Epic, CallMiner data pulls)
- Real-time multi-user collaborative note-taking with live sync (planned V1.3)
- Mobile application

---

## 4. User Roles & Permissions

Hummingbird Instinct defines four user roles. V1 implements Engagement Lead and Team Member; Viewer and Leadership are architected in the permission model but not exposed in the V1 UI.

| Role | Who | Permissions |
|---|---|---|
| Engagement Lead (Admin) | Senior consultant leading the engagement. One per engagement. | Full read/write. Sole approver of metadata suggestions. Configures Core Config. Manages team access. Promotes Notes to Findings. Exports knowledge base. |
| Team Member | Consultants, analysts, SMEs contributing to the engagement. | Captures notes, uploads artifacts, queries Knowledge Hub, adds tasks. Cannot approve metadata suggestions or modify Core Config. |
| Viewer (V2) | Read-only stakeholders — e.g. Hummingbird leadership. | Read-only access to Knowledge Hub and Task Tracker. No data modification. |

---

## 5. Knowledge Model — Canonical Data Schema

The knowledge model is the structured data backbone of Instinct. All content captured, uploaded, or AI-extracted maps to one of eight canonical entity types. The schema is defined by this PRD; developers choose the underlying storage technology. A full Excel export deriving from this schema must always be available as a citizen-developer-readable source of truth.

> **Implementation Note:** The PRD specifies the entity schema. Storage technology (SQL, NoSQL, document store) is left to the development team. The Excel export is derived from the primary store and must be kept in sync and downloadable on demand.

### 5.1 Entity 1 — Core Config

Engagement-level parameters. One record per engagement. Defines all controlled vocabulary used elsewhere.

| Field | Description |
|---|---|
| engagement_id | Unique identifier (system-generated) |
| client_name | Client organization name |
| engagement_name | Full engagement title |
| sows | List of Statements of Work in scope |
| contact_centers | List of in-scope contact center names |
| workstreams | Controlled list of workstream labels used for tagging |
| technologies | Controlled list of technology names in scope |
| team_members | List of HH team members and roles |
| sharepoint_site_url | Root SharePoint site URL for this engagement |
| sharepoint_parent_folder_id | Graph API ID of the user-selected parent folder |
| instinct_folder_id | Graph API ID of the Instinct Created Documentation folder |
| session_notes_folder_id | Graph API ID of the user-specified destination folder for Interview Studio session notes write-back. Configured separately from instinct_folder_id during Setup Step 2. |
| exclusion_list | SharePoint item IDs permanently excluded from ingestion |
| status | Engagement status: Active \| Closed \| Archived |
| created_at / updated_at | System timestamps |

### 5.2 Entity 2 — Notes (Raw Live Capture)

Raw output of live interview sessions. Distinct from Findings. A Note may be promoted to a Finding by the Engagement Lead. Notes not promoted remain in session history but do not appear in the Knowledge Hub by default.

| Field | Description |
|---|---|
| note_id | System-generated unique ID |
| session_id | Links to the parent Interview Session |
| text | Raw note content |
| note_type | Observation \| Current State \| Future State \| Gap \| Risk \| Action Item \| Decision |
| workstream | Tag from Core Config controlled list |
| contact_center | Tag from Core Config controlled list |
| technology | Tag from Core Config controlled list |
| speaker | Participant(s) active when note was captured |
| timestamp_in_session | Elapsed session time (e.g. 00:14:32) |
| linked_question_ids | Zero or more Q IDs this note addresses |
| promoted_to_finding_id | Null until promoted; then references resulting Finding |
| captured_by | Team Member who entered the note |
| review_status | Draft \| Promoted \| Archived |

### 5.3 Entity 3 — Findings (Committed Knowledge)

Committed knowledge records. Created by promotion from a Note or by AI extraction from an ingested artifact. All AI-extracted findings carry Unverified status until reviewed by the Engagement Lead.

| Field | Description |
|---|---|
| finding_id | System-generated ID (FND-001 format) |
| finding_text | Standalone statement of the observation or fact |
| state_tag | Current State \| Future State \| Gap \| Recommendation \| Decision \| Risk \| Assumption |
| workstream | From Core Config controlled list |
| contact_center | From Core Config controlled list — supports multi-value |
| technology | From Core Config controlled list — supports multi-value |
| source_type | Interview \| Transcript \| Document \| Questionnaire \| AI-Extracted \| Internal |
| source_artifact_id | Links to source Artifact, if applicable |
| source_note_id | Links to source Note if promoted from one |
| provided_by | Stakeholder who stated or confirmed this |
| linked_question_ids | Q IDs this finding addresses |
| confidence | High \| Medium \| Low \| Unverified |
| review_status | Needs Review \| Confirmed \| Rejected \| Superseded |
| created_by | Team Member or AI-Extracted |
| created_at / updated_at | System timestamps |

### 5.4 Entity 4 — Questions & Answers

Maps to the pre-discovery and discovery questionnaire. Seeded at engagement setup. Answers populated by AI extraction or manually by team members.

| Field | Description |
|---|---|
| question_id | System ID (Q-001 format) |
| section | Questionnaire section (e.g. Epic Config, Tech Stack) |
| question_text | Full question text |
| answer_text | The answer — may be partial or complete |
| provided_by | Name or role of person who provided the answer |
| source_artifact_id | Artifact where the answer was found, if AI-extracted |
| date_answered | Date the answer was recorded |
| linked_finding_ids | Findings that support or elaborate on this answer |
| status | Open \| Partially Answered \| Answered \| AI-Answered (Review) \| Closed |

### 5.5 Entity 5 — Stakeholders

| Field | Description |
|---|---|
| stakeholder_id | System ID (STK-001 format) |
| name | Full name |
| role | Title or functional role |
| organization | Client org, HH, or vendor |
| relationship | Sponsor \| Decision Maker \| SME \| Influencer \| Operational Contact \| Unknown |
| engagement_level | High \| Medium \| Low \| Unknown |
| notes | Context notes, conversation history, political considerations |
| last_interaction | Date of most recent documented interaction |
| status | Active \| Inactive \| Departed |

### 5.6 Entity 6 — Artifacts

| Field | Description |
|---|---|
| artifact_id | System ID (ART-001 format) |
| name | File name or document title |
| artifact_type | Transcript \| Meeting Notes \| Report \| Questionnaire Response \| Presentation \| SOW \| Other |
| file_format | PDF \| DOCX \| XLSX \| TXT \| CSV \| Other |
| date_received | Date the artifact was obtained |
| summary | AI-generated 2-3 sentence summary |
| workstreams_covered | Workstreams addressed in this artifact |
| provided_by | Person or organization that provided it |
| ingestion_status | Pending \| Processing \| Processed \| Failed \| Duplicate |
| file_hash | MD5/SHA hash for duplicate detection |
| sharepoint_item_id | Graph API item ID for the source file in SharePoint |

### 5.7 Entity 7 — Assumptions & Gaps

| Field | Description |
|---|---|
| item_id | ASM-001 or GAP-001 format |
| type | Assumption \| Gap |
| workstream | From Core Config controlled list |
| statement | Clear articulation of the assumption or gap |
| risk_if_wrong | What changes if this assumption is incorrect |
| resolution_plan | How and when this will be confirmed or closed |
| owner | Team Member responsible for resolution |
| linked_finding_ids | Findings that depend on or relate to this item |
| status | Open \| In Progress \| Resolved \| Accepted Risk |

### 5.8 Entity 8 — Decisions & Actions

The Engagement Task Tracker. Records decisions confirmed and actions required during the engagement.

| Field | Description |
|---|---|
| item_id | ACT-001 or DEC-001 format |
| type | Decision \| Action |
| workstream | From Core Config controlled list |
| description | Full description of the decision or action |
| owner | Person responsible |
| due_date | Target completion date for Actions |
| linked_ids | Related Finding, Q, or Artifact IDs |
| status | Open \| In Progress \| Complete \| Cancelled |

---

## 6. Adaptive Metadata — AI-Driven Schema Evolution

The metadata model — the controlled vocabularies driving tagging — is not static. As content is ingested and the engagement evolves, the AI may identify that existing categories do not adequately represent new information. In V1, this triggers a governed suggestion-and-approval workflow rather than automatic schema modification.

### 6.1 Trigger Conditions

A metadata suggestion is generated when any of the following conditions are met:

- A finding, stakeholder, or artifact cannot be confidently tagged to any existing workstream with confidence >= 0.8.
- A technology is referenced repeatedly in ingested content that does not exist in the Core Config technology list.
- A contact center name variant appears that does not match any existing Core Config entry.
- A state tag is needed that does not exist in the current controlled vocabulary.
- A new stakeholder role or relationship type is inferred outside existing options.

#### 6.1.2 Suggestion Types

| Suggestion Type | Example | Scope |
|---|---|---|
| Add new workstream | 'Patient Portal & Digital Access' does not map to any existing workstream. | Core Config workstreams list |
| Add new technology | 'Hyro' referenced in 3 ingested documents; not in technology list. | Core Config technologies list |
| Add new state tag | 'Regulatory Constraint' appears as a distinct finding type. | Global state_tag controlled list |
| Rename existing value | AI detects 'Florida OAM CC' and 'FL Office of Access Mgmt' are the same entity. | Core Config contact_centers list |
| Add new relationship type | 'External Vendor Contact' is needed but doesn't exist. | Global relationship controlled list |

### 6.2 Approval Workflow

All metadata suggestions surface in a dedicated Pending Approvals screen, accessible only to the Engagement Lead.

1. Ingestion event completes. AI evaluates all tags applied.
2. If a suggestion is warranted, a Pending Approval record is created and a notification badge appears for the Engagement Lead.
3. The Engagement Lead reviews each suggestion with full context: which artifact triggered it, which records are affected, and the AI confidence score.
4. Engagement Lead selects Approve or Deny.

**If Approved:**
- New value added to the relevant controlled list in Core Config.
- All triggered records re-tagged with the new value.
- Change logged in audit trail with timestamp and approver.

**If Denied:**
- AI re-conforms all affected records to the closest existing category with a confidence score.
- If re-conformed confidence is HIGH (>= 0.8): auto-committed. Engagement Lead sees a summary notification.
- If re-conformed confidence is LOW (< 0.8): Engagement Lead sees the proposed re-conformed result before it is committed and must confirm or manually assign.
- Denial and re-conforming decision are both logged in the audit trail.

**Edge Case — AI Cannot Conform:**
- If the AI cannot map content to any existing category after the deny-and-reconfirm pass, records are placed in an Unclassified holding state.
- Unclassified records appear in Pending Approvals with distinct visual treatment and require manual assignment.
- Unclassified records are excluded from Knowledge Hub query results by default.

> **Design Intent:** The goal is not to make the schema rigid — it is to ensure schema evolution is deliberate, intuitive, and human-governed. The Engagement Lead always has final say. The AI proposes; the human confirms, denies, or modifies.

---

## 7. Module Specifications

### 7.1 Interview Studio

The Interview Studio is the live note-taking interface used during client calls and in-person sessions. The center of the layout is a continuous rich text canvas — a single freeform writing surface where consultants capture everything during an interview without interrupting their flow. Metadata tagging, finding promotion, and AI-assisted insight extraction happen at session close, not during capture.

#### 7.1.1 The Rich Text Canvas

The canvas is a continuous rich text editor occupying the center panel of the Interview Studio. It behaves like a familiar document editor — the consultant writes freely, formats as they go, and does not submit or classify individual entries during the session.

Required formatting capabilities:

| Capability | Behavior |
|---|---|
| Bold / Italic / Underline | Standard inline formatting. Keyboard shortcuts (Cmd/Ctrl+B, I, U) required. |
| Text Color | Foreground color picker accessible from the toolbar. Minimum palette of 8 colors. |
| Highlight / Background Color | Background highlight color picker. Minimum palette of 8 colors including yellow, green, orange, pink. |
| Bullet Lists (unordered) | Standard unordered list. Toolbar button and Markdown-style trigger (type `-` or `*` at line start). |
| Numbered Lists (ordered) | Standard ordered list. Toolbar button and Markdown-style trigger (type `1.` at line start). |
| Indent / Outdent | Nested hierarchy within lists and paragraphs. Tab to indent, Shift+Tab to outdent. Minimum 4 levels deep. |
| Paragraph / Normal text | Default block type. No heading hierarchy required in V1 canvas. |

#### 7.1.2 Formatting Toolbar

A fixed minimal toolbar sits above the canvas and is always visible during a session. It contains: Bold, Italic, Underline, Text Color, Highlight Color, Bullet List, Numbered List, Indent, Outdent.

- A floating contextual toolbar additionally appears on text selection, containing the same options for quick access without moving to the top of the screen.
- Keyboard shortcuts are required for all toolbar actions. A keyboard shortcut reference is accessible via a help icon in the toolbar.
- Toolbar state reflects the formatting at the current cursor position (e.g. Bold button appears active when cursor is in bold text).

#### 7.1.3 Session Management

- Each session has a name, date, and participant list configured before the canvas opens.
- A session timer is displayed in the toolbar area: startable, pausable, and resumable. Elapsed time is recorded per session.
- An autosave indicator displays the time of last local save (e.g. "Saved 3s ago"). Saves occur continuously on every keystroke with a short debounce. The consultant must never lose work.
- Session state is persisted to IndexedDB on every keystroke with a short debounce. IndexedDB survives browser refresh, tab crash, and unexpected close. On reload, the session is restored exactly as left — no data loss is acceptable under any circumstance.
- A Service Worker caches the application shell for offline access, ensuring Interview Studio remains functional without an internet connection. Pending data is queued locally and synced to the server automatically when connectivity is restored.
- Sessions are accompanied by artifacts from other sources (third-party note-taking tools, recording transcripts, etc.). These are ingested separately via the Artifact Ingestion pipeline and associated with the session in the Artifact Registry.

#### 7.1.4 Context Panel (Left Rail)

The left rail provides session context that applies to the canvas. It does not interrupt writing.

- **Participants:** Add, edit, and toggle participants. The currently active speaker can be marked; speaker attribution is recorded at session close during the metadata review, not in real time.
- **Workstream selector:** Single-select from the Core Config controlled list. When beginning an interview, the consultant selects the workstream or topic area for the session. Upon selection, the interface surfaces a filtered list of open questions pertinent to that workstream in a side panel, giving the interviewer immediate context before the session begins. The active workstream is also the default tag proposed by the AI at session close for all blocks in the current session. The consultant can change the active workstream at any point during the session; the change is noted with a timestamp to help the AI segment the session.
- **Contact Center selector:** Single-select from the Core Config controlled list. Same behavior as workstream.
- **Question list:** When a workstream is selected at interview start, the left rail surfaces a filtered side panel showing all open Q&A Tracker questions pertinent to the selected workstream, organized by section. The interviewer can add new questions to the list during the session using the `?` prefix shortcut, which queues them as candidate Q records for review at session close. Clicking any question in the panel inserts a `#Q-XXX` reference inline into the canvas at the current cursor position. Proceeding from workstream selection transitions the user to the Metadata Review screen setup before the canvas opens.

#### 7.1.5 Inline Prefix Commands

Prefix commands typed at the start of any new line are recognized and trigger behavior without requiring a toolbar interaction. They coexist with the toolbar — both routes to the same outcome.

| Prefix | Behavior |
|---|---|
| `? text` | Marks the line as a candidate question. At session close, AI will propose this as a new Q record to add to the Q&A Tracker. |
| `Action: text` | Marks the line as an Action Item. Visually distinguished in the canvas (e.g. checkbox indicator). |
| `! text` | Marks the line as a Risk. |
| `D: text` | Marks the line as a Decision. |

> Prefix-marked lines receive visual treatment in the canvas (subtle left-border color or label) so the consultant can see what has been flagged without disrupting writing flow. Formatting is lightweight and non-intrusive.

#### 7.1.6 Session Close — AI Metadata Review

When the consultant closes or exports a session, the AI analyzes the full canvas content and presents a structured Metadata Review screen before the session is exported or written to SharePoint. The session cannot be closed without the consultant at least seeing this screen, but it is not a hard gate — a single "Accept All" action dismisses it without requiring per-block review.

The Metadata Review screen presents:

- **Block-level metadata proposals:** For each identified block or logical grouping of text, the AI proposes a note_type, a workstream tag, and a contact center tag. The consultant can accept, edit, or reassign each proposal individually, or accept all in bulk.
- **Candidate findings:** The AI identifies passages of text that represent committed knowledge and proposes them as candidate Findings. Each candidate is shown with the proposed finding_text, state_tag, and confidence. The Engagement Lead can promote, edit, or dismiss each candidate. Promoted candidates are written to the Findings Log immediately on export.
- **Candidate Q&A answers:** The AI identifies passages that appear to answer open questions in the Q&A Tracker and proposes linking them. The consultant reviews and confirms.
- **Candidate new questions:** Lines prefixed with `?` are proposed as new Q records. The consultant reviews and confirms.
- **New stakeholders:** Names mentioned in the canvas not already in the Stakeholder Register are flagged for potential addition.

Review actions:

- **"Accept All"** — accepts all AI proposals as-is, exports the session, and writes to SharePoint. Fastest path for a consultant who trusts the AI output or is short on time.
- **"Edit"** — accepts edits to each user-identified item before committing.
- **"Omit/Delete Session"** — deletes the raw session content & skips upload to SharePoint with no metadata applied.

> All AI-proposed metadata from the session review is flagged Unverified in the knowledge model until the Engagement Lead confirms it — consistent with the same review discipline applied to artifact ingestion.

#### 7.1.7 Mid-Session Finding Promotion

The Engagement Lead may also promote text to a Finding at any point during the session without waiting for session close.

- Select any passage of text in the canvas. A floating toolbar appears with a Promote to Finding option.
- Promotion opens a modal: the selected text pre-populates the finding_text field. The Engagement Lead confirms or edits the finding text, state tag, workstream, contact center, and confidence before committing.
- Promoted findings are written to the Findings Log immediately. The source passage in the canvas is visually annotated with a Finding badge (e.g. FND-042) so the team can see what has already been promoted.
- Team Members can flag a passage for promotion review; the Engagement Lead performs the actual promotion.
- Mid-session promotions are not duplicated in the session close AI review — the AI is aware of what has already been promoted and excludes those passages from its candidate list.

#### 7.1.8 Session Export

On export, two output files are produced:

- **Markdown (.md):** Human-readable version of the session. Formatting preserved as Markdown syntax. AI-proposed metadata and promotions annotated inline as labels. Written to the session notes destination folder (session_notes_folder_id) as a .docx rendered from the Markdown and also available for local download. Note: this destination is distinct from the Instinct Created Documentation folder.
- **JSON (.json):** Structured representation of the session for pipeline ingestion. Contains the full block structure of the canvas, per-block metadata proposals (confirmed or unconfirmed), promoted finding IDs, linked Q IDs, participant list, session timestamp, and workstream/CC context at each point in the session.
- The JSON schema is stable and versioned. The ingestion pipeline must always accept session exports from any prior version of Instinct.

### 7.2 Artifact Ingestion Pipeline

Processes uploaded artifacts and extracts structured knowledge records, writing them back to the knowledge model.

#### 7.2.1 Supported File Types

- Documents: .docx, .doc, .txt, .md
- PDFs: .pdf (text-extractable and scanned — OCR applied automatically for scanned files)
- Spreadsheets: .xlsx, .xlsm, .csv
- PowerPoints: .pptx (text-extractable and scanned — OCR applied automatically for scanned files)
- Maximum supported file size: 50MB. Files exceeding this limit are logged in the Artifact Registry with ingestion_status = Skipped — Oversized and the Engagement Lead is notified.

#### 7.2.2 Ingestion Flow

1. User uploads file via drag-and-drop or file picker (or file auto-detected via SharePoint watch).
2. System checks file hash against Artifact Registry. Duplicate detected = user warned before proceeding.
3. File content extracted to text. Spreadsheets converted to structured text representation.
4. Text sent to AI with engagement context, existing questions, known stakeholders, and current findings.
5. AI returns structured extraction: candidate findings, Q&A answers, new stakeholders, artifact summary.
6. Metadata tagging applied. Tags outside controlled vocabulary queue a metadata suggestion (Section 6).
7. All AI-extracted records written with review_status = Needs Review and visual highlight flag.
8. Artifact logged in Artifact Registry with ingestion_status = Processed.
9. Engagement Lead notified of results: N findings, M Q&A answers, P stakeholders, Q metadata suggestions.

#### 7.2.3 Long Document Handling

- Documents exceeding the AI context window are chunked into overlapping segments.
- Each chunk processed independently. Deduplication prevents duplicate findings from overlapping chunks.

#### 7.2.4 OCR Processing

Scanned documents — PDFs and PowerPoints where native text extraction returns fewer than 100 characters despite a non-zero file size — are automatically routed through Azure Document Intelligence prior to AI extraction. OCR is invoked transparently; no user action is required.

- OCR output replaces native text extraction as the input to the ingestion pipeline. The artifact record is annotated to indicate that OCR was applied.
- Native text extraction is always attempted first. Azure Document Intelligence is invoked only when native extraction is insufficient.
- Files that fail OCR are logged with ingestion_status = Failed — OCR Error. The Engagement Lead is notified and the raw file is preserved in the Artifact Registry for manual review or re-submission.

#### 7.2.5 Backlog — Smart SharePoint Filing on Manual Upload

> **Status:** Backlog — pending Microsoft BAA confirmation. Not in scope for V1 or Phase 3 deployment. Revisit when BAA is in place.

When a user uploads an artifact via drag-and-drop or file picker (i.e., not via the SharePoint watch scope), the application should not only ingest the file into the knowledge model but also file it into the appropriate location within the engagement's SharePoint project folder structure — outside the Instinct Created Documentation dump folder, in the natural project directory where the document belongs.

**Intent:** Artifacts uploaded directly into Instinct arrive from various sources (emails, downloads, third-party tools). Rather than creating a parallel shadow archive, Instinct should make the document a first-class citizen of the team's SharePoint project directory, properly filed alongside the rest of the engagement's source material.

**Behavior:**

1. After the user selects a file, the AI infers the document type and likely destination folder based on filename, content, and engagement context (e.g. a file named `kickoff_transcript_2026-04-10.docx` is classified as a meeting transcript; a file containing an agenda and attendees list is classified as meeting notes).
2. Before any filing action, the application presents a **confirmation dialog** to the user:
   - AI-inferred document classification (e.g. "This appears to be a meeting transcript.")
   - Proposed SharePoint destination folder (e.g. `/Project Documents/Meeting Notes/`).
   - For transcripts and raw meeting notes: option to file the original as-is, or to file a **consolidated/reanimated version** — an AI-cleaned, structured rendition of the document — in its place (or alongside the original).
   - User can accept the proposed destination, browse to a different folder, or skip SharePoint filing entirely (knowledge model ingestion proceeds regardless).
3. On confirmation, the file (or reanimated version) is written to the selected SharePoint folder via Graph API, following the existing write-back architecture (Section 9.1).
4. The Artifact Registry record is updated with the `sharepoint_item_id` of the filed document.
5. If the filed document is later modified in SharePoint, the change notification pipeline (Section 9.2) treats it as an update and re-ingests accordingly.

**Reanimation:** For meeting notes and transcripts, the reanimated version is an AI-produced structured document — formatted with clear sections (Attendees, Agenda, Key Discussion Points, Action Items, Decisions) — that replaces or supplements the raw source. The raw original is always preserved in the Artifact Registry and available for re-download. Reanimation is offered as an option, never forced.

**Dependencies:**
- Active Microsoft BAA covering use of Claude API for processing documents that may contain PHI.
- `Files.ReadWrite.All` Graph API permission (already in scope per Section 9.5).
- SharePoint folder tree accessible at time of upload (requires active SharePoint connection — Setup Step 2 completed).
- PHI flag must be checked before any reanimation pass: files flagged PHI — Do Not Send to API are filed as-is without AI processing.

### 7.3 Knowledge Hub

The primary query interface for the engagement knowledge base.

#### 7.3.1 Query Interface

- Natural-language input accepting free-form questions of any length.
- Pre-seeded example queries to guide new users.
- The AI receives the full knowledge base as context: findings, stakeholders, Q&A, artifacts, assumptions, decisions.
- For large knowledge bases, most relevant records retrieved first using semantic similarity (RAG pattern).

#### 7.3.2 Answer Format

- Answers in plain prose with light structure. No markdown headers.
- Referenced record IDs (FND-001, STK-003, Q-045) rendered as clickable links to the Detail Panel.
- Answers include a confidence note when synthesizing from limited or conflicting evidence.

#### 7.3.3 Faceted Browse

- Left-rail facet panel: filter by entity type, workstream, contact center, state tag, confidence.
- Clicking any record card opens its full field set in a right-rail Detail Panel.

### 7.4 Engagement Task Tracker

Structured log of open actions and confirmed decisions for the client engagement.

- Records typed as Action or Decision.
- Actions: owner, due date, status (Open / In Progress / Complete / Cancelled).
- Decisions: confirmed date, decision text. Immutable once confirmed — can be superseded, not edited.
- Both types linkable to Findings, Questions, and Artifacts.
- Actions auto-generated from notes tagged as Action Item type in Interview Studio.
- Tracker filterable by status, owner, workstream, and due date.

---

## 8. Engagement Setup

Engagement Setup is the wizard-driven onboarding flow that initializes a new engagement. It must be completed by the Engagement Lead before any team member can access the engagement. Setup is one-time per engagement. Once completed, the engagement is immediately live — no separate activation step is required.

> **V1 Deployment Note:** Hummingbird Instinct V1 ships clean with no pre-loaded engagement data.

### 8.1 Setup Prerequisites

- Active Hummingbird account.
- Owner or Contributor permissions on the target SharePoint site.
- At minimum, the Statement(s) of Work accessible in SharePoint or ready to upload.
- Microsoft Graph API permissions pre-consented by a Hummingbird Azure AD tenant administrator (one-time per HH tenant, before first deployment). The six required permissions are listed in Section 9.5. Absence of this consent will block SharePoint connection and prevent the setup wizard from completing.

### 8.2 Setup Wizard — Six Steps

**Step 1 — Engagement Identity**
- Engagement Lead enters: Engagement Name, Client Name, Start Date, their own name and role.
- Seeds Core Config: engagement_id, client_name, engagement_name.
- No AI involvement at this step.

**Step 2 — SharePoint Connection**
- Engagement Lead authenticates to Microsoft 365 via Azure AD SSO.
- Pastes or browses to the root SharePoint site URL for this engagement.
- App validates user has sufficient permissions (Contributor or higher). Clear error if not.
- Engagement Lead specifies two separate folder destinations using the folder-picker UI: (1) the root project directory and (2) the session notes destination. These two destinations may be different locations within the SharePoint site. App creates the Instinct Created Documentation subfolder inside the root project directory.
- Connection details stored in Core Config: sharepoint_site_url, sharepoint_parent_folder_id, instinct_folder_id, session_notes_folder_id.
- During Step 2, the application automatically provisions an 'Instinct Status' site column on the connected SharePoint site using the Sites.Manage.All Graph API permission.

> The app does not impose any structure on the existing SharePoint site beyond creating the Instinct Created Documentation folder and provisioning the Instinct Status column.

**Step 3 — Document Scope Selection**

Engagement Lead presented with the full file tree of the connected SharePoint site and given two options:
- **Option A — Include All:** All documents in the site included in the watch scope.
- **Option B — Select Specific Documents/Folders:** Engagement Lead checks individual files and folders via a tree with checkboxes.

For Option B, unchecked items trigger a prompt: Permanently Exclude (added to exclusion list in Core Config) or Skip for Now (available for future ingestion).

> The exclusion list is visible and editable by the Engagement Lead at any time from Engagement Settings.

**Step 4 — SOW Review and Core Config Proposal**

App identifies SOW documents and prompts Engagement Lead to confirm them. If SOWs are not in SharePoint, they can be uploaded directly from this step.
- AI reads confirmed SOWs and proposes initial Core Config: workstreams, contact centers, technologies, scope boundaries — each shown with source text from the SOW.
- Core fields (client name, engagement name, SOW titles) require explicit Engagement Lead confirmation.
- Optional fields (workstreams, technologies, contact centers) auto-commit if not modified; flagged as AI-proposed and editable at any time.

> If no SOW is available, Core Config fields can be entered manually. Engagement flagged as SOW Not Reviewed until a SOW is later reviewed.

**Step 5 — Initial Ingestion and Metadata Model Proposal**

With document scope and Core Config confirmed, app ingests all in-scope documents that are not SOWs. Progress indicator shows files processed, findings extracted, stakeholders identified.
- AI evaluates extracted records against Core Config and presents a Metadata Model Proposal.
- Core Config values confirmed in Step 4 are locked. Only new suggestions from this pass require review.
- Denied suggestions follow the deny-and-reconfirm workflow (Section 6).

**Step 6 — Questionnaire Seeding**

The Q&A Tracker is seeded using any combination of three methods:
- Upload a questionnaire document: app parses it into Q records for review before committing. Supported: .docx, .xlsx, .pdf.
- Generate from SOW and metadata model: AI proposes discovery questions based on confirmed Core Config and initial findings.
- Pull from HH question library: filtered question set from a Hummingbird master library. V1 shows Coming Soon unless library is configured.
- Duplicate questions across methods flagged by semantic similarity for deduplication before commit.

**Setup Complete**
- Engagement immediately live. All team members with application access can see and use the engagement.
- App displays a setup summary: documents ingested, findings extracted, stakeholders identified, questions loaded.
- A timestamped setup log is written to the Instinct Created Documentation folder in SharePoint.
- Engagement Lead directed to Pending Approvals if metadata suggestions remain unresolved.

### 8.3 Post-Setup Configuration

Editable by the Engagement Lead at any time from Engagement Settings:
- Document scope: add/remove folders and files; clear items from the permanent exclusion list.
- Core Config controlled vocabulary: add, rename, or retire tag values.
- SharePoint parent folder: re-point if the engagement SharePoint structure changes.
- Team member access: managed at Azure AD group level in V1. In-app invite flow is a backlog enhancement.
- Canvas @-mentions: backlog enhancement for V1.x.
- Canvas table insertion: backlog enhancement for V1.x.

---

## 9. SharePoint Data Pipeline

Hummingbird Instinct uses SharePoint as its document foundation. Instinct connects bidirectionally: reading documents to build the knowledge model, and writing Instinct-produced outputs back so they are accessible to the full team without leaving the Microsoft 365 ecosystem.

### 9.1 Architecture Overview

The pipeline is built on the Microsoft Graph API, authenticated via Azure AD SSO. No separate authentication is required for SharePoint access.

| Direction | Trigger | Mechanism |
|---|---|---|
| Read (SharePoint to Instinct) | New or modified file in watch scope | Microsoft Graph API change notification (webhook). Graph notifies Instinct server; Instinct queues the file for ingestion. |
| Read (Manual) | User drag-and-drop upload in the app | File written to SharePoint via Graph API AND queued for ingestion. SharePoint copy is the system of record. |
| Write (Instinct to SharePoint) | Session export, Knowledge Model export, AI summary, ingestion log update | Instinct writes output file to the Instinct Created Documentation folder via Graph API. Immediately accessible to all team members with site access. |

### 9.2 Watch Scope and Change Detection

- Instinct subscribes to Microsoft Graph change notifications on libraries and folders confirmed during Setup Step 3.
- Notifications received server-side and queued. The system does not poll — it reacts to events.
- File deletions logged but do not trigger re-ingestion. Artifact Registry record flagged as Source Deleted.
- File hash checked against Artifact Registry before ingestion. Duplicate versions not re-processed.
- Engagement Lead can manually trigger a full re-scan from the Artifact Registry screen.
- Microsoft Graph API change notification subscriptions expire after a maximum of 4,320 minutes (3 days). The application manages automatic renewal via a scheduled Azure Timer Function that renews all active subscriptions when they are within 24 hours of expiry. Renewal failures trigger an Azure Monitor alert and are written to the audit log.

### 9.3 File Handling — Read Direction

- Original files are never moved, renamed, or content-modified in SharePoint.
- Instinct writes to the 'Instinct Status' SharePoint site column on each processed file (values: Processed / Processing / Failed). This is the only modification Instinct makes to SharePoint files — metadata only, not content.
- Files flagged as PHI — Do Not Send to API are excluded from AI processing.
- Files in the permanent exclusion list never processed, even if they change.

### 9.4 Write-Back — Instinct Created Documentation Folder

All Instinct-produced outputs written to the Instinct Created Documentation subfolder. Internal structure is fixed:

| Subfolder | Contents and Naming Convention |
|---|---|
| /Sessions | Interview Studio session exports. One .docx per session. Written to the session notes destination folder (session_notes_folder_id). Name: `[Session Name]_[YYYY-MM-DD].docx` |
| /Knowledge Model | Timestamped Excel exports. Name: `Instinct_KnowledgeModel_[EngagementName]_[YYYY-MMDD_HHMMSS].xlsx` |
| /Ingestion Log | Running log of all ingestion events, appended on each ingestion. Name: `Instinct_IngestionLog_[EngagementName].xlsx` |
| /AI Summaries | Post-session summaries and other AI-generated narrative outputs. Name: `[DocumentType]_[Source]_[YYYY-MM-DD].docx` |
| /Setup Log | One-time immutable record of engagement initialization. Name: `Instinct_SetupLog_[EngagementName]_[YYYY-MM-DD].docx` |

> **Naming Convention Rule:** All files written by Instinct must follow the naming patterns above exactly. Consistent naming allows team members to find Instinct outputs without application knowledge.

### 9.5 Microsoft Graph API Permissions Required

The following permissions must be consented by a Hummingbird Azure AD administrator before deployment:

| Permission | Type | Purpose |
|---|---|---|
| Sites.ReadWrite.All | Delegated | Read and write to SharePoint sites on behalf of the signed-in user. |
| Files.ReadWrite.All | Delegated | Read and write files in SharePoint document libraries. |
| Files.Read.All | Application | Read files for background ingestion processing server-side. |
| Sites.Manage.All | Delegated | Create the Instinct folder and manage SharePoint column metadata. |
| User.Read | Delegated | Read signed-in user profile for attribution and access control. |
| offline_access | Delegated | Maintain access tokens for background ingestion without re-authentication. |

> **Developer Action Required:** Confirm that Hummingbird Healthcare's Azure AD tenant administrator can consent to the above permissions before development begins. Absence of Sites.Manage.All will prevent folder creation and metadata tagging. This is a hard dependency.

### 9.6 Offline Behavior

- All four application modules remain functional for reading and note capture when SharePoint is unavailable.
- Write-back operations queued locally and retried when connectivity is restored.
- Ingestion of new SharePoint files paused with a banner notification. Resumes automatically on reconnect.
- Users are never blocked from capturing notes or querying the knowledge base due to a SharePoint outage.

---

## 10. AI Layer Specification

Hummingbird Instinct uses the Anthropic Claude API as its AI backbone.

### 10.1 AI Touchpoints

| Touchpoint | AI Role | Model Guidance |
|---|---|---|
| Artifact Ingestion — Extraction | Reads artifact text; extracts findings, Q&A answers, stakeholders, artifact summary; proposes metadata tags. | Single structured extraction prompt per chunk. Must return valid JSON. System prompt includes full engagement context and controlled vocabulary. |
| Ingestion — Metadata Evaluation | Evaluates whether extracted records can be tagged to existing controlled vocabulary. Generates suggestions for new values. | Separate prompt pass after extraction. Returns confidence scores per tag assignment. |
| Metadata Deny-and-Reconfirm | Re-maps denied records to closest existing category. | System prompt explicitly constrains output to existing controlled vocabulary. Returns confidence score. |
| Interview Studio — AI Query | Answers questions about the current session's notes. | Session notes as context only. Concise structured responses. No markdown headers. |
| Knowledge Hub — Query | Answers questions about the full engagement knowledge base. | Full KB serialized as structured context. RAG pattern for large KBs. References entity IDs in answers. |
| Engagement Setup — SOW Analysis | Reads SOW documents and proposes initial Core Config values. | Returns structured JSON with proposed values and source text evidence for each. |
| Q Prefix — Question Generation | Generates a well-formed Q record from `?` prefix note text. | Brief prompt; returns question text, suggested section, and workstream tag. |

### 10.2 System Prompt Architecture

Each AI touchpoint uses a purpose-built system prompt. All share a common engagement context block injected at runtime:

- Client name, engagement name, SOWs in scope
- Full controlled vocabulary (workstreams, contact centers, technologies, state tags, source types)
- Engagement scope boundaries (explicit out-of-scope statements)
- Confidence level definitions
- Output format requirements (JSON structure for extraction; prose for queries)

### 10.3 Failure Behavior

- **API unavailable:** ingestion queues for retry; Interview Studio AI panel shows graceful unavailable state; Knowledge Hub query returns error with retry option. Core note-taking and browsing must remain operational.
- **Malformed JSON from Claude:** system logs raw response, marks ingestion as Failed — Parse Error, notifies Engagement Lead. Raw artifact text preserved.
- **Globally low extraction confidence:** Engagement Lead notified. Manual review pass recommended.

### 10.4 API Infrastructure

All Claude API calls are proxied through a server-side Azure Function (Consumption Plan) to ensure no API keys are exposed in client-side code.

- Claude API keys are stored in Azure Key Vault and accessed by the Azure Function at runtime via Managed Identity. No secrets are stored in application configuration files or environment variables.
- The Azure Function acts as a thin, stateless proxy: it receives structured prompts from the Instinct application server, forwards them to the Claude API, and returns the response. No prompt content is logged by the proxy layer.
- Rate limiting and retry logic (exponential backoff, max 3 retries) are implemented at the proxy layer. The Instinct application server does not call the Claude API directly.
- The proxy function is deployed in the same Azure region as the application to minimize latency.

### 10.5 Semantic Retrieval — RAG Implementation

For Knowledge Hub queries over large knowledge bases (greater than 200 findings), the application uses a Retrieval-Augmented Generation (RAG) pattern.

- All Finding, Q&A, Stakeholder, and Assumption/Gap records are embedded as vectors at creation and update time. Embeddings are stored in Azure AI Search alongside the structured record metadata.
- Azure AI Search implements hybrid retrieval: keyword search combined with vector similarity search, merged using Reciprocal Rank Fusion (RRF).
- At query time, the user's question is embedded and the top-K most semantically relevant records are retrieved from Azure AI Search. Only these records are included in the Claude prompt context.
- For small knowledge bases (200 findings or fewer), the full knowledge base is passed to the AI as context without RAG pre-filtering.
- The retrieval depth K defaults to 50 records. This value is configurable per deployment without a code change.
- Embedding generation is performed server-side via the Claude API embedding endpoint. Embeddings are generated asynchronously after record creation and do not block the user-facing save operation.

---

## 11. Export & Interoperability

Hummingbird Instinct must never become a data silo. All knowledge captured in the platform must be exportable in human-readable formats usable independently of the application.

### 11.1 Excel Export (Citizen-Dev Source of Truth)

- Full Excel export of the knowledge model available on demand from the Engagement Lead dashboard.
- Multi-sheet workbook mirroring the eight entity types defined in Section 5.
- Readable and navigable by a non-technical user without application knowledge.
- Controlled vocabulary lookup sheets included — export is self-documenting.
- Export is timestamped with engagement name and version.
- Written automatically to SharePoint / Knowledge Model subfolder and available for local download.

### 11.2 Session Export (Interview Studio)

- Each session exportable as JSON (for pipeline ingestion) or Markdown (for documentation).
- JSON export schema is stable and versioned — ingestion pipeline must always accept exports from prior versions.
- Session export also written to the session notes destination folder (session_notes_folder_id) as a formatted .docx.

### 11.3 Knowledge Base JSON Export (kb.json)

- Full kb.json export of the knowledge base available on demand.
- Used by the Knowledge Hub when operating in offline or file-loaded mode.
- Format is stable and versioned.

### 11.4 Future: Deliverable Export

- Post-V1, a deliverable drafting module will generate structured Word document drafts directly from the knowledge model.
- The export schema and entity model defined in V1 must be designed to support this downstream use case.

---

## 12. Non-Functional Requirements

### 12.1 Performance

- Note submission in Interview Studio: < 200ms from Enter keystroke to note appearing on canvas.
- Artifact ingestion (standard document < 20 pages): AI extraction complete within 30 seconds.
- Knowledge Hub query response: < 5 seconds for engagements with < 500 findings.
- Excel export: < 10 seconds for a full engagement knowledge model.
- Page load (initial): < 3 seconds on a standard corporate network connection.

### 12.2 Reliability

- No in-flight notes may be lost on browser refresh, network interruption, or unexpected close. Session state persisted to local storage continuously.
- Ingestion failures must be recoverable — the original artifact always preserved and re-submittable.

### 12.3 Security

- Authentication required for all access. Recommended: Azure Active Directory / Microsoft Entra ID SSO.
- All Claude API calls proxied server-side. No API key exposure in client-side code.
- All data at rest encrypted. All data in transit over TLS 1.2+.
- Role-based access control enforced server-side — not just client-side UI hiding.
- Audit log of all knowledge model modifications: who changed what, when, and prior value.

The audit log is implemented as a dedicated append-only table in Azure SQL Database. Each row captures: entity_type, entity_id, field_name, old_value, new_value, changed_by (Azure AD user ID), changed_at (UTC timestamp), and operation_type (Create | Update | Delete | Promote | Approve | Deny). No audit rows are ever updated or deleted. Audit log retention: 7 years, aligned with healthcare record-keeping standards.

### 12.4 Hosting & Infrastructure

Hosting within Microsoft Azure. Constraints and resolved architectural decisions:

- Accessible via web browser on Windows and Mac without local software installation.
- Supports concurrent access by up to 10 team members per engagement.
- Deployable within Microsoft Azure to align with Hummingbird Healthcare cloud infrastructure standards.
- Data residency within the United States.
- Supports SharePoint-embedded deployment as a secondary access path.

Resolved data storage architecture:

- **Primary data store:** Azure SQL Database. Hosts all eight canonical entity types (Section 5), the audit log, and the Artifact Registry.
- **Vector / semantic store:** Azure AI Search. Hosts embedding vectors for Finding, Q&A, Stakeholder, and Assumption/Gap records. Powers the Knowledge Hub RAG retrieval pattern. Deployed in the same Azure region as the application.
- **Client-side session store:** IndexedDB (browser-native). Provides offline-capable, zero-latency note capture in Interview Studio. State syncs to the server on reconnect after an offline period.
- **File storage:** SharePoint via Microsoft Graph API for all source artifacts and Instinct-produced outputs. No separate Azure Blob Storage is required.
- **Claude API proxy:** Azure Function (Consumption Plan) with secrets in Azure Key Vault, accessed via Managed Identity.

### 12.5 Browser Support

- Chrome (current and current-1): Full support.
- Edge (current and current-1): Full support.
- Firefox (current): Full support.
- Safari: Best effort.
- Mobile browsers: Out of scope for V1.

### 12.6 Development & Delivery Sequence

Hummingbird Instinct is built in three sequential phases. Each phase has a clear exit condition before the next begins.

**Phase 1 — Local Development**

The full application is built and run locally on the Engagement Lead's machine. The local environment must mirror the eventual Azure architecture closely enough that Phase 3 migration requires configuration changes, not code rewrites.

- Developer sets up a local development environment: Node.js runtime, local database instance, and a local proxy for Claude API calls.
- Microsoft Graph API (SharePoint connection) and Azure AD SSO require real tenant credentials even in local development. The developer must be granted access to Hummingbird's Microsoft 365 dev tenant or a designated test tenant before development begins. This is a hard dependency.
- Phase 1 exit condition: all five V1 modules functional and passing end-to-end test scenarios on the local machine.

**Phase 2 — GitHub Repository**

The complete project is migrated into a private GitHub repository owned by Hummingbird Healthcare.

- Repository scope: application source code, infrastructure-as-code (Azure Bicep templates for all Azure resources), environment configuration templates (.env.example with all required variables documented but no secrets committed), and project documentation.
- Repository visibility: private. Owned by the Hummingbird Healthcare GitHub organization. Developer granted Maintainer access for the duration of the engagement; ownership remains with Hummingbird Healthcare.
- No secrets (API keys, connection strings, credentials) are ever committed to the repository.
- Phase 2 exit condition: repository is clean, documented, and the application builds and runs correctly from a fresh clone with only environment variables configured.

**Phase 3 — Azure Deployment**

The application is deployed from the GitHub repository to the Azure environment defined in Section 12.4.

- All secrets migrated from local environment variables to Azure Key Vault, accessed via Managed Identity.
- Azure AD app registration updated to point to the production deployment URL. SharePoint permissions re-consented against the production tenant if not already done.
- Phase 3 exit condition: application accessible via browser from any Hummingbird team member machine, authenticated via Azure AD SSO, with SharePoint connectivity confirmed against the production tenant.

---

## 13. Appendix

### A. Glossary

| Term | Definition |
|---|---|
| Engagement | A single client consulting project. V1 supports one engagement per instance. |
| Core Config | The engagement-level configuration record defining all controlled vocabulary for metadata tagging. |
| Controlled Vocabulary | The fixed lists of permissible values for tag fields (workstreams, technologies, contact centers, etc.). Managed via Core Config. |
| Note | A raw record captured live in Interview Studio. Not a committed knowledge record until promoted. |
| Finding | A committed knowledge record representing an insight, observation, or data point. |
| Promotion | The act of converting a Note into a Finding, performed by the Engagement Lead. |
| Ingestion | The pipeline process of extracting structured knowledge from an uploaded artifact. |
| Metadata Suggestion | An AI-generated proposal to add or modify a value in the controlled vocabulary. |
| Pending Approval | A metadata suggestion awaiting action from the Engagement Lead. |
| Unclassified | Holding state for records that cannot be tagged after the deny-and-reconfirm pass. |
| KB / Knowledge Base | The full set of structured records in the knowledge model for an engagement. |
| kb.json | Serialized export of the full knowledge base used by the Knowledge Hub. |
| PHI | Protected Health Information — patient-identifiable data governed by HIPAA. |
| HH | Hummingbird Healthcare. |
| Microsoft Graph API | The unified API endpoint for Microsoft 365. Instinct uses Graph API to read/write SharePoint files, tag metadata, and subscribe to change notifications. |
| Watch Scope | The set of SharePoint folders and files Instinct monitors for new and modified content. |
| Instinct Created Documentation | The single SharePoint subfolder created by Instinct during setup. All Instinct write-back outputs stored here. |
| Change Notification | A webhook event from Graph API when a file in the watch scope is created or modified. Primary trigger for automatic ingestion. |
| Exclusion List | SharePoint files and folders Instinct will never ingest. Configured by Engagement Lead in Core Config. |
| PHI Flag | Per-artifact flag set by the Engagement Lead indicating the file must not be sent to the Claude API. |

### B. Entity Relationship Summary

- A **Finding** may link to: one source Artifact, one source Note, one or more Questions, one or more Assumptions/Gaps.
- A **Note** links to: one Interview Session, zero or more Questions. When promoted, links to the resulting Finding.
- A **Question** may link to: one or more Findings (answers), one or more Artifacts (where the answer was found).
- An **Artifact** links to: zero or more Findings, zero or more Question answers, zero or more Stakeholders.
- A **Stakeholder** links to: zero or more Findings (via provided_by), zero or more Interview Sessions.
- A **Decision/Action** links to: zero or more Findings, Questions, or Artifacts.
- An **Assumption/Gap** links to: zero or more Findings.
