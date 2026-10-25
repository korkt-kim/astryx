// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file RadioList.focusableDisabled.test.tsx
 * @input Public RadioList/RadioListItem props, keyboard input, form data, and rerenders
 * @output Disabled focus, activation, description, and enabled-roundtrip regressions
 * @position Component-local DOM tests; real focus and native arrows also need Chromium evidence
 */

import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {RadioList, RadioListItem} from './index';

describe('RadioList focusable disabled controls', () => {
  it.each(['group', 'member'] as const)(
    'keeps the selected %s-disabled radio mounted, focusable, and out of form data',
    async scope => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const view = (isDisabled: boolean) => (
        <form aria-label="Delivery form">
          <button type="button">Before</button>
          <RadioList
            label="Delivery"
            htmlName="delivery"
            value="a"
            onChange={onChange}
            isDisabled={scope === 'group' && isDisabled}>
            <RadioListItem
              label="A"
              value="a"
              isDisabled={scope === 'member' && isDisabled}
            />
            <RadioListItem label="B" value="b" />
          </RadioList>
          <button type="button">After</button>
        </form>
      );
      const {rerender, container} = render(view(false));
      const a = screen.getByRole('radio', {name: 'A'});
      const form = container.querySelector('form')!;
      await user.tab();
      await user.tab();
      expect(a).toHaveFocus();
      expect(new FormData(form).get('delivery')).toBe('a');

      rerender(view(true));
      expect(screen.getByRole('radio', {name: 'A'})).toBe(a);
      expect(a).toHaveFocus();
      expect(a).not.toHaveAttribute('disabled');
      expect(a).toHaveAttribute('aria-disabled', 'true');
      expect(new FormData(form).has('delivery')).toBe(false);
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(a).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();

      rerender(view(false));
      expect(a).not.toHaveAttribute('aria-disabled');
      expect(new FormData(form).get('delivery')).toBe('a');
      fireEvent.click(screen.getByRole('radio', {name: 'B'}));
      expect(onChange).toHaveBeenCalledExactlyOnceWith('b');
    },
  );

  it('blocks consumer onClick after disabling a focused group with a reason and pressing ArrowDown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClick = vi.fn();
    const view = (isDisabled: boolean) => (
      <RadioList
        label="Delivery"
        value="a"
        onChange={onChange}
        isDisabled={isDisabled}
        disabledMessage="Managed by your administrator">
        <RadioListItem label="A" value="a" onClick={onClick} />
        <RadioListItem label="B" value="b" onClick={onClick} />
      </RadioList>
    );
    const {rerender} = render(view(false));
    await user.tab();
    rerender(view(true));
    await user.keyboard('{ArrowDown}');
    expect(onClick).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', {name: 'A'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'B'})).not.toBeChecked();
  });

  it.each([false, true])(
    'blocks native click and Space with a reason=%s without losing the controlled value',
    async reason => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onClick = vi.fn();
      render(
        <RadioList
          label="Delivery"
          value="a"
          onChange={onChange}
          isDisabled
          disabledMessage={reason ? 'Locked' : undefined}>
          <RadioListItem label="A" value="a" />
          <RadioListItem label="B" value="b" onClick={onClick} />
        </RadioList>,
      );
      const b = screen.getByRole('radio', {name: 'B'});
      fireEvent.click(b);
      b.focus();
      await user.keyboard(' ');
      expect(onClick).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('radio', {name: 'A'})).toBeChecked();
      expect(b).not.toBeChecked();
    },
  );

  it('merges the disabled reason with each radio description, including individually disabled members', () => {
    const view = (isDisabled: boolean) => (
      <RadioList
        label="Delivery"
        description="Choose delivery"
        value="a"
        onChange={() => {}}
        isDisabled={isDisabled}
        disabledMessage="Managed by your administrator">
        <RadioListItem label="A" value="a" description="Standard delivery" />
        <RadioListItem
          label="B"
          value="b"
          description="Express delivery"
          isDisabled
        />
      </RadioList>
    );
    const {rerender} = render(view(true));
    expect(screen.getByRole('radio', {name: 'A'})).toHaveAccessibleDescription(
      'Standard delivery Managed by your administrator',
    );
    expect(screen.getByRole('radio', {name: 'B'})).toHaveAccessibleDescription(
      'Express delivery Managed by your administrator',
    );
    rerender(view(false));
    expect(screen.getByRole('radio', {name: 'A'})).toHaveAccessibleDescription(
      'Standard delivery',
    );
    expect(screen.getByRole('radio', {name: 'B'})).toHaveAccessibleDescription(
      'Express delivery',
    );
  });

  it('does not let a disabled required group block form validation and restores validation when enabled', () => {
    const view = (isDisabled: boolean) => (
      <form>
        <RadioList
          label="Delivery"
          htmlName="delivery"
          value=""
          onChange={() => {}}
          isRequired
          isDisabled={isDisabled}>
          <RadioListItem label="A" value="a" />
          <RadioListItem label="B" value="b" />
        </RadioList>
      </form>
    );
    const {container, rerender} = render(view(false));
    const form = container.querySelector('form')!;
    expect(form.checkValidity()).toBe(false);
    rerender(view(true));
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form)]).toEqual([]);
    expect(container.querySelector('[disabled]')).toBeNull();
    rerender(view(false));
    expect(form.checkValidity()).toBe(false);
  });

  it('preserves native required validation when the checked member is disabled', () => {
    const view = (value: string, isDisabled: boolean) => (
      <form>
        <RadioList
          label="Delivery"
          htmlName="delivery"
          value={value}
          onChange={() => {}}
          isRequired>
          <RadioListItem label="A" value="a" isDisabled={isDisabled} />
          <RadioListItem label="B" value="b" />
        </RadioList>
      </form>
    );
    const {container, rerender} = render(view('a', false));
    const form = container.querySelector('form')!;
    expect(form.checkValidity()).toBe(true);
    rerender(view('a', true));
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form)]).toEqual([]);
    rerender(view('', true));
    expect(form.checkValidity()).toBe(false);
    rerender(view('b', true));
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('delivery')).toBe('b');
  });

  it.each([true, false])(
    'preserves enabled selection and one Tab stop with disabled peers (form=%s)',
    async withForm => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onDisabledClick = vi.fn();
      function Example() {
        const [value, setValue] = useState('a');
        const group = (
          <>
            <button type="button">Before</button>
            <RadioList
              label="Delivery"
              value={value}
              onChange={next => {
                onChange(next);
                setValue(next);
              }}>
              <RadioListItem label="A" value="a" />
              <RadioListItem
                label="B"
                value="b"
                isDisabled
                onClick={onDisabledClick}
              />
              <RadioListItem label="C" value="c" />
            </RadioList>
            <button type="button">After</button>
          </>
        );
        return withForm ? <form>{group}</form> : group;
      }
      render(<Example />);
      await user.tab();
      await user.tab();
      if (withForm) {
        // userEvent groups radios only by name, ignoring form owners. Native
        // arrow skipping inside a form is covered by the Chromium probe.
        await user.click(screen.getByRole('radio', {name: 'C'}));
      } else {
        await user.keyboard('{ArrowDown}');
      }
      expect(screen.getByRole('radio', {name: 'C'})).toHaveFocus();
      expect(screen.getByRole('radio', {name: 'C'})).toBeChecked();
      expect(onChange).toHaveBeenCalledExactlyOnceWith('c');
      expect(onDisabledClick).not.toHaveBeenCalled();
      await user.tab();
      expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
      await user.tab({shift: true});
      expect(screen.getByRole('radio', {name: 'C'})).toHaveFocus();
    },
  );

  it.each(['group', 'member'] as const)(
    'respects %s key cancellation with individually disabled peers',
    async owner => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) =>
        event.preventDefault(),
      );
      render(
        <RadioList
          label="Delivery"
          value="a"
          onChange={onChange}
          onKeyDown={owner === 'group' ? onKeyDown : undefined}>
          <RadioListItem
            label="A"
            value="a"
            onKeyDown={owner === 'member' ? onKeyDown : undefined}
          />
          <RadioListItem label="B" value="b" isDisabled />
          <RadioListItem label="C" value="c" />
        </RadioList>,
      );
      screen.getByRole('radio', {name: 'A'}).focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('radio', {name: 'A'})).toHaveFocus();
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it.each(['', 'unmatched'])(
    'keeps forward and backward entry when no mounted option matches %j',
    async value => {
      const user = userEvent.setup();
      render(
        <form>
          <button type="button">Before</button>
          <RadioList label="Delivery" value={value} onChange={() => {}}>
            <RadioListItem label="A" value="a" isDisabled />
            <RadioListItem label="B" value="b" />
            <RadioListItem label="C" value="c" />
          </RadioList>
          <button type="button">After</button>
        </form>,
      );
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(screen.getByRole('radio', {name: 'B'})).toHaveFocus();
      screen.getByRole('button', {name: 'After'}).focus();
      await user.tab({shift: true});
      expect(screen.getByRole('radio', {name: 'C'})).toHaveFocus();
    },
  );

  it('maintains a single Tab entry when a child independently mounts or removes the selected disabled option', async () => {
    const user = userEvent.setup();
    function SelectedOption() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShown(!shown)}>
            Toggle option
          </button>
          {shown && <RadioListItem label="B" value="b" isDisabled />}
        </>
      );
    }
    render(
      <form>
        <RadioList label="Delivery" value="b" onChange={() => {}}>
          <RadioListItem label="A" value="a" />
          <SelectedOption />
          <RadioListItem label="C" value="c" />
        </RadioList>
      </form>,
    );
    await user.click(screen.getByRole('button', {name: 'Toggle option'}));
    await waitFor(() =>
      expect(screen.getByRole('radio', {name: 'A'})).toHaveAttribute(
        'tabindex',
        '-1',
      ),
    );
    expect(screen.getByRole('radio', {name: 'B'})).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('radio', {name: 'C'})).toHaveAttribute(
      'tabindex',
      '-1',
    );
    await user.click(screen.getByRole('button', {name: 'Toggle option'}));
    await waitFor(() =>
      expect(screen.getByRole('radio', {name: 'A'})).toHaveAttribute(
        'tabindex',
        '0',
      ),
    );
    expect(screen.getByRole('radio', {name: 'C'})).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('does not manage caller-owned radios in content slots', () => {
    render(
      <RadioList label="Delivery" value="a" onChange={() => {}}>
        <RadioListItem
          label="A"
          value="a"
          endContent={
            <input type="radio" aria-label="Independent" name="other" />
          }
        />
        <RadioListItem label="B" value="b" isDisabled />
      </RadioList>,
    );
    expect(
      screen.getByRole('radio', {name: 'Independent'}),
    ).not.toHaveAttribute('tabindex');
  });

  it('keeps enabled consumer handlers, arrow selection, and native grouping', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const onFocus = vi.fn();
    function Example() {
      const [value, setValue] = useState('a');
      return (
        <RadioList
          label="Delivery"
          htmlName="delivery"
          value={value}
          onChange={setValue}>
          <RadioListItem
            label="A"
            value="a"
            onKeyDown={onKeyDown}
            onFocus={onFocus}
          />
          <RadioListItem label="B" value="b" onClick={onClick} />
        </RadioList>
      );
    }
    render(<Example />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', {name: 'A'})).not.toBeChecked();
    expect(screen.getByRole('radio', {name: 'B'})).toBeChecked();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('name', 'delivery');
    }
  });
});
