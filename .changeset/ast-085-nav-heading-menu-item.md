---
'@astryxdesign/core': patch
---

[fix] Keep disabled NavHeadingMenuItem links focused and non-navigating, including with LinkProvider. Disabled items retain tabIndex=-1 instead of becoming new Tab stops; menu arrow navigation is unchanged.
@korkt-kim
