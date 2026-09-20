import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import config from './vitest.config.ts';

const root = process.cwd();
const target = `${root}/packages/core/src/Slider/Slider.tsx`;
let baseline = execFileSync('git', ['show', 'f138ed997b88e4dc4361e73b388bd4b1d8a47bf4:packages/core/src/Slider/Slider.tsx'], {cwd: root, encoding: 'utf8'});
if (process.env.SLIDER_PROBE === 'previous-arrow-stepping') {
  baseline = readFileSync(target, 'utf8');
  const increment = /newVal\s*=\s*snapped > currentVal\s*\?\s*snapped\s*:\s*snapToStep\(currentVal \+ step, min, step\);/;
  const decrement = /newVal\s*=\s*snapped < currentVal\s*\?\s*snapped\s*:\s*snapToStep\(currentVal - step, min, step\);/;
  if (!increment.test(baseline) || !decrement.test(baseline)) throw new Error('Arrow mutation did not match both cases');
  baseline = baseline.replace(increment, 'newVal = currentVal + step;').replace(decrement, 'newVal = currentVal - step;');
}

export default {
  ...config,
  root,
  plugins: [
    {name: 'slider-baseline-source-only', enforce: 'pre', load(id) {
      if (id.split('?')[0] === target) return baseline;
    }},
    ...config.plugins,
  ],
};
