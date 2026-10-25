---
'@astryxdesign/core': patch
---

[fix] BaseTypeahead keeps disabled inputs focusable without native `disabled`, preserving their existing Tab order and focus when disabled. Disabled inputs reject editing, selection, and popup opening, including pending search results. `isFocusableDisabled` remains accepted but no longer changes behavior; use `aria-disabled` rather than `:disabled` or native-disabled assertions to detect the state.
@korkt-kim
