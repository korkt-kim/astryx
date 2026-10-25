// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file RadioList.memberSync.test.tsx
 * @input Public RadioList composition with independently updated member state
 * @output Consumer layout-effect observations of native required participation
 * @position Colocated RadioList independent-child form regression tests
 */

import {StrictMode, useEffect, useLayoutEffect, useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {RadioList, RadioListItem} from './index';

describe('RadioList independent member form synchronization', () => {
  it.each([false, true])(
    'finishes required normalization before the independent child layout effect (strict=%s)',
    strict => {
      const samples: {
        valid: boolean;
        data: [string, FormDataEntryValue][];
        required: boolean[];
      }[] = [];
      const change = vi.fn();
      const groupRender = vi.fn();
      function SelectedOption() {
        const [disabled, setDisabled] = useState(false);
        useLayoutEffect(() => {
          const form = document.querySelector('form')!;
          samples.push({
            valid: form.checkValidity(),
            data: [...new FormData(form)],
            required: Array.from(form.querySelectorAll('input')).map(
              radio => radio.required,
            ),
          });
        }, [disabled]);
        return (
          <>
            <RadioListItem label="A" value="a" isDisabled={disabled} />
            <button type="button" onClick={() => setDisabled(!disabled)}>
              Toggle A
            </button>
          </>
        );
      }
      function App() {
        groupRender();
        return (
          <form>
            <RadioList
              label="Delivery"
              htmlName="delivery"
              value="a"
              isRequired
              onChange={change}>
              <SelectedOption />
              <RadioListItem label="B" value="b" />
            </RadioList>
          </form>
        );
      }
      render(
        strict ? (
          <StrictMode>
            <App />
          </StrictMode>
        ) : (
          <App />
        ),
      );
      const renders = groupRender.mock.calls.length;
      const radios = screen.getAllByRole('radio');
      for (const disabled of [true, false]) {
        samples.length = 0;
        fireEvent.click(screen.getByRole('button', {name: 'Toggle A'}));
        // The effect's stored sample survives later observer repair. jsdom does
        // not model every form-owner rule, so also assert the native required bit.
        expect.soft(samples).toEqual([
          {
            valid: true,
            data: disabled ? [] : [['delivery', 'a']],
            required: [true, !disabled],
          },
        ]);
        expect(screen.getAllByRole('radio')).toEqual(radios);
        expect(radios[0]).toBeChecked();
        expect(radios[1]).not.toBeChecked();
        expect(groupRender).toHaveBeenCalledTimes(renders);
      }
      expect(change).not.toHaveBeenCalled();
    },
  );

  it.each(
    [false, true].flatMap(strict =>
      ['a', 'b', '', 'unknown'].flatMap(value =>
        [false, true].map(late => ({strict, value, late})),
      ),
    ),
  )(
    'preserves native validity through member lifetimes (strict=$strict, value=$value, late=$late)',
    ({strict, value, late}) => {
      const form = document.createElement('form');
      document.body.append(form);
      const samples: {
        phase: string;
        valid: boolean;
        data: [string, FormDataEntryValue][];
        checked: string[];
      }[] = [];
      const change = vi.fn();
      const groupRender = vi.fn();
      let updateMember = (_next: {mounted: boolean; disabled: boolean}) => {};
      function IndependentOptions() {
        const [state, setState] = useState({mounted: true, disabled: true});
        updateMember = setState;
        const sample = (phase: string) => {
          samples.push({
            phase,
            valid: form.checkValidity(),
            data: [...new FormData(form)],
            checked: Array.from(form.querySelectorAll('input:checked')).map(
              radio => radio.getAttribute('value')!,
            ),
          });
        };
        useLayoutEffect(() => sample('layout'));
        useEffect(() => sample('passive'));
        return state.mounted ? (
          <RadioListItem label="A" value="a" isDisabled={state.disabled} />
        ) : null;
      }
      function App({mounted, required}: {mounted: boolean; required: boolean}) {
        groupRender();
        return mounted ? (
          <RadioList
            label="Delivery"
            htmlName="delivery"
            value={value}
            isRequired={required}
            onChange={change}>
            <IndependentOptions />
            <RadioListItem label="B" value="b" />
          </RadioList>
        ) : null;
      }
      const view = (mounted: boolean, required = true) =>
        strict ? (
          <StrictMode>
            <App mounted={mounted} required={required} />
          </StrictMode>
        ) : (
          <App mounted={mounted} required={required} />
        );
      const rendered = render(view(!late), {container: form});
      const verify = (
        mounted: boolean,
        disabled: boolean,
        required: boolean,
      ) => {
        const checked = value === 'b' || (mounted && value === 'a');
        const data =
          checked && (value === 'b' || !disabled) ? [['delivery', value]] : [];
        expect(samples.length).toBeGreaterThan(0);
        for (const sample of samples) {
          expect.soft(sample).toEqual({
            phase: sample.phase,
            valid: !required || checked,
            data,
            checked: checked ? [value] : [],
          });
        }
        expect(form.querySelector('input:disabled')).toBeNull();
        expect(change).not.toHaveBeenCalled();
      };
      try {
        if (late) {
          rendered.rerender(view(true));
        }
        verify(true, true, true);
        for (const state of [
          {mounted: true, disabled: false},
          {mounted: true, disabled: true},
          {mounted: false, disabled: true},
          {mounted: true, disabled: true},
        ]) {
          samples.length = 0;
          const renders = groupRender.mock.calls.length;
          act(() => updateMember(state));
          verify(state.mounted, state.disabled, true);
          expect(groupRender).toHaveBeenCalledTimes(renders);
        }
        for (const required of [false, true]) {
          samples.length = 0;
          rendered.rerender(view(true, required));
          verify(true, true, required);
        }
        rendered.rerender(view(false));
        expect([...new FormData(form)]).toEqual([]);
        samples.length = 0;
        rendered.rerender(view(true));
        verify(true, true, true);
      } finally {
        rendered.unmount();
        form.remove();
      }
    },
  );

  it.each([false, true])(
    'synchronizes an independently changed option value without replacing its input (strict=%s)',
    strict => {
      const samples: boolean[] = [];
      let updateValue = (_value: string) => {};
      function Option() {
        const [value, setValue] = useState('a');
        updateValue = setValue;
        useLayoutEffect(() => {
          samples.push(document.querySelector('form')!.checkValidity());
        }, [value]);
        return <RadioListItem label="A" value={value} isDisabled />;
      }
      const app = (
        <form>
          <RadioList
            label="Delivery"
            htmlName="delivery"
            value="a"
            isRequired
            onChange={() => {}}>
            <Option />
            <RadioListItem label="B" value="b" />
          </RadioList>
        </form>
      );
      render(strict ? <StrictMode>{app}</StrictMode> : app);
      const radio = screen.getByRole('radio', {name: 'A'});
      for (const value of ['other', 'a']) {
        samples.length = 0;
        act(() => updateValue(value));
        expect(samples).toEqual([value === 'a']);
        expect(screen.getByRole('radio', {name: 'A'})).toBe(radio);
      }
    },
  );

  it.each([false, true])(
    'excludes all independently removed members before consumer effects (strict=%s)',
    strict => {
      const samples: boolean[] = [];
      let remove = () => {};
      function Options() {
        const [mounted, setMounted] = useState(true);
        remove = () => setMounted(false);
        useLayoutEffect(() => {
          samples.push(document.querySelector('form')!.checkValidity());
        }, [mounted]);
        return mounted ? (
          <div>
            <RadioListItem label="A" value="a" isDisabled />
            <RadioListItem label="C" value="c" isDisabled />
          </div>
        ) : null;
      }
      const app = (
        <form>
          <RadioList
            label="Delivery"
            htmlName="delivery"
            value="a"
            isRequired
            onChange={() => {}}>
            <Options />
            <RadioListItem label="B" value="b" />
          </RadioList>
        </form>
      );
      render(strict ? <StrictMode>{app}</StrictMode> : app);
      expect(samples.every(Boolean)).toBe(true);
      samples.length = 0;
      act(remove);
      expect(samples).toEqual([false]);
      expect(screen.getByRole('radio', {name: 'B'})).toBeRequired();
    },
  );
});
