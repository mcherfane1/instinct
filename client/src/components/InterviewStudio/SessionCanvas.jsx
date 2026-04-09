/**
 * SessionCanvas — TipTap-powered rich text editor.
 *
 * Formatting supported:
 *   Bold, Italic, Underline, Text Color, Highlight, Bullet List,
 *   Numbered List, Indent/Outdent, Heading 1/2/3
 *
 * Inline prefix commands (detected on current line):
 *   ?       → Question candidate
 *   !       → Finding candidate
 *   Action: → Action item
 *   D:      → Decision
 *
 * When the cursor is on a prefixed line a "Promote" button appears
 * in the gutter, allowing the user to promote the line to a structured record.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit     from '@tiptap/starter-kit';
import Underline      from '@tiptap/extension-underline';
import TextStyle      from '@tiptap/extension-text-style';
import Color          from '@tiptap/extension-color';
import Highlight      from '@tiptap/extension-highlight';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListBulletIcon,
  QueueListIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';

import PromoteFindingModal from './PromoteFindingModal';

// Prefix pattern → record type map
const PREFIX_PATTERNS = [
  { prefix: /^\?\s+/, type: 'Question',   label: '?',       color: 'text-blue-600 bg-blue-50' },
  { prefix: /^!\s+/,  type: 'Finding',    label: '!',       color: 'text-orange-600 bg-orange-50' },
  { prefix: /^Action:\s+/i, type: 'Action',   label: 'Action:', color: 'text-purple-600 bg-purple-50' },
  { prefix: /^D:\s+/i,      type: 'Decision', label: 'D:',      color: 'text-green-600 bg-green-50' },
];

const TEXT_COLORS = [
  { label: 'Default',  value: null },
  { label: 'Red',      value: '#ef4444' },
  { label: 'Orange',   value: '#f97316' },
  { label: 'Blue',     value: '#3b82f6' },
  { label: 'Green',    value: '#22c55e' },
  { label: 'Purple',   value: '#a855f7' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow',  value: '#fef08a' },
  { label: 'Green',   value: '#bbf7d0' },
  { label: 'Blue',    value: '#bfdbfe' },
  { label: 'Pink',    value: '#fbcfe8' },
];

export default function SessionCanvas({ session, onChange, readOnly, engagementId }) {
  const [showColorMenu, setShowColorMenu]   = useState(false);
  const [showHighlight, setShowHighlight]   = useState(false);
  const [prefixInfo, setPrefixInfo]         = useState(null); // { type, text, color, label }
  const [showPromote, setShowPromote]       = useState(false);
  const [promoteText, setPromoteText]       = useState('');
  const [promoteType, setPromoteType]       = useState('Finding');

  // Parse initial content
  const initialContent = session.canvas_content
    ? (typeof session.canvas_content === 'string'
        ? JSON.parse(session.canvas_content)
        : session.canvas_content)
    : { type: 'doc', content: [{ type: 'paragraph' }] };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = editor.getText();
      onChange(JSON.stringify(json), text);
      detectPrefix(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      detectPrefix(editor);
    },
  });

  // Detect prefix command on current paragraph
  function detectPrefix(ed) {
    if (!ed) return;
    const { from } = ed.state.selection;
    const node = ed.state.doc.nodeAt(Math.max(0, from - 1));

    // Get the text of the paragraph containing the cursor
    let paragraphText = '';
    ed.state.doc.nodesBetween(from - 1, from, (n) => {
      if (n.type.name === 'paragraph' || n.type.name === 'listItem') {
        paragraphText = n.textContent;
        return false;
      }
    });

    const match = PREFIX_PATTERNS.find(p => p.prefix.test(paragraphText));
    if (match) {
      const text = paragraphText.replace(match.prefix, '').trim();
      setPrefixInfo({ type: match.type, label: match.label, color: match.color, text });
    } else {
      setPrefixInfo(null);
    }
  }

  function openPromoteModal() {
    if (!prefixInfo) return;
    setPromoteText(prefixInfo.text);
    setPromoteType(prefixInfo.type);
    setShowPromote(true);
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      {/* Formatting toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
          <ToolbarGroup>
            <ToolbarButton
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold (Ctrl+B)"
            >
              <BoldIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic (Ctrl+I)"
            >
              <ItalicIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup>
            <ToolbarButton
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
            >
              <span className="text-[10px] font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              <span className="text-[10px] font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
            >
              <span className="text-[10px] font-bold">H3</span>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarDivider />

          <ToolbarGroup>
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
            >
              <ListBulletIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Numbered List"
            >
              <QueueListIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
              disabled={!editor.can().sinkListItem('listItem')}
              title="Indent"
            >
              <span className="text-[10px]">→</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
              disabled={!editor.can().liftListItem('listItem')}
              title="Outdent"
            >
              <span className="text-[10px]">←</span>
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarDivider />

          {/* Text color */}
          <div className="relative">
            <ToolbarButton onClick={() => { setShowColorMenu(m => !m); setShowHighlight(false); }} title="Text Color">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold leading-none">A</span>
                <div className="h-0.5 w-3 rounded-full mt-0.5" style={{
                  backgroundColor: editor.getAttributes('textStyle').color || '#374151'
                }} />
              </div>
            </ToolbarButton>
            {showColorMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 grid grid-cols-3 gap-1 w-36">
                {TEXT_COLORS.map(c => (
                  <button key={c.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 text-xs"
                    onClick={() => {
                      if (c.value) editor.chain().focus().setColor(c.value).run();
                      else editor.chain().focus().unsetColor().run();
                      setShowColorMenu(false);
                    }}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0 border border-gray-200"
                      style={{ backgroundColor: c.value || '#374151' }} />
                    <span className="text-gray-600">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="relative">
            <ToolbarButton onClick={() => { setShowHighlight(m => !m); setShowColorMenu(false); }} title="Highlight">
              <SwatchIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            {showHighlight && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 grid grid-cols-2 gap-1 w-32">
                <button
                  className="col-span-2 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 text-left rounded hover:bg-gray-50"
                  onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlight(false); }}
                >
                  Remove
                </button>
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-50 text-xs"
                    onClick={() => {
                      editor.chain().focus().setHighlight({ color: c.value }).run();
                      setShowHighlight(false);
                    }}
                  >
                    <span className="w-3 h-3 rounded shrink-0 border border-gray-200"
                      style={{ backgroundColor: c.value }} />
                    <span className="text-gray-600">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <ToolbarDivider />

          <ToolbarGroup>
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
            >
              <ArrowUturnRightIcon className="h-3.5 w-3.5" />
            </ToolbarButton>
          </ToolbarGroup>
        </div>
      )}

      {/* Prefix command indicator */}
      {prefixInfo && !readOnly && (
        <div className={`flex items-center gap-2 px-4 py-1.5 border-b border-gray-100 text-xs ${prefixInfo.color}`}>
          <span className="font-bold">{prefixInfo.label}</span>
          <span className="flex-1 truncate opacity-75">{prefixInfo.text}</span>
          <button
            onClick={openPromoteModal}
            className="font-semibold underline hover:no-underline"
          >
            Promote to {prefixInfo.type}
          </button>
        </div>
      )}

      {/* Inline bubble menu for quick promote */}
      {editor && !readOnly && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}
          shouldShow={({ editor, state }) => {
            const { from, to } = state.selection;
            return to > from && to - from > 3;
          }}
        >
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5">
            <span className="text-xs text-gray-500 mr-1">Promote as:</span>
            {['Finding', 'Question', 'Action', 'Decision'].map(type => (
              <button key={type}
                className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:bg-hbird-50 hover:border-hbird-300 hover:text-hbird-700 transition-colors"
                onClick={() => {
                  const text = editor.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    ' '
                  );
                  setPromoteText(text);
                  setPromoteType(type);
                  setShowPromote(true);
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={() => { setShowColorMenu(false); setShowHighlight(false); }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-8 py-6 min-h-full focus:outline-none interview-canvas"
        />
        {readOnly && (
          <div className="px-8 pb-4">
            <p className="text-xs text-gray-400 italic">This session is closed and read-only.</p>
          </div>
        )}
      </div>

      {/* Prefix shortcuts help */}
      {!readOnly && (
        <div className="px-4 py-1.5 border-t border-gray-100 bg-gray-50 shrink-0">
          <p className="text-[10px] text-gray-400">
            Prefix shortcuts: <span className="text-blue-500 font-mono">? </span>Question ·{' '}
            <span className="text-orange-500 font-mono">! </span>Finding ·{' '}
            <span className="text-purple-500 font-mono">Action: </span>Action ·{' '}
            <span className="text-green-500 font-mono">D: </span>Decision
          </p>
        </div>
      )}

      {/* Promote modal */}
      {showPromote && (
        <PromoteFindingModal
          engagementId={engagementId}
          session={session}
          initialText={promoteText}
          initialType={promoteType}
          onClose={() => setShowPromote(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar sub-components
// ---------------------------------------------------------------------------

function ToolbarButton({ children, onClick, active, disabled, title }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`
        flex items-center justify-center w-7 h-7 rounded text-sm transition-colors
        ${active   ? 'bg-hbird-100 text-hbird-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />;
}
