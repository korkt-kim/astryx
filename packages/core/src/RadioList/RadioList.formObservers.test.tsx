// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file RadioList.formObservers.test.tsx
 * @input Public RadioList props and consumer parent layout/passive effects
 * @output Regression coverage for immediate native form exclusion and restoration
 * @position Colocated RadioList consumer-observable form transition tests
 */

import {
  StrictMode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render} from '@testing-library/react';
import {RadioList, RadioListItem} from './index';

describe('RadioList parent form observers', () => {
  it.each([
    {strict: false, scope: 'group', value: 'a'},
    {strict: false, scope: 'group', value: ''},
    {strict: false, scope: 'member', value: 'a'},
    {strict: false, scope: 'member', value: ''},
    {strict: true, scope: 'group', value: 'a'},
    {strict: true, scope: 'group', value: ''},
    {strict: true, scope: 'member', value: 'a'},
    {strict: true, scope: 'member', value: ''},
  ])(
    'completes $scope association before parent effects (value=$value, strict=$strict)',
    ({strict, scope, value}) => {
      const observations: {
        phase: string;
        data: [string, FormDataEntryValue][];
        valid: boolean;
      }[] = [];
      const change = vi.fn();
      function Parent({disabled}: {disabled: boolean}) {
        const formRef = useRef<HTMLFormElement>(null);
        const sample = useCallback((phase: string) => {
          const form = formRef.current;
          if (form) {
            observations.push({
              phase,
              data: [...new FormData(form)],
              valid: form.checkValidity(),
            });
          }
        }, []);
        useLayoutEffect(() => sample('layout'), [disabled, sample]);
        useEffect(() => sample('passive'), [disabled, sample]);
        return (
          <form ref={formRef}>
            <RadioList
              label="Delivery"
              htmlName="delivery"
              value={value}
              onChange={change}
              isRequired
              isDisabled={scope === 'group' && disabled}>
              <RadioListItem
                label="A"
                value="a"
                isDisabled={scope === 'member' && disabled}
              />
              <RadioListItem label="B" value="b" />
            </RadioList>
          </form>
        );
      }
      const view = (disabled: boolean) =>
        strict ? (
          <StrictMode>
            <Parent disabled={disabled} />
          </StrictMode>
        ) : (
          <Parent disabled={disabled} />
        );
      const {rerender} = render(view(false));
      for (const disabled of [true, false]) {
        observations.length = 0;
        rerender(view(disabled));
        // Inspect the samples already taken by the consumer, not the settled DOM.
        expect.soft(observations).toEqual(
          ['layout', 'passive'].map(phase => ({
            phase,
            data: value && !disabled ? [['delivery', value]] : [],
            valid: value !== '' || (scope === 'group' && disabled),
          })),
        );
      }
      expect(change).not.toHaveBeenCalled();
    },
  );

  it('preserves initial disabled association, renamed submissions and ref replay', () => {
    const view = (disabled: boolean, name: string, mounted = true) => (
      <StrictMode>
        <form>
          {mounted && (
            <RadioList
              label="Delivery"
              htmlName={name}
              value="a"
              onChange={() => {}}
              isRequired
              isDisabled={disabled}>
              <RadioListItem label="A" value="a" />
              <RadioListItem label="B" value="b" />
            </RadioList>
          )}
        </form>
      </StrictMode>
    );
    const {container, rerender} = render(view(true, 'delivery'));
    const form = container.querySelector('form')!;
    let radios = Array.from(form.querySelectorAll('input'));
    const check = (disabled: boolean, name: string) => {
      expect(Array.from(form.querySelectorAll('input'))).toEqual(radios);
      expect(radios.map(radio => radio.checked)).toEqual([true, false]);
      expect(radios.every(radio => !radio.disabled)).toBe(true);
      expect(
        radios.every(radio => radio.form === (disabled ? null : form)),
      ).toBe(true);
      expect([...new FormData(form)]).toEqual(disabled ? [] : [[name, 'a']]);
      expect(form.checkValidity()).toBe(true);
      if (!disabled) {
        expect(radios.every(radio => radio.name === name)).toBe(true);
      }
    };
    check(true, 'delivery');
    for (const [disabled, name] of [
      [false, 'delivery'],
      [false, 'shipping'],
      [true, 'shipping'],
      [true, 'method'],
      [false, 'method'],
    ] as const) {
      rerender(view(disabled, name));
      check(disabled, name);
    }
    rerender(view(false, 'method', false));
    expect([...new FormData(form)]).toEqual([]);
    rerender(view(true, 'delivery'));
    radios = Array.from(form.querySelectorAll('input'));
    check(true, 'delivery');
    rerender(view(false, 'delivery'));
    check(false, 'delivery');
  });
});
