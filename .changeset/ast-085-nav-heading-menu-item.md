---
'@astryxdesign/core': patch
---

[fix] Keep disabled NavHeadingMenuItem links focused and non-navigating, including with LinkProvider. Disabled action rows also suppress selection, click-capture, auxiliary-click, and double-click callbacks while preserving focus/hover observation and caller-rendered child events. Disabled items retain tabIndex=-1 instead of becoming new Tab stops; menu arrow navigation is unchanged.
@korkt-kim
