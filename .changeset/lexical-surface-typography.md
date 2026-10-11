---
'@payload-onpage/lexical': patch
---

The inline rich-text surface now copies the edited element's typography (font, line height, color, spacing) instead of rendering in the editor UI's 13px. The surface lays out exactly over the original text, so the click point maps to the right block on any site; committed ghosts keep the same typography until the server render lands.
