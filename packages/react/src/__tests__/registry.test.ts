import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import type { SchemaField, Target } from '@payload-onpage/core'
import { mergeEditors, resolveEditor } from '../registry.ts'
import { buildIndex } from '../targets.ts'
import type { EditorRegistry } from '../context.tsx'

const C = () => null
const reg: EditorRegistry = {
  text: { mode: 'inline', component: C },
  textarea: { mode: 'inline', component: C },
  email: { mode: 'inline', component: C },
  richText: { mode: 'inline', component: C },
  upload: { mode: 'popover', component: C },
  select: { mode: 'popover', component: C },
  color: { mode: 'popover', component: C },
}
const f = (type: string, extra: Partial<SchemaField> = {}): SchemaField => ({
  name: 'x',
  type,
  label: 'X',
  ...extra,
})

describe('resolveEditor', () => {
  it("prefers the field's own editor choice", () => {
    expect(resolveEditor(reg, f('text', { editor: 'color' }), 'text')).toBe('color')
  })
  it('ignores an unknown field choice', () => {
    expect(resolveEditor(reg, f('text', { editor: 'nope' }))).toBe('text')
  })
  it("uses the element's kind for rich text and media", () => {
    expect(resolveEditor(reg, f('richText'), 'richtext')).toBe('richText')
    expect(resolveEditor(reg, f('upload'), 'media')).toBe('upload')
  })
  it("doesn't open the image picker for a non-upload field marked as media", () => {
    expect(resolveEditor(reg, f('text'), 'media')).toBe('text')
  })
  it("keeps the field's textual type over the marker kind", () => {
    expect(resolveEditor(reg, f('email'), 'text')).toBe('email')
    expect(resolveEditor(reg, f('textarea'), 'text')).toBe('textarea')
  })
  it('falls back to the field type, or none', () => {
    expect(resolveEditor(reg, f('select'))).toBe('select')
    expect(resolveEditor(reg, f('json'))).toBeNull()
  })
  it('merges registries; null removes', () => {
    const merged = mergeEditors(reg, { select: null, json: { mode: 'popover', component: C } })
    expect(merged.select).toBeUndefined()
    expect(resolveEditor(merged, f('json'))).toBe('json')
  })
})

describe('buildIndex', () => {
  const doc = new Window().document as unknown as Document
  doc.body.innerHTML = `<h1 id="a">A</h1><p id="b">B</p>`
  const a = doc.getElementById('a')!
  const b = doc.getElementById('b')!
  const ref = { kind: 'collection' as const, slug: 'pages', id: 1 }
  const targets: Target[] = [
    { el: a, ref, path: 'title', kind: 'text', source: 'stega' },
    { el: b, ref, path: 'title', kind: 'text', source: 'annotation' },
  ]
  it('indexes by element and by path, annotations first', () => {
    const idx = buildIndex(targets)
    expect(idx.at(a)).toHaveLength(1)
    expect(idx.find('c:pages:1', 'title')?.el).toBe(b)
    expect(idx.find('c:pages:1', 'title', ['richtext'])).toBeUndefined()
  })
})
