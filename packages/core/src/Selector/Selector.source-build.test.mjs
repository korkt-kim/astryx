// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Selector.source-build.test.mjs
 * @input Uses Babel, next/babel, the StyleX compiler, and Selector source
 * @output Verifies raw Selector source survives a consumer's Babel pipeline
 * @position Regression test for Selector source-build compatibility
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformAsync} from '@babel/core';
import stylexBabelPlugin from '@stylexjs/babel-plugin';
import {describe, expect, it} from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');
const SELECTOR_SOURCE = path.join(__dirname, 'Selector.tsx');

const EXPECTED_SIZE_DECLARATIONS = [
  'min-height:var(--size-element-sm)',
  'min-height:var(--size-element-md)',
  'min-height:var(--size-element-lg)',
];

describe('Selector source-build compatibility (#5464)', () => {
  it('compiles after next/babel lowers module-scope arrows', async () => {
    const source = await fs.readFile(SELECTOR_SOURCE, 'utf8');
    const result = await transformAsync(source, {
      babelrc: false,
      caller: {
        name: 'selector-source-build-test',
        isDev: false,
        isServer: false,
        supportsStaticESM: false,
      },
      configFile: false,
      envName: 'production',
      filename: SELECTOR_SOURCE,
      presets: ['next/babel'],
      plugins: [
        [
          stylexBabelPlugin,
          {
            dev: false,
            runtimeInjection: false,
            genConditionalClasses: true,
            treeshakeCompensation: true,
            unstable_moduleResolution: {
              type: 'commonJS',
              rootDir: ROOT,
            },
          },
        ],
      ],
    });

    const declarations = (result?.metadata?.stylex ?? [])
      .map(([, rule]) => rule.ltr.match(/^\.[^{]+\{(.+)\}$/)?.[1])
      .filter(Boolean);

    expect(declarations).toContain('padding-block:0');
    expect(declarations).toContain('line-height:var(--spacing-5)');
    expect(
      declarations.filter(value =>
        value.startsWith('min-height:var(--size-element-'),
      ),
    ).toEqual(EXPECTED_SIZE_DECLARATIONS);
    expect(
      declarations.some(value => value.startsWith('padding-block:calc')),
    ).toBe(false);
  });
});
