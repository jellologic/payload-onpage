/**
 * Every string the editor shows, with English defaults. Override any subset
 * with the `messages` prop (e.g. from your site's translations). `{name}`
 * placeholders are filled from the variables passed to `t()`.
 */
export const defaultMessages = {
  'dock.label': 'Page editor',
  'dock.loading': 'Loading editor…',
  'dock.unavailable': '{doc}: {error}',
  'dock.saveFailed': '{doc}: {message}',
  'dock.nothing': 'Nothing editable on this page',
  'dock.conflict': '{doc}: changed by someone else',
  'dock.saving': 'Saving draft…',
  'dock.updating': 'Updating page…',
  'dock.saved': 'Draft saved {ago}',
  'dock.editing': 'Editing draft',
  'dock.documents': '{count} documents',
  'dock.localeNotice':
    'Editing {locale}: text changes apply to this language only; adding, moving or removing sections changes every language.',
  'dock.reload': 'Reload latest',
  'dock.retry': 'Retry',
  'dock.undo': 'Undo',
  'dock.redo': 'Redo',
  'dock.preview': 'Preview',
  'dock.previewHint': 'See the draft without editing tools',
  'dock.share': 'Share',
  'dock.shareHint': 'Copy a read-only link to this draft',
  'dock.discard': 'Discard',
  'dock.discardConfirm': 'Confirm discard?',
  'dock.discardHint': 'Throw away draft changes and return to the published content',
  'dock.admin': 'Admin',
  'dock.exit': 'Exit',
  'dock.publish': 'Publish',
  'dock.publishing': 'Publishing…',
  'notify.published': 'Published ✓',
  'notify.nothingToPublish': 'Nothing to publish',
  'notify.publishFailed': 'Publish failed: {message}',
  'notify.discarded': 'Draft reset to the published version',
  'notify.linkCopied': 'Preview link copied — valid until {date}',
  'notify.linkFailed': "Couldn't create a preview link: {message}",
  'notify.loading': 'Loading the editor…',
  'notify.cantEdit': "Can't edit: {message}",
  'row.moveUp': 'Move up',
  'row.moveDown': 'Move down',
  'row.duplicate': 'Duplicate',
  'row.settings': 'Settings',
  'row.delete': 'Delete (undo with ⌘Z)',
  'row.addSection': 'Add section',
  'row.addSectionAbove': 'Add section above',
  'row.addSectionBelow': 'Add section below',
  'row.addFirstSection': 'Add a section',
  'row.addItem': 'Add {item}',
  'row.toolbar': '{label} actions',
  'settings.title': '{label} settings',
  'settings.close': 'Close settings',
  'settings.chooseImage': 'Choose image…',
  'settings.changeImage': 'Change image…',
  'blocks.title': 'Add section',
  'common.close': 'Close',
  'common.apply': 'Apply',
  'common.clear': 'Clear',
  'common.remove': 'Remove',
  'common.removeItem': 'Remove {item}',
  'common.none': '—',
  'common.selected': '{count} selected',
  'search.placeholder': 'Search…',
  'search.unsupported': "This data source can't search documents.",
  'media.search': 'Search images…',
  'media.upload': 'Upload…',
  'media.empty': 'No images found.',
  'media.more': 'Load more',
  'media.loading': 'Loading…',
  'inline.label': 'Edit {field}',
  'preview.label': 'Draft preview',
  'preview.badge': 'Draft',
  'preview.shared': 'Shared preview — not published yet',
  'preview.own': 'Previewing the draft',
  'preview.phone': 'Phone',
  'preview.tablet': 'Tablet',
  'preview.desktop': 'Desktop',
  'preview.edit': 'Edit',
  'preview.exit': 'Exit',
  'preview.viewPublished': 'View published',
  'rt.toolbar': 'Text formatting',
  'rt.bold': 'Bold',
  'rt.italic': 'Italic',
  'rt.underline': 'Underline',
  'rt.link': 'Link',
  'rt.linkApply': 'Apply',
  'rt.h2': 'Heading 2',
  'rt.h3': 'Heading 3',
  'rt.ul': 'Bulleted list',
  'rt.ol': 'Numbered list',
  'rt.quote': 'Quote',
  'rt.done': 'Done',
  'rt.linkPlaceholder': 'https://… or /page (empty removes the link)',
  'rt.linkInvalid': 'Use an https://, mailto:, tel: or relative link',
} as const

export type MessageKey = keyof typeof defaultMessages
export type Messages = Partial<Record<MessageKey, string>>

/** The {placeholders} of a message: `Placeholders<'Saved {when}'>` is `'when'`. */
export type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Placeholders<Rest>
  : never

/** The variables a message needs, by key. */
export type MessageVars<K extends MessageKey> = Record<
  Placeholders<(typeof defaultMessages)[K]>,
  string | number
>

/**
 * Translate a message key. A message with placeholders requires exactly those
 * variables (`t('dock.saved', { ago })`); one without takes none. Unknown keys
 * don't compile: show raw text without `t`.
 */
export type Translate = <K extends MessageKey>(
  key: K,
  ...vars: [Placeholders<(typeof defaultMessages)[K]>] extends [never] ? [] : [vars: MessageVars<K>]
) => string

export function createTranslate(overrides: Messages = {}): Translate {
  const table: Record<string, string> = { ...defaultMessages, ...overrides }
  return (key: string, vars?: Record<string, string | number>) => {
    const template = table[key] ?? key
    return vars
      ? template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
      : template
  }
}

/** "5 seconds ago", "2 minutes ago", in the browser's language. */
export function relativeTime(ts: number, now = Date.now(), locale?: string): string {
  const s = Math.round((ts - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(s) < 60) return rtf.format(s, 'second')
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute')
  return rtf.format(Math.round(s / 3600), 'hour')
}
