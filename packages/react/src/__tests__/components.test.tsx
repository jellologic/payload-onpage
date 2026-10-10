// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DataSource, DocumentSchema, SchemaField } from '@payload-onpage/core'
import { createTranslate, defaultMessages, relativeTime } from '../messages.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PreviewToolbar } from '../ui/PreviewToolbar.tsx'
import { SelectEditor } from '../editors/SelectEditor.tsx'
import { NumberEditor } from '../editors/NumberEditor.tsx'
import { ColorEditor } from '../editors/ColorEditor.tsx'
import { DateEditor } from '../editors/DateEditor.tsx'
import { CheckboxEditor } from '../editors/CheckboxEditor.tsx'
import type { FieldEditorProps } from '../types.ts'

const t = createTranslate()

function editorProps(field: Partial<SchemaField> & { type: string }, value: unknown = null) {
  const commit = vi.fn()
  const close = vi.fn()
  const preview = vi.fn()
  const anchor = document.createElement('span')
  document.body.appendChild(anchor)
  const props: FieldEditorProps = {
    docKey: 'c:pages:1',
    path: 'x',
    field: { name: 'x', label: 'X', ...field },
    element: () => anchor,
    value,
    commit,
    preview,
    close,
    ghost: vi.fn(),
    live: true,
    t,
  }
  return { props, commit, close, preview }
}

describe('messages', () => {
  it('fills placeholders, keeps unknown keys, accepts overrides', () => {
    expect(t('dock.documents', { count: 3 })).toBe('3 documents')
    expect(t('Plain text')).toBe('Plain text')
    expect(createTranslate({ 'dock.publish': 'Publicar' })('dock.publish')).toBe('Publicar')
    expect(Object.keys(defaultMessages).length).toBeGreaterThan(50)
  })
  it('formats relative time', () => {
    expect(relativeTime(Date.now() - 5000, Date.now(), 'en')).toMatch(/5 seconds ago|now/)
    expect(relativeTime(Date.now() - 120_000, Date.now(), 'en')).toBe('2 minutes ago')
  })
})

describe('Dialog', () => {
  it('is labelled, focuses inside, traps Tab and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="Settings" onClose={onClose} t={t}>
        <input aria-label="first" />
        <button type="button">last</button>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    screen.getByText('last').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('restores focus to where it was', () => {
    const before = document.createElement('button')
    document.body.appendChild(before)
    before.focus()
    const { unmount } = render(
      <Dialog title="x" onClose={() => {}} t={t}>
        x
      </Dialog>,
    )
    unmount()
    expect(document.activeElement).toBe(before)
  })
})

describe('field editors', () => {
  it('select: picks one and closes; hasMany toggles', () => {
    const one = editorProps(
      {
        type: 'select',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
      'a',
    )
    render(<SelectEditor {...one.props} />)
    fireEvent.click(screen.getByTestId('onpage-option-b'))
    expect(one.commit).toHaveBeenCalledWith('b')
    expect(one.close).toHaveBeenCalled()
  })
  it('select hasMany keeps option order and stays open', () => {
    const many = editorProps(
      {
        type: 'select',
        hasMany: true,
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
      ['b'],
    )
    render(<SelectEditor {...many.props} />)
    fireEvent.click(screen.getByTestId('onpage-option-a'))
    expect(many.commit).toHaveBeenCalledWith(['a', 'b'])
    expect(many.close).not.toHaveBeenCalled()
  })
  it('number: previews live, commits a number on Apply', () => {
    const n = editorProps({ type: 'number', min: 0, max: 10 }, 2)
    render(<NumberEditor {...n.props} />)
    fireEvent.change(screen.getByTestId('onpage-number-input'), { target: { value: '7' } })
    expect(n.preview).toHaveBeenCalledWith(7)
    expect(screen.getByTestId('onpage-number-slider')).toBeTruthy()
    fireEvent.click(screen.getByTestId('onpage-apply'))
    expect(n.commit).toHaveBeenCalledWith(7)
  })
  it('color: rejects an invalid hex', () => {
    const c = editorProps({ type: 'text', editor: 'color' }, '#fff')
    render(<ColorEditor {...c.props} />)
    fireEvent.change(screen.getByTestId('onpage-color-input'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByTestId('onpage-apply'))
    expect(c.commit).not.toHaveBeenCalled()
    expect(c.close).toHaveBeenCalled()
  })
  it('date: stores a date at local noon as ISO', () => {
    const d = editorProps({ type: 'date' })
    render(<DateEditor {...d.props} />)
    fireEvent.change(screen.getByTestId('onpage-date-input'), { target: { value: '2026-12-25' } })
    fireEvent.click(screen.getByTestId('onpage-apply'))
    expect(new Date(d.commit.mock.calls[0][0] as string).getHours()).toBe(12)
  })
  it('checkbox: toggles and closes', () => {
    const c = editorProps({ type: 'checkbox' }, false)
    render(<CheckboxEditor {...c.props} />)
    fireEvent.click(screen.getByTestId('onpage-checkbox-input'))
    expect(c.commit).toHaveBeenCalledWith(true)
  })
})

describe('PreviewToolbar', () => {
  it('offers Edit to editors, and only "View published" to link viewers', () => {
    const { unmount } = render(
      <PreviewToolbar exitHref="/api/onpage/exit" editHref="/api/onpage/mode?mode=edit" />,
    )
    expect(screen.getByTestId('onpage-edit')).toBeTruthy()
    expect(screen.getByText('Previewing the draft')).toBeTruthy()
    unmount()
    render(<PreviewToolbar exitHref="/api/onpage/exit" shared />)
    expect(screen.queryByTestId('onpage-edit')).toBeNull()
    expect(screen.getByText('View published')).toBeTruthy()
    expect(screen.getByTestId('onpage-exit-preview').closest('form')?.getAttribute('method')).toBe(
      'post',
    )
  })
})

// ── the editor shell, end to end against a fake DataSource ───────────────────
const schema: DocumentSchema = {
  kind: 'collection',
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  editable: ['title', 'items'],
  drafts: true,
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    {
      name: 'items',
      type: 'array',
      label: 'Items',
      labels: { singular: 'Item', plural: 'Items' },
      fields: [{ name: 'label', type: 'text', label: 'Label' }],
    },
  ],
}

function fakeSource(overrides: Partial<DataSource> = {}) {
  const saves: unknown[] = []
  const ds: DataSource = {
    loadSchema: async () => schema,
    loadDocument: async () => ({
      id: 1,
      updatedAt: 'v0',
      title: 'Hello',
      items: [
        { id: 'a', label: 'One' },
        { id: 'b', label: 'Two' },
      ],
    }),
    saveDraft: async (_ref, data) => {
      saves.push(data)
      return { ok: true, updatedAt: `v${saves.length}` }
    },
    publish: async () => ({ ok: true }),
    ...overrides,
  }
  return { ds, saves }
}

function page() {
  document.body.innerHTML = `
    <main>
      <h1 data-onpage-ref="c:pages:1" data-onpage-field="title" data-onpage-kind="text">Hello</h1>
      <ul data-onpage-ref="c:pages:1" data-onpage-list="items">
        <li data-onpage-ref="c:pages:1" data-onpage-row="items.0">One</li>
        <li data-onpage-ref="c:pages:1" data-onpage-row="items.1">Two</li>
      </ul>
    </main>`
}

describe('OnPageEditor', () => {
  async function mount(ds: DataSource) {
    const { OnPageEditor } = await import('../editor/OnPageEditor.tsx')
    page()
    const container = document.createElement('div')
    document.body.appendChild(container)
    render(<OnPageEditor dataSource={ds} links={{ exit: '/exit' }} autosaveDelay={0} />, {
      container,
    })
    await waitFor(() =>
      expect(screen.getByTestId('onpage-status').textContent).toBe('Editing draft'),
    )
  }

  it('click a field, type, commit: the change is saved', async () => {
    const { ds, saves } = fakeSource()
    await mount(ds)
    fireEvent.click(document.querySelector('h1')!)
    const inline = await screen.findByTestId('onpage-inline-text')
    inline.textContent = 'Hello world'
    fireEvent.input(inline)
    fireEvent.keyDown(inline, { key: 'Enter' })
    await waitFor(() => expect(saves).toEqual([{ title: 'Hello world' }]))
    expect(screen.queryByTestId('onpage-inline-text')).toBeNull()
  })

  it('keyboard: targets are focusable; ⌥↓ moves the focused row; ⌘Z undoes', async () => {
    const { ds, saves } = fakeSource()
    await mount(ds)
    const first = document.querySelector('li')!
    await waitFor(() => expect(first.getAttribute('tabindex')).toBe('0'))
    act(() => first.focus())
    fireEvent.keyDown(first, { key: 'ArrowDown', altKey: true })
    await waitFor(() =>
      expect(saves.at(-1)).toMatchObject({ items: [{ label: 'Two' }, { label: 'One' }] }),
    )
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true })
    await waitFor(() =>
      expect(saves.at(-1)).toMatchObject({ items: [{ label: 'One' }, { label: 'Two' }] }),
    )
  })

  it('shows a publish failure instead of getting stuck', async () => {
    const { ds } = fakeSource({
      publish: async () => ({ ok: false, status: 400, message: 'Title is required' }),
    })
    await mount(ds)
    fireEvent.click(document.querySelector('h1')!)
    const inline = await screen.findByTestId('onpage-inline-text')
    inline.textContent = ''
    fireEvent.keyDown(inline, { key: 'Enter' })
    fireEvent.click(screen.getByTestId('onpage-publish'))
    await waitFor(() =>
      expect(screen.getByTestId('onpage-status').textContent).toMatch(/Title is required/),
    )
    expect(screen.getByTestId<HTMLButtonElement>('onpage-publish').disabled).toBe(false)
  })

  it('reports a load failure with a retry', async () => {
    let fail = true
    const { ds } = fakeSource({
      loadSchema: async () => (fail ? Promise.reject(new Error('offline')) : schema),
    })
    const { OnPageEditor } = await import('../editor/OnPageEditor.tsx')
    page()
    render(<OnPageEditor dataSource={ds} links={{ exit: '/exit' }} />)
    await waitFor(() => expect(screen.getByTestId('onpage-status').textContent).toMatch(/offline/))
    fail = false
    fireEvent.click(screen.getByTestId('onpage-retry'))
    await waitFor(() =>
      expect(screen.getByTestId('onpage-status').textContent).toBe('Editing draft'),
    )
  })
})
