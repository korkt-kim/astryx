---
'@astryxdesign/core': patch
---

[fix] RadioList keeps focused disabled radios and the selected group's Tab entry available, blocks disabled activation callbacks, and describes each radio with the disabled reason. Disabled radios now use `aria-disabled` instead of native `disabled`; their values remain excluded from form submission and validation.
@korkt-kim
