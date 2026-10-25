---
'@astryxdesign/core': patch
---

[fix] RadioList keeps focused disabled radios and the selected group's Tab entry available, blocks disabled activation callbacks (including `onClickCapture` and all member Space/Enter key phases), and describes each radio with the disabled reason. Disabled radios now use `aria-disabled` instead of native `disabled`; their values remain excluded from form submission and validation. Disabled radios use a private native group name so separate forms can reuse `htmlName` without losing checked values; enabled submissions retain `htmlName`. Disabling and re-enabling update native form values and required validity before parent layout or passive effects read the form. Independently updated, mounted, or removed options also synchronize required validity before their consumer layout effects, including StrictMode ref replay. A hidden or inert checked row no longer prevents keyboard entry to the remaining options.
@korkt-kim
