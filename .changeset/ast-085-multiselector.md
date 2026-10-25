---
'@astryxdesign/core': patch
---

[fix] MultiSelector blocks selection and creation callbacks and Actions, plus search typing, paste, and clear, when it becomes disabled while its panel is open. Retained popup controls keep focus and expose disabled state and existing descriptions with the disabled reason; caller-rendered action controls retain their own availability.
@korkt-kim
