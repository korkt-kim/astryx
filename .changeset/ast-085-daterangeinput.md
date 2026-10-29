---
'@astryxdesign/core': patch
---

[fix] DateRangeInput rejects calendar and preset changes after being disabled while its picker is open, without dismissing the picker or moving focus. Presets reflect the owner's disabled state and reason. Calendar days expose their disabled state and do not announce rejected selections; enabled selection and clear behavior remain unchanged.
@korkt-kim
