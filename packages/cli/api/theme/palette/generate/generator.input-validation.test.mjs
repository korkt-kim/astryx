// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @input Explicit recipe and neutral-profile requests to the pure palette API.
 * @output Regression evidence for rejected intent and unchanged valid defaults.
 * @position Palette generator input-validation tests.
 */
import {describe, expect, it} from 'vitest';
import {generatePaletteSet, generateTonalPalette} from './generator.mjs';

const base = {families: [{id: 'blue', seed: '#0074e2'}], stops: [20, 50, 80]};

describe('palette recipe and neutral-profile validation', () => {
  it('defaults the recipe only when omitted and accepts its explicit identity', () => {
    expect(generatePaletteSet({...base, recipe: 'astryx-oklch-v1'})).toEqual(
      generatePaletteSet(base),
    );
  });

  it.each(['unsupported-recipe', '', null, 1])(
    'rejects unsupported recipe %j',
    recipe => {
      expect(() => generateTonalPalette({...base, recipe})).toThrow(/recipe/i);
    },
  );

  it.each(['typo-v1', '', 1, {}])(
    'rejects invalid neutralProfile %j even without neutral families',
    neutralProfile => {
      expect(() => generateTonalPalette({...base, neutralProfile})).toThrow(
        /neutral profile/i,
      );
    },
  );

  it.each(['neutral-v1', 'warm-v1', 'cool-v1', 'custom'])(
    'keeps valid profile %s inactive for chromatic families but records it',
    neutralProfile => {
      expect(generateTonalPalette({...base, neutralProfile})).toEqual(
        generateTonalPalette(base),
      );
      expect(
        generatePaletteSet({...base, neutralProfile}).request.neutralProfile,
      ).toBe(neutralProfile);
    },
  );
});
