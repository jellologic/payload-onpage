# Localization

## Content locales

The editor edits one content locale: `<OnPage locale="es" />`, else the page's `<html lang>`. Reads, saves and the schema use it.

- Text edits apply to that locale only.
- Adding, moving or removing rows changes the shared structure, as in the admin. The dock says so when you're not editing the default locale.

## Editor UI strings

Every string the on-page editor shows is in `defaultMessages` (`@payload-onpage/react`). Override any subset:

```tsx
<OnPage messages={{ 'dock.publish': 'Publicar', 'dock.saved': 'Borrador guardado {ago}' }} />
```

Relative times use `Intl.RelativeTimeFormat` in the browser's language.

## Admin strings

"Edit on page" and "Copy preview link" use Payload's i18n (`onpage:*` keys) and follow the admin language. English, Spanish, French and German ship. Add or override others in your Payload config:

```ts
i18n: { translations: { it: { onpage: { editOnPage: 'Modifica nella pagina', copyPreviewLink: 'Copia link anteprima' } } } }
```

Field and block labels come from your Payload config, translated with Payload's `getTranslation` into the admin language.

---

_Found a bug? [Report it](https://github.com/jellologic/payload-onpage/issues/new?template=bug_report.yml) or see [CONTRIBUTING.md](https://github.com/jellologic/payload-onpage/blob/main/CONTRIBUTING.md) to fix it yourself._
