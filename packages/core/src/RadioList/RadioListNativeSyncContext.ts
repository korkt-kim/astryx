// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file RadioListNativeSyncContext.ts
 * @input Group-owned native-radio normalization callbacks
 * @output Private member commit/detach bridge, without a public context change
 * @position Internal RadioList lifecycle coordination; not a public entry point
 */

import {createLayerScopedContext} from '../Layer/layerScopedContext';

export const RadioListNativeSyncContext = createLayerScopedContext<{
  sync: (element: HTMLElement) => void;
  detach: (radio: HTMLInputElement) => void;
} | null>(null);
RadioListNativeSyncContext.displayName = 'RadioListNativeSyncContext';
