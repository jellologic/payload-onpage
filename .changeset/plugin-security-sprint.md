---
'@payload-onpage/core': minor
'@payload-onpage/plugin': patch
---

Security hardening from an adversarial review of the plugin. The editor schema endpoint now returns 403 when collection/global update access is definitively denied (including when an access check throws, which previously served the schema unfiltered); `/mode` requires editing at least one enabled document; the CSRF guard refuses `sec-fetch-site: none`; `enter` and `preview-link` authenticate before parsing refs; the admin new-tab form uses `rel="noopener"`; an empty `secret` option fails at config time; and the marker cleaner drops `__proto__` keys. Removes the unused `SEAL_PURPOSE.editBinding` export.
