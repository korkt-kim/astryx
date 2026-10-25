// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file RadioList.disabledBoundaries.test.tsx
 * @input Public RadioList and RadioListItem props, native forms and keyboard events
 * @output Regression coverage for disabled member callbacks and native group isolation
 * @position Colocated RadioList interaction and form boundary tests
 */

import type {KeyboardEventHandler} from 'react';
import {renderToString} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {RadioList, RadioListItem} from './index';

const phases = [
  'onKeyDownCapture',
  'onKeyDown',
  'onKeyPressCapture',
  'onKeyPress',
  'onKeyUpCapture',
  'onKeyUp',
] as const;

function keyboardHandlers(
  callback: (phase: string) => KeyboardEventHandler<HTMLDivElement>,
) {
  return Object.fromEntries(phases.map(phase => [phase, callback(phase)]));
}

function press(target: HTMLElement, key: string) {
  const options = {key, charCode: key === 'Enter' ? 13 : key.charCodeAt(0)};
  fireEvent.keyDown(target, options);
  fireEvent.keyPress(target, options);
  fireEvent.keyUp(target, options);
}

const phaseOrder = [
  'onKeyDownCapture',
  'onKeyDown',
  'onKeyPressCapture',
  'onKeyPress',
  'onKeyUpCapture',
  'onKeyUp',
];

describe('RadioList disabled ownership boundaries', () => {
  it.each([
    {scope: 'group', reason: false},
    {scope: 'group', reason: true},
    {scope: 'member', reason: false},
    {scope: 'member', reason: true},
  ])(
    'guards every accepted member activation-key phase for $scope (reason=$reason)',
    ({scope, reason}) => {
      const member: string[] = [];
      const group: string[] = [];
      const change = vi.fn();
      const view = (disabled: boolean) => (
        <RadioList
          label="Delivery"
          value="a"
          onChange={change}
          isDisabled={scope === 'group' && disabled}
          disabledMessage={reason ? 'Locked' : undefined}
          {...keyboardHandlers(
            phase => event =>
              group.push(`${phase}:${event.key}:${event.defaultPrevented}`),
          )}>
          <RadioListItem label="A" value="a" />
          <RadioListItem
            label="B"
            value="b"
            isDisabled={scope === 'member' && disabled}
            {...keyboardHandlers(
              phase => event => member.push(`${phase}:${event.key}`),
            )}
          />
        </RadioList>
      );
      const {rerender} = render(view(false));
      const b = screen.getByRole('radio', {name: 'B'});
      b.focus();
      rerender(view(true));
      for (const key of [' ', 'Enter']) {
        group.length = 0;
        press(b, key);
        expect(member).toEqual([]);
        expect(group).toEqual(phaseOrder.map(phase => `${phase}:${key}:false`));
      }
      press(b, 'x');
      expect(member).toEqual(phaseOrder.map(phase => `${phase}:x`));
      expect(b).toHaveFocus();
      expect(screen.getByRole('radio', {name: 'A'})).toBeChecked();
      expect(change).not.toHaveBeenCalled();
      member.length = 0;
      rerender(view(false));
      expect(screen.getByRole('radio', {name: 'B'})).toBe(b);
      press(b, ' ');
      expect(member).toEqual(phaseOrder.map(phase => `${phase}: `));
    },
  );

  it('preserves enabled keyboard phase ownership, ordering and cancellation', () => {
    const observations: string[] = [];
    const view = (
      cancel: 'preventDefault' | 'stopPropagation' | null,
      cancelPhase: string,
    ) => (
      <RadioList
        label="Delivery"
        value="a"
        onChange={() => {}}
        {...keyboardHandlers(
          phase => event =>
            observations.push(`group:${phase}:${event.defaultPrevented}`),
        )}>
        <RadioListItem label="A" value="a" />
        <RadioListItem
          label="B"
          value="b"
          data-testid="row"
          {...keyboardHandlers(phase => event => {
            expect(event.target).toBe(screen.getByRole('radio', {name: 'B'}));
            expect(event.currentTarget).toBe(screen.getByTestId('row'));
            observations.push(`member:${phase}:${event.eventPhase}`);
            if (cancel && cancelPhase === phase) {
              event[cancel]();
            }
          })}
        />
      </RadioList>
    );
    const {rerender} = render(view(null, ''));
    for (const [capture, bubble, dispatch] of [
      ['onKeyDownCapture', 'onKeyDown', fireEvent.keyDown],
      ['onKeyPressCapture', 'onKeyPress', fireEvent.keyPress],
      ['onKeyUpCapture', 'onKeyUp', fireEvent.keyUp],
    ] as const) {
      for (const phase of [capture, bubble]) {
        for (const cancel of [
          null,
          'preventDefault',
          'stopPropagation',
        ] as const) {
          rerender(view(cancel, phase));
          observations.length = 0;
          const uncanceled = dispatch(screen.getByRole('radio', {name: 'B'}), {
            key: 'Enter',
            charCode: 13,
          });
          expect(uncanceled).toBe(cancel !== 'preventDefault');
          expect(observations).toEqual([
            `group:${capture}:false`,
            `member:${capture}:1`,
            ...(cancel === 'stopPropagation' && phase === capture
              ? []
              : [`member:${bubble}:3`]),
            ...(cancel === 'stopPropagation'
              ? []
              : [`group:${bubble}:${cancel === 'preventDefault'}`]),
          ]);
        }
      }
    }
  });

  it('keeps caller-child keyboard callbacks and native button activation independent', async () => {
    const user = userEvent.setup();
    const member = vi.fn();
    const child = vi.fn();
    const click = vi.fn();
    render(
      <RadioList label="Delivery" value="a" onChange={() => {}} isDisabled>
        <RadioListItem
          label="A"
          value="a"
          {...keyboardHandlers(() => member)}
          endContent={
            <button type="button" onClick={click} onKeyDown={child}>
              Details
            </button>
          }
        />
      </RadioList>,
    );
    screen.getByRole('button', {name: 'Details'}).focus();
    await user.keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(1);
    expect(child).toHaveBeenCalledTimes(1);
    expect(member).toHaveBeenCalledTimes(6);
  });

  it.each([false, true])(
    'preserves separate same-name forms through disable and re-enable (reason=%s)',
    reason => {
      const change = vi.fn();
      const view = (disabled: boolean) => (
        <>
          {['a', 'b'].map((value, index) => (
            <form key={value} aria-label={`Form ${index}`}>
              <RadioList
                label={`Delivery ${index}`}
                htmlName="delivery"
                value={value}
                onChange={change}
                isRequired
                isDisabled={disabled}
                disabledMessage={reason ? 'Locked' : undefined}>
                <RadioListItem label={`${index} A`} value="a" />
                <RadioListItem label={`${index} B`} value="b" />
              </RadioList>
            </form>
          ))}
        </>
      );
      const {container, rerender} = render(view(false));
      const radios = Array.from(container.querySelectorAll('input'));
      const forms = Array.from(container.querySelectorAll('form'));
      radios[0].focus();
      for (const disabled of [true, false, true, false]) {
        rerender(view(disabled));
        expect(Array.from(container.querySelectorAll('input'))).toEqual(radios);
        expect(radios[0]).toHaveFocus();
        expect(radios.map(radio => radio.checked)).toEqual([
          true,
          false,
          false,
          true,
        ]);
        // jsdom does not reproduce Chromium's checked-state loss on reassociation.
        // Assert the native grouping boundary too: different form owner or name.
        expect(
          radios[0].form !== radios[2].form ||
            radios[0].name !== radios[2].name,
        ).toBe(true);
        expect(forms.map(form => [...new FormData(form)])).toEqual(
          disabled ? [[], []] : [[['delivery', 'a']], [['delivery', 'b']]],
        );
        expect(forms.every(form => form.checkValidity())).toBe(true);
        expect(radios.every(radio => !radio.disabled)).toBe(true);
      }
      expect(change).not.toHaveBeenCalled();
    },
  );

  it('renders initial enabled and disabled form associations before hydration', () => {
    const document = new DOMParser().parseFromString(
      renderToString(
        <>
          {[false, true].map(disabled => (
            <form key={String(disabled)}>
              <RadioList
                label={String(disabled)}
                htmlName="delivery"
                value="a"
                onChange={() => {}}
                isDisabled={disabled}>
                <RadioListItem label="A" value="a" />
                <RadioListItem label="B" value="b" />
              </RadioList>
            </form>
          ))}
        </>,
      ),
      'text/html',
    );
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs.map(input => input.checked)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(inputs[0].name).toBe('delivery');
    expect(inputs[0].form).toBe(document.forms[0]);
    expect(inputs[2].form).toBeNull();
    expect(inputs[2].name).not.toBe('delivery');
    expect(inputs[2].name).toBe(inputs[3].name);
  });

  it.each([false, true])(
    'keeps a single checked-disabled entry and native required semantics in mixed groups (form=%s)',
    withForm => {
      const view = (value: string, hidden: boolean) => {
        const group = (
          <RadioList
            label="Delivery"
            htmlName="delivery"
            value={value}
            onChange={() => {}}
            isRequired>
            <RadioListItem
              label="A"
              value="a"
              isDisabled
              style={hidden ? {display: 'none'} : undefined}
            />
            <RadioListItem label="B" value="b" />
            <RadioListItem label="C" value="c" />
          </RadioList>
        );
        return withForm ? <form>{group}</form> : group;
      };
      const {container, rerender} = render(view('a', false));
      const radios = Array.from(container.querySelectorAll('input'));
      const split =
        radios[0].form !== radios[1].form || radios[0].name !== radios[1].name;
      expect(radios.map(radio => radio.tabIndex)).toEqual(
        split ? [0, -1, -1] : [0, 0, 0],
      );
      expect(radios.every(radio => radio.checkValidity())).toBe(true);
      rerender(view('a', true));
      expect(radios[1].tabIndex).toBe(0);
      expect(radios[2].tabIndex).toBe(0);
      expect(radios[0]).toBeChecked();
      expect(radios.every(radio => radio.checkValidity())).toBe(true);
      rerender(view('', false));
      expect(radios[1].required).toBe(true);
      expect(radios[1].checkValidity()).toBe(false);
    },
  );
});
