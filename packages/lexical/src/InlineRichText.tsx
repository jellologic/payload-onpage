'use client';

/**
 * In-place rich-text editing with Lexical. The editable surface is laid over
 * the rendered element, takes its classes (so the site's prose styles apply)
 * and hides the original. Clicking outside, or "Done", commits; Escape cancels.
 * Only a real change is written: the value is compared with what the same
 * editor produced for the untouched content.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $findMatchingParent } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelectionFromDom,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  FORMAT_TEXT_COMMAND,
  type BaseSelection,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { HIDDEN, caretAt, placeOver, useEachFrame, type FieldEditorProps } from '@payload-onpage/react';
import { $createPayloadLinkNode, $isPayloadLinkNode, type PayloadLinkNode } from './nodes.tsx';
import { RICH_TEXT_NODES } from './nodeList.ts';
import { fromEditorState, plainText, toEditorState, type RichTextState } from './convert.ts';

export { RICH_TEXT_NODES };

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  block: string;
  link: boolean;
}

function readToolbarState(): ToolbarState {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return { bold: false, italic: false, underline: false, block: 'paragraph', link: false };
  const anchor = sel.anchor.getNode();
  const top = anchor.getKey() === 'root' ? anchor : anchor.getTopLevelElementOrThrow();
  const list = $findMatchingParent(anchor, $isListNode);
  const block = list ? `list-${list.getListType()}` : $isHeadingNode(top) ? top.getTag() : $isQuoteNode(top) ? 'quote' : 'paragraph';
  return {
    bold: sel.hasFormat('bold'),
    italic: sel.hasFormat('italic'),
    underline: sel.hasFormat('underline'),
    block,
    link: !!$findMatchingParent(anchor, $isPayloadLinkNode),
  };
}

/**
 * Pull the browser's current selection into Lexical. Keyboard-extended
 * selections (⌥⇧→ and friends) don't always reach Lexical's model before a
 * toolbar click, so every toolbar action syncs first and acts on what the user
 * actually sees selected.
 */
function syncSelection(editor: LexicalEditor) {
  const dom = window.getSelection();
  const root = editor.getRootElement();
  if (!dom || !root || !dom.anchorNode || !root.contains(dom.anchorNode)) return;
  editor.update(
    () => {
      const sel = $createRangeSelectionFromDom(dom, editor);
      if (sel) $setSelection(sel);
    },
    { discrete: true },
  );
}

/** The URL of the link around the selection, if any. */
function currentLinkUrl(editor: LexicalEditor): string | undefined {
  let url: string | undefined;
  editor.getEditorState().read(() => {
    const sel = $getSelection();
    if ($isRangeSelection(sel)) url = $findMatchingParent(sel.anchor.getNode(), $isPayloadLinkNode)?.getFields().url;
  });
  return url;
}

/** Link the selection to `url`; an empty url removes the link around it. */
function applyLink(editor: LexicalEditor, rawUrl: string, saved: BaseSelection | null) {
  const url = rawUrl.trim();
  editor.update(() => {
    // Focus moved to the URL field; put back the selection it was opened for.
    if (saved) $setSelection(saved.clone());
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return;
    const nodes = sel.extract();
    const existing = nodes.map((n) => $findMatchingParent(n, $isPayloadLinkNode)).find(Boolean) as PayloadLinkNode | undefined;
    if (existing) {
      if (!url) {
        for (const child of existing.getChildren()) existing.insertBefore(child);
        existing.remove();
      } else {
        existing.setFields({ ...existing.getFields(), url });
      }
      return;
    }
    if (!url) return;
    let link: PayloadLinkNode | null = null;
    for (const node of nodes) {
      if (!$isTextNode(node) || $findMatchingParent(node, $isPayloadLinkNode)) continue;
      if (!link || node.getPreviousSibling() !== link) {
        link = $createPayloadLinkNode({ url, newTab: /^https?:/.test(url), linkType: 'custom' });
        node.insertBefore(link);
      }
      link.append(node);
    }
  });
}

function Toolbar({ onDone }: { onDone: () => void }) {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>({ bold: false, italic: false, underline: false, block: 'paragraph', link: false });
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const savedSelection = useRef<BaseSelection | null>(null);
  const openLink = () => {
    editor.getEditorState().read(() => {
      savedSelection.current = $getSelection()?.clone() ?? null;
    });
    setLinkDraft(currentLinkUrl(editor) ?? 'https://');
  };
  const saveLink = () => {
    if (linkDraft === null) return;
    applyLink(editor, linkDraft === 'https://' ? '' : linkDraft, savedSelection.current);
    setLinkDraft(null);
    editor.focus();
  };
  useEffect(() => editor.registerUpdateListener(({ editorState }) => editorState.read(() => setState(readToolbarState()))), [editor]);

  const setBlock = (kind: 'paragraph' | 'h2' | 'h3' | 'quote') =>
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      const target = state.block === kind ? 'paragraph' : kind;
      $setBlocksType(sel, () => (target === 'paragraph' ? $createParagraphNode() : target === 'quote' ? $createQuoteNode() : $createHeadingNode(target)));
    });
  const list = (type: 'bullet' | 'number') => {
    if (state.block === `list-${type}`) editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    else editor.dispatchCommand(type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
  };
  const btn = (label: React.ReactNode, title: string, pressed: boolean, onClick: () => void, id: string) => (
    <button
      type="button"
      className="po-btn"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      data-testid={`onpage-rt-${id}`}
      onMouseDown={(e) => e.preventDefault() /* keep the editor's selection */}
      onClick={() => {
        syncSelection(editor);
        onClick();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="po-rt-toolbar" role="toolbar" aria-label="Text formatting">
      {btn(<b>B</b>, 'Bold', state.bold, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'), 'bold')}
      {btn(<i>I</i>, 'Italic', state.italic, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'), 'italic')}
      {btn(<u>U</u>, 'Underline', state.underline, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline'), 'underline')}
      {btn('🔗', 'Link', state.link, openLink, 'link')}
      {btn('H2', 'Heading 2', state.block === 'h2', () => setBlock('h2'), 'h2')}
      {btn('H3', 'Heading 3', state.block === 'h3', () => setBlock('h3'), 'h3')}
      {btn('•', 'Bulleted list', state.block === 'list-bullet', () => list('bullet'), 'ul')}
      {btn('1.', 'Numbered list', state.block === 'list-number', () => list('number'), 'ol')}
      {btn('❝', 'Quote', state.block === 'quote', () => setBlock('quote'), 'quote')}
      {btn('↶', 'Undo', false, () => editor.dispatchCommand(UNDO_COMMAND, undefined), 'undo')}
      {btn('↷', 'Redo', false, () => editor.dispatchCommand(REDO_COMMAND, undefined), 'redo')}
      {btn('Done', 'Done', false, onDone, 'done')}
      {linkDraft !== null && (
        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
          <input
            className="po-input"
            style={{ width: 260, height: 28 }}
            value={linkDraft}
            autoFocus
            placeholder="https://… or /page (empty removes the link)"
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setLinkDraft(null);
              }
            }}
            data-testid="onpage-rt-link-input"
          />
          <button type="button" className="po-btn" onMouseDown={(e) => e.preventDefault()} onClick={saveLink} data-testid="onpage-rt-link-apply">
            Apply
          </button>
        </span>
      )}
    </div>
  );
}

/**
 * Grabs the editor instance and puts the caret where the user clicked —
 * through Lexical's own selection (setting only the DOM selection leaves
 * Lexical's model at the end of the text, so keys and toolbar act there).
 */
function Bridge({ editorRef, point, baseline }: { editorRef: React.MutableRefObject<LexicalEditor | null>; point?: { x: number; y: number }; baseline: React.MutableRefObject<string | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
    baseline.current = JSON.stringify(editor.getEditorState().toJSON());
    const root = editor.getRootElement();
    if (!root) return;
    // Wait two frames so the surface sits exactly over the original text.
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => {
      const hit = point ? caretAt(point, root) : null;
      editor.update(() => {
        const node = hit ? $getNearestNodeFromDOMNode(hit.node) : null;
        if (node && $isTextNode(node)) node.select(hit!.offset, hit!.offset);
        else $getRoot().selectEnd();
      });
      root.focus({ preventScroll: true });
    })));
    return () => cancelAnimationFrame(raf);
  }, [editor, editorRef, point, baseline]);
  return null;
}

export function InlineRichText({ field, value, element, commit, close, ghost, live, point }: FieldEditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const baseline = useRef<string | null>(null);
  const done = useRef(false);
  const [className, setClassName] = useState('');
  const initialState = useMemo(() => JSON.stringify(toEditorState(value)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = element();
    if (el) {
      setClassName(typeof el.className === 'string' ? el.className : '');
      // Position before first paint, so the caret hit-test finds the surface.
      if (box.current) placeOver(box.current, el);
      el.setAttribute(HIDDEN, 'true');
    }
    return () => element()?.removeAttribute(HIDDEN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the original element's box as the page scrolls and reflows.
  useEachFrame(() => {
    const el = element();
    if (!el || !box.current) return;
    if (!el.hasAttribute(HIDDEN)) el.setAttribute(HIDDEN, 'true');
    placeOver(box.current, el);
  });

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const editor = editorRef.current;
    if (save && editor) {
      const json = editor.getEditorState().toJSON() as unknown as RichTextState;
      if (JSON.stringify(json) !== baseline.current) {
        const next = fromEditorState(json);
        commit(plainText(next) || hasOpaque(next) ? next : null);
        const surface = editor.getRootElement();
        if (!live && surface) ghost({ html: surface.innerHTML, className });
      }
    }
    close();
  };

  // Commit when the user clicks anywhere outside the editor.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) finish(true);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  });

  return (
    <div
      ref={box}
      className="po-rt"
      data-testid="onpage-inline-richtext"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }}
    >
      <LexicalComposer
        initialConfig={{
          namespace: 'payload-onpage',
          nodes: RICH_TEXT_NODES,
          editorState: initialState,
          onError: (error) => console.error('[payload-onpage] rich text', error),
          theme: { text: { bold: 'po-b', italic: 'po-i', underline: 'po-u' } },
        }}
      >
        <Toolbar onDone={() => finish(true)} />
        <RichTextPlugin
          contentEditable={<ContentEditable className={`${className} po-rt-surface`} aria-label={`Edit ${field.label}`} />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <Bridge editorRef={editorRef} point={point} baseline={baseline} />
      </LexicalComposer>
    </div>
  );
}

function hasOpaque(state: RichTextState): boolean {
  let found = false;
  const walk = (n: any) => {
    if (!n || found) return;
    if (n.type !== 'root' && n.type !== 'paragraph' && n.type !== 'text' && !n.children) found = n.type !== 'linebreak';
    (n.children ?? []).forEach(walk);
  };
  walk(state.root);
  return found;
}
