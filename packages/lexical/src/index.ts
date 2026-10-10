/**
 * @payload-onpage/lexical — inline rich-text editing for Payload's Lexical
 * richText fields. Add it to the editor registry:
 *
 *   <OnPageEditor editors={lexicalEditors} … />   // the Next adapter includes it by default
 *
 * The editor reads and writes Payload's Lexical JSON. Links keep Payload's
 * shape; nodes it doesn't edit (uploads, blocks, relationships…) are kept
 * as-is and shown as placeholders.
 */
import type { EditorRegistry } from '@payload-onpage/react';
import { InlineRichText } from './InlineRichText.tsx';

export const lexicalEditors: EditorRegistry = {
  richText: { mode: 'inline', component: InlineRichText },
};

export { InlineRichText, RICH_TEXT_NODES } from './InlineRichText.tsx';
export { toEditorState, fromEditorState, plainText, type RichTextState } from './convert.ts';
export { PayloadLinkNode, OpaqueNode, $createPayloadLinkNode, $isPayloadLinkNode } from './nodes.tsx';
