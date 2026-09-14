// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @input Invalid palette requests and explicit output paths in temporary directories.
 * @output Error and no-partial-write regression evidence for the file API.
 * @position Palette file-adapter input-validation tests.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {themePaletteGenerate} from './generate.mjs';

let cwd;
const input = {families: [{id: 'blue', seed: '#0074e2'}], stops: [20, 50, 80]};
const run = options =>
  themePaletteGenerate('request.json', options, {cwd}).data;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'astryx-palette-validation-'));
  fs.writeFileSync(path.join(cwd, 'request.json'), JSON.stringify(input));
});
afterEach(() => fs.rmSync(cwd, {recursive: true, force: true}));

describe('palette file input validation', () => {
  it.each(['out', 'preview'])(
    'rejects an explicitly empty %s before writing any other output',
    key => {
      expect(() =>
        run({out: 'candidate.ts', preview: 'review.html', [key]: ''}),
      ).toThrow(/non-empty/);
      expect(fs.readdirSync(cwd)).toEqual(['request.json']);
    },
  );

  it.each([{recipe: 'unsupported-recipe'}, {neutralProfile: 'typo-v1'}])(
    'rejects invalid input %j without changing existing files',
    change => {
      fs.writeFileSync(
        path.join(cwd, 'request.json'),
        JSON.stringify({...input, ...change}),
      );
      fs.writeFileSync(path.join(cwd, 'candidate.ts'), 'author edit\n');
      expect(() =>
        run({out: 'candidate.ts', preview: 'review.html', overwrite: true}),
      ).toThrow(expect.objectContaining({code: 'ERR_PALETTE_GENERATION'}));
      expect(fs.readFileSync(path.join(cwd, 'candidate.ts'), 'utf8')).toBe(
        'author edit\n',
      );
      expect(fs.readdirSync(cwd).sort()).toEqual([
        'candidate.ts',
        'request.json',
      ]);
    },
  );

  it('allows omitted paths without requesting a write', () => {
    expect(run({})).toMatchObject({
      written: false,
      output: null,
      receipt: null,
      preview: null,
    });
    expect(fs.readdirSync(cwd)).toEqual(['request.json']);
  });
});
