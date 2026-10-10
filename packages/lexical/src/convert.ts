/**
 * Payload rich text ⇄ the inline editor's Lexical state. Node types we edit go
 * through as-is; everything else is wrapped in an OpaqueNode on the way in and
 * unwrapped on the way out, byte-for-byte.
 */
import { OPAQUE_TYPE } from './nodes.tsx';

export const EDITABLE_NODE_TYPES = new Set(['root', 'paragraph', 'heading', 'quote', 'list', 'listitem', 'text', 'linebreak', 'tab', 'link']);

type Node = Record<string, any>;
export interface RichTextState {
  root: Node;
}

export const EMPTY_STATE: RichTextState = {
  root: { type: 'root', version: 1, format: '', indent: 0, direction: null, children: [{ type: 'paragraph', version: 1, format: '', indent: 0, direction: null, children: [] }] },
};

function wrap(node: Node): Node {
  if (!node || typeof node !== 'object') return node;
  if (!EDITABLE_NODE_TYPES.has(node.type)) return { type: OPAQUE_TYPE, version: 1, data: node };
  return Array.isArray(node.children) ? { ...node, children: node.children.map(wrap) } : node;
}

function unwrap(node: Node): Node {
  if (!node || typeof node !== 'object') return node;
  if (node.type === OPAQUE_TYPE) return node.data;
  return Array.isArray(node.children) ? { ...node, children: node.children.map(unwrap) } : node;
}

export function isRichTextState(value: unknown): value is RichTextState {
  return !!value && typeof value === 'object' && (value as RichTextState).root?.type === 'root';
}

export function toEditorState(value: unknown): RichTextState {
  const state = isRichTextState(value) ? value : EMPTY_STATE;
  const root = wrap(state.root);
  // Lexical needs at least one block child to place a caret.
  if (!root.children?.length) root.children = EMPTY_STATE.root.children;
  return { root };
}

export function fromEditorState(state: RichTextState): RichTextState {
  return { root: unwrap(state.root) };
}

/** Plain text of a state (used to treat a blank editor as "no value"). */
export function plainText(state: RichTextState): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (typeof n?.text === 'string') parts.push(n.text);
    (n?.children ?? []).forEach(walk);
  };
  walk(state.root);
  return parts.join('').trim();
}
