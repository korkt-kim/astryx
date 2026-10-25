// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file RadioListNativeNameContext.ts
 * @input A stable per-list name from RadioList
 * @output Private context for the native name of form-excluded disabled members
 * @position Internal RadioList/RadioListItem bridge; not a public entry point
 */

import {createLayerScopedContext} from '../Layer/layerScopedContext';

// Kept separate from the exported RadioListContextValue: callers continue to
// provide the ordinary name, not an implementation-specific disabled identity.
export const RadioListNativeNameContext = createLayerScopedContext<
  string | null
>(null);
RadioListNativeNameContext.displayName = 'RadioListNativeNameContext';
