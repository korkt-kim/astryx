# PowerSearch read-only value editor: before and after

- Before: `facebook/astryx` at `0da784d3cc59322a34c73af7b41e0aa0a64d4dfe`.
- After: `korkt-kim/astryx` at `0e029cfc998befbea90a9c20ce181e3c364ad21a`.
- Browser: Playwright Chromium `149.0.7827.55` on macOS.
- Screenshots are real browser captures. Only empty margins were cropped.

The same temporary Storybook fixture renders four public
`PowerSearchFilterEditor` instances with `mode="edit"` and `isReadOnly={true}`.
It reuses the PowerSearch story's `fullConfig` and these initial filters:

| Field | Operator | Value |
| --- | --- | --- |
| `title` | `contains` | `Billing` |
| `line_count` | `gt` | `200` |
| `tags` | `include` | `bug`, `docs` |
| `created` | `between` | 2026-01-05 through 2026-01-07 (UTC) |

The fixture was restored after capture and is not part of the source PR.

## Captures

| State | Before | After |
| --- | --- | --- |
| Initial read-only state | [before-initial.png](before-initial.png) | [after-initial.png](after-initial.png) |
| Value editing and token removal | [before-editing.png](before-editing.png) | [after-editing.png](after-editing.png) |
| Calendar activation | [before-calendar.png](before-calendar.png) | [after-calendar.png](after-calendar.png) |

### Before

Despite `isReadOnly=true`, text changes to `Changed despite read-only`, the
numeric value changes to `999`, the `Bug` token can be removed, and the date-range
calendar opens. The field and operator selectors remain disabled.

### After

Pointer and keyboard input leave the text and number at `Billing` and `200`.
Both tokens remain, their removal buttons are absent, and clicking the calendar
control does not open a dialog. All four value controls are natively disabled.

## Unchanged path

With `isReadOnly=false`, text editing, token removal and calendar opening work on
both revisions. Neutral enabled-state screenshots have zero changed pixels.
