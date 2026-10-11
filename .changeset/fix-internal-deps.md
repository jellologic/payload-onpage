---
'@payload-onpage/core': patch
'@payload-onpage/react': patch
'@payload-onpage/lexical': patch
'@payload-onpage/plugin': patch
'@payload-onpage/next': patch
---

Fix 0.2.0's internal dependencies: its packages depended on each other at 0.1.0, so installs mixed 0.2.0 and 0.1.0 code. 0.2.1 pins every `@payload-onpage/*` dependency to the same version.
