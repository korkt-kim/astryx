---
'@astryxdesign/core': patch
---

[fix] BaseTypeahead keeps disabled inputs focusable without native `disabled`, preserving their existing Tab order and focus when disabled. Disabled inputs reject editing, selection, popup opening, and keyboard/pointer activation callbacks in both capture and bubble phases, including keyup and double-click, as well as paste/drop mutation callbacks. Pending search results cannot reopen them; native text inspection and focus/blur observation remain available. `isFocusableDisabled` remains accepted but no longer changes behavior; use `aria-disabled` rather than `:disabled` or native-disabled assertions to detect the state.
@korkt-kim
