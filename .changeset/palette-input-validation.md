---
'@astryxdesign/cli': patch
---

[fix] Reject unsupported palette recipes, invalid neutral profiles, explicitly empty output paths, and excess palette-command arguments before writing files. In particular, `--overwrite false` now fails instead of silently enabling overwrite and discarding `false`. Valid palette requests retain their existing output.
@korkt-kim
