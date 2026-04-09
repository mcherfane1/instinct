/**
 * Session export utilities — Markdown and JSON formats.
 */

/**
 * Export session canvas as a Markdown file.
 * Uses canvas_text (plain text) as the content source.
 */
export function exportSessionMarkdown(session) {
  const lines = [];

  lines.push(`# ${session.name}`);
  lines.push('');

  if (session.date) lines.push(`**Date:** ${session.date}`);
  if (session.workstream) lines.push(`**Workstream:** ${session.workstream}`);
  if (session.contact_center) lines.push(`**Contact Center:** ${session.contact_center}`);

  const participants = Array.isArray(session.participants)
    ? session.participants
    : JSON.parse(session.participants || '[]');
  if (participants.length > 0) {
    lines.push(`**Participants:** ${participants.join(', ')}`);
  }

  if (session.elapsed_seconds) {
    lines.push(`**Duration:** ${formatElapsed(session.elapsed_seconds)}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  if (session.canvas_text) {
    lines.push(session.canvas_text);
  } else {
    lines.push('*(No content)*');
  }

  const content = lines.join('\n');
  downloadFile(
    `${slugify(session.name)}.md`,
    content,
    'text/markdown'
  );
}

/**
 * Export full session state as JSON.
 */
export function exportSessionJSON(session) {
  const data = {
    session_id:      session.session_id,
    engagement_id:   session.engagement_id,
    name:            session.name,
    date:            session.date,
    participants:    Array.isArray(session.participants)
                       ? session.participants
                       : JSON.parse(session.participants || '[]'),
    workstream:      session.workstream,
    contact_center:  session.contact_center,
    status:          session.status,
    elapsed_seconds: session.elapsed_seconds,
    created_at:      session.created_at,
    updated_at:      session.updated_at,
    canvas_content:  typeof session.canvas_content === 'string'
                       ? JSON.parse(session.canvas_content || 'null')
                       : session.canvas_content,
    canvas_text:     session.canvas_text,
    exported_at:     new Date().toISOString(),
  };

  downloadFile(
    `${slugify(session.name)}.json`,
    JSON.stringify(data, null, 2),
    'application/json'
  );
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
