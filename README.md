# Token remove-target recording

Reproduction: the `Core/PowerSearch` → `Pre-set Filters` Storybook story.

The same mouse coordinate clicks the end of `Open`, beside the Status token's X.

- **Before:** the click removes Status instead of opening its editor.
- **After:** the click opens the editor and keeps both filters. After dismissing the editor, a click two pixels outside the visible X still removes only Status.

| Recording | Screenshot |
| --- | --- |
| [Before](before.mp4) | [Before result](before.png) |
| [After](after.mp4) | [After editor](after.png) |

## Capture details

- Browser: Playwright Chromium 149.0.7827.55 on macOS.
- Viewport/video: 900 × 600 CSS pixels, device scale 1.
- Input: real Playwright mouse events at the measured value edge, not DOM-dispatched clicks.
- Before source: base commit `52c26fb74b8c23841e91fc00fc4704c2c76cebd8`'s `inset: -14px` restored in Token's actual StyleX source for the recording.
- After source: `inset: -4px`. The working source was restored before validation and commit.
- Visual button remains 16 × 16; computed `::after` changes from 44 × 44 to 24 × 24.
- The red pointer marker and bottom captions are recording annotations with `pointer-events: none`; they do not alter the component or click targeting.
- `before.json` and `after.json` contain the measured geometry, click coordinate and asserted outcomes.

The MP4s use H.264. This evidence branch contains recordings only and is separate from the source pull request.
