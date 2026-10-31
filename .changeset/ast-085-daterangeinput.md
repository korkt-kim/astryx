---
'@astryxdesign/core': patch
---

[fix] DateRangeInput rejects selections from an already-open disabled picker without dismissing it, moving focus, or announcing a rejected range. Picker availability is exposed without changing date constraints or month-grid Tab stops. Enabled selection, clear behavior, and loading-only dismissal remain unchanged.
@korkt-kim
