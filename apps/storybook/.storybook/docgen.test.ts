// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @input POC Storybook config, docgen TypeScript project, workspace source roots.
 * @output Guards that the HMR experiment reads this worktree's component source.
 * @position Node tests for the experimental Storybook RDT configuration.
 */

import {describe, expect, it} from 'vitest';
import * as ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import config, {workspaceAliases} from './main.ts';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(configDir, '../../..');

describe('Storybook RDT HMR experiment', () => {
  it('uses RDT with explicit Controls and undocumented-children options', () => {
    expect(config.typescript?.reactDocgen).toBe('react-docgen-typescript');
    expect(config.typescript?.reactDocgenTypescriptOptions).toMatchObject({
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      skipChildrenPropWithoutDoc: false,
    });
  });

  it('includes workspace component sources rather than only the app', () => {
    expect(config.typescript?.reactDocgenTypescriptOptions?.include).toEqual([
      `${rootDir.replaceAll(path.sep, '/')}/packages/*/src/**/*.tsx`,
    ]);
  });

  it('uses a local source project without test or story roots', () => {
    const tsconfigPath = path.join(configDir, 'tsconfig.docgen.json');
    expect(config.typescript?.reactDocgenTypescriptOptions?.tsconfigPath).toBe(
      tsconfigPath,
    );
    const parsed = ts.getParsedCommandLineOfConfigFile(
      tsconfigPath,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic(error) {
          throw new Error(
            ts.flattenDiagnosticMessageText(error.messageText, '\n'),
          );
        },
      },
    );
    expect(parsed?.errors).toEqual([]);
    const files = parsed?.fileNames ?? [];
    for (const {src} of workspaceAliases.filter(
      ({src}) => !src.startsWith('packages/themes/'),
    )) {
      const sourceRoot = `${path.resolve(rootDir, src)}${path.sep}`;
      expect(
        files.some(
          file => file.startsWith(sourceRoot) && file.endsWith('.tsx'),
        ),
      ).toBe(true);
    }
    expect(files.some(file => /\.(test|stories)\./.test(file))).toBe(false);
  });
});
