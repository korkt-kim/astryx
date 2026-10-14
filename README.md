# Slider pointer endpoint: before and after

Configuration: `min={0}`, `max={100}`, `step={3}`. Both recordings use the existing **Slider → Custom Step** Storybook story in Chrome 155.0.8059.40 on macOS.

| Mouse action | Before | After |
| --- | --- | --- |
| Drag to the right endpoint | 99 | 100 |
| Continue dragging beyond the track | 99 | 100 |
| Release, then click the right endpoint | 99 | 100 |

- **Before:** [recording](before.mp4), [final frame](before.png). Implementation at [`58c4f241e9`](https://github.com/facebook/astryx/commit/58c4f241e92954e1b0c6058201bc5537a888f95e).
- **After:** [recording](after.mp4), [final frame](after.png). Implementation at [`babdb8a37d`](https://github.com/korkt-kim/astryx/commit/babdb8a37d03845b2d487cd8c41c66471bf40d66).

The recordings show real component behavior and native mouse input. The visible cursor and diagnostic panels are recording overlays, not product UI. The actual-value panel reads the thumb's live `aria-valuenow`; it does not set or simulate the value. Both videos are H.264 MP4 at 1280×720. Initial loading time and unused bottom space are trimmed; the interactions are not sped up.

These videos demonstrate the horizontal LTR, single-value mouse path. They are not a claim about every browser, assistive technology, or input modality. The proposed pointer/mark endpoint behavior still needs maintainer confirmation; this evidence does not establish that authority.

Related issue: [facebook/astryx#6735](https://github.com/facebook/astryx/issues/6735). The wider adjacent-arrow proposal is not part of this change.
