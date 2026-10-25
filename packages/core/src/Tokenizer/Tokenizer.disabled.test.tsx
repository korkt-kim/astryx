// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Tokenizer.disabled.test.tsx
 * @input Uses the public Tokenizer, Testing Library, and Vitest
 * @output Regressions for disabled token mutation and enabled focus behavior
 * @position Component-local tests for Tokenizer-owned commit boundaries
 */

import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, waitFor} from '@testing-library/react';
import {useState} from 'react';
import userEvent from '@testing-library/user-event';
import {Tokenizer} from './Tokenizer';
import {__resetLiveRegionsForTest} from '../hooks/useAnnounce';
import type {SearchableItem, SearchSource} from '../Typeahead/types';

const alice: SearchableItem = {id: 'alice', label: 'Alice'};
const bob: SearchableItem = {id: 'bob', label: 'Bob'};
const source: SearchSource = {
  search: query =>
    [alice, bob].filter(item =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    ),
  bootstrap: () => [alice, bob],
};

afterEach(() => {
  __resetLiveRegionsForTest();
});

describe('Tokenizer disabled commits', () => {
  it('does not remove an existing token on empty-input Backspace with a disabled reason', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tokenizer
        label="Members"
        searchSource={source}
        value={[alice]}
        onChange={onChange}
        isDisabled
        disabledMessage="Editing is unavailable"
      />,
    );

    await user.tab();
    const input = screen.getByRole('combobox', {name: 'Members'});
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Backspace}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(
      document.querySelector('[data-astryx-live-region="polite"]'),
    ).toBeNull();
  });

  it.each([undefined, 'Editing is unavailable'])(
    'guards the supplied remove callback across disable and re-enable (reason: %s)',
    async disabledMessage => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const subject = (isDisabled: boolean) => (
        <Tokenizer
          label="Members"
          searchSource={source}
          value={[alice]}
          onChange={onChange}
          isDisabled={isDisabled}
          disabledMessage={disabledMessage}
          renderToken={(item, onRemove) => (
            <button type="button" onClick={onRemove}>
              Custom remove {item.label}
            </button>
          )}
        />
      );
      const {rerender} = render(subject(false));
      const input = screen.getByRole('combobox');
      await user.tab();
      const remove = screen.getByRole('button', {name: 'Custom remove Alice'});
      act(() => remove.focus());
      rerender(subject(true));
      expect(remove).toHaveFocus();

      await user.keyboard('{Enter}');
      await user.click(remove);
      expect(onChange).not.toHaveBeenCalled();
      expect(remove).toHaveFocus();
      expect(
        document.querySelector('[data-astryx-live-region="polite"]'),
      ).toBeNull();

      rerender(subject(false));
      await user.click(remove);
      expect(onChange).toHaveBeenCalledExactlyOnceWith([], {
        item: alice,
        type: 'remove',
      });
      expect(screen.getByRole('combobox')).toBe(input);
      expect(input).toHaveFocus();
    },
  );

  it.each(['keyboard', 'pointer'] as const)(
    'rejects a loaded selection after disable via %s',
    async modality => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const subject = (isDisabled: boolean) => (
        <Tokenizer
          label="Members"
          searchSource={source}
          value={[alice]}
          onChange={onChange}
          hasEntriesOnFocus
          debounceMs={0}
          isDisabled={isDisabled}
          disabledMessage="Editing is unavailable"
        />
      );
      const {rerender} = render(subject(false));
      await user.tab();
      const input = screen.getByRole('combobox');
      const option = await screen.findByText('Bob');
      await waitFor(() =>
        expect(input).toHaveAttribute('aria-expanded', 'true'),
      );
      await user.keyboard('{ArrowDown}');
      rerender(subject(true));
      expect(input).toHaveFocus();

      if (modality === 'keyboard') {
        await user.keyboard('{Enter}');
      } else {
        await user.click(option);
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(
        document.querySelector('[data-astryx-live-region="polite"]')
          ?.textContent ?? '',
      ).not.toMatch(/Added/);
    },
  );

  it.each([true, false])(
    'only commits a create entry while enabled (isDisabled: %s)',
    async isDisabled => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const subject = (disabled: boolean) => (
        <Tokenizer
          label="Members"
          searchSource={source}
          value={[alice]}
          onChange={onChange}
          hasCreate
          debounceMs={0}
          isDisabled={disabled}
          disabledMessage="Editing is unavailable"
        />
      );
      const {rerender} = render(subject(false));
      await user.tab();
      await user.keyboard('Charlie');
      const create = await screen.findByText('Create "Charlie"');
      rerender(subject(isDisabled));
      await user.click(create);

      if (isDisabled) {
        expect(onChange).not.toHaveBeenCalled();
        expect(
          document.querySelector('[data-astryx-live-region="polite"]')
            ?.textContent ?? '',
        ).not.toMatch(/Added/);
      } else {
        const charlie = {id: 'Charlie', label: 'Charlie'};
        expect(onChange).toHaveBeenCalledExactlyOnceWith([alice, charlie], {
          item: charlie,
          type: 'create',
        });
        expect(screen.getByRole('combobox')).toHaveFocus();
      }
    },
  );

  it.each(['Backspace', 'remove', 'clear'] as const)(
    'preserves enabled %s removal, metadata, and input focus',
    async method => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      function Subject() {
        const [value, setValue] = useState([alice, bob]);
        return (
          <Tokenizer
            label="Members"
            searchSource={source}
            value={value}
            onChange={(items, change) => {
              onChange(items, change);
              setValue(items);
            }}
            hasClear
          />
        );
      }
      render(<Subject />);
      await user.tab();
      const input = screen.getByRole('combobox');
      if (method === 'Backspace') {
        await user.keyboard('{Backspace}');
      } else {
        await user.click(
          screen.getByRole('button', {
            name: method === 'clear' ? 'Clear all' : 'Remove Bob',
          }),
        );
      }
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        method === 'clear' ? [] : [alice],
        {item: bob, type: 'remove'},
      );
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBe(input);
      expect(input).toHaveFocus();
    },
  );

  it.each([undefined, 'Editing is unavailable'])(
    'omits disabled form carriers and restores values on re-enable (reason: %s)',
    disabledMessage => {
      const subject = (isDisabled: boolean) => (
        <form aria-label="Members form">
          <Tokenizer
            label="Members"
            htmlName="members"
            searchSource={source}
            value={[alice, bob]}
            onChange={vi.fn()}
            isRequired
            isDisabled={isDisabled}
            disabledMessage={disabledMessage}
          />
        </form>
      );
      const {container, rerender} = render(subject(false));
      const form = container.querySelector('form')!;
      const input = screen.getByRole('combobox');
      expect(new FormData(form).getAll('members')).toEqual(['alice', 'bob']);

      rerender(subject(true));
      expect([...new FormData(form)]).toEqual([]);
      expect(form.checkValidity()).toBe(true);
      expect(form.querySelector('input[type="hidden"]')).toBeNull();
      expect(screen.getByRole('combobox')).toBe(input);

      rerender(subject(false));
      expect(new FormData(form).getAll('members')).toEqual(['alice', 'bob']);
      expect(form.checkValidity()).toBe(true);
    },
  );
});
