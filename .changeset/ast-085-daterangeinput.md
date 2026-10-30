---
'@astryxdesign/core': patch
---

[fix] DateRangeInput rejects calendar and preset changes after being disabled while its picker is open, without dismissing the picker or moving focus. Presets reflect the owner's disabled state and reason. Calendar days expose their disabled state and do not announce rejected selections. Each month retains its existing Tab stop when all days become disabled, including when focus is on a preset; enabled selection and clear behavior remain unchanged.
@korkt-kim
