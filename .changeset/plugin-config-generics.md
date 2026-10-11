---
'@payload-onpage/plugin': patch
---

`onpage()` now accepts Payload v3 and v4 configs (it is typed as a generic config passthrough), so the same plugin registers on both the Next.js (Payload 3) and TanStack Start (Payload 4 beta) setups. No behavior change.
