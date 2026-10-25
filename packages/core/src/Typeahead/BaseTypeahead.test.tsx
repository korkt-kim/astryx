// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file BaseTypeahead.test.tsx
 * @input BaseTypeahead public props, synchronous and asynchronous SearchSources
 * @output Combobox contracts, including disabled focus, activation, and stale work
 * @position Colocated verification for BaseTypeahead
 */

import {afterAll, beforeAll, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as stylex from '@stylexjs/stylex';
import {BaseTypeahead} from './BaseTypeahead';
import type {SearchSource, SearchableItem} from './types';

const popoverOpenState = new WeakMap<HTMLElement, boolean>();
const originalMatchesDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'matches',
);
const originalMatches = HTMLElement.prototype.matches;

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {
    popoverOpenState.set(this, true);
    const event = new Event('toggle');
    Object.defineProperty(event, 'newState', {value: 'open'});
    this.dispatchEvent(event);
  };
  HTMLElement.prototype.hidePopover = function () {
    popoverOpenState.set(this, false);
    const event = new Event('toggle');
    Object.defineProperty(event, 'newState', {value: 'closed'});
    this.dispatchEvent(event);
  };
  Object.defineProperty(HTMLElement.prototype, 'matches', {
    ...originalMatchesDescriptor,
    value(this: HTMLElement, selector: string) {
      if (selector === ':popover-open') {
        return popoverOpenState.get(this) ?? false;
      }
      return originalMatches.call(this, selector);
    },
  });
});

afterAll(() => {
  if (originalMatchesDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'matches',
      originalMatchesDescriptor,
    );
  }
});

const emptySource: SearchSource<SearchableItem> = {
  search: () => [],
  bootstrap: () => [],
};

const resultItem: SearchableItem = {id: '1', label: 'Result'};

const testStyles = stylex.create({
  input: {textTransform: 'uppercase'},
});

describe('BaseTypeahead', () => {
  it.each([undefined, false, true])(
    'keeps disabled inputs focusable and inert with isFocusableDisabled=%s',
    async isFocusableDisabled => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onChangeQuery = vi.fn();
      const bootstrap = vi.fn(() => [resultItem]);
      render(
        <>
          <button type="button">Before</button>
          <BaseTypeahead
            searchSource={{search: () => [resultItem], bootstrap}}
            value={resultItem}
            onChange={onChange}
            onChangeQuery={onChangeQuery}
            isDisabled
            isFocusableDisabled={isFocusableDisabled}
            hasEntriesOnFocus
            aria-label="Search"
            aria-describedby="disabled-reason"
          />
          <span id="disabled-reason">Not available</span>
          <button type="button">After</button>
        </>,
      );
      const input = screen.getByRole('combobox', {name: 'Search'});
      await user.tab();
      await user.tab();
      expect(input).toHaveFocus();
      expect(input).not.toHaveAttribute('disabled');
      expect(input).toHaveAttribute('aria-disabled', 'true');
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAccessibleDescription('Not available');
      await user.keyboard('{ArrowDown}{Enter}');
      await user.type(input, 'query');
      expect(input).toHaveValue('');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(bootstrap).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(onChangeQuery).not.toHaveBeenCalled();
      await user.tab();
      expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
    },
  );

  it('does not open on ArrowDown when initially focusable-disabled', async () => {
    const user = userEvent.setup();
    const bootstrap = vi.fn(() => [resultItem]);
    render(
      <BaseTypeahead
        searchSource={{search: () => [], bootstrap}}
        value={null}
        onChange={vi.fn()}
        hasEntriesOnFocus
        isDisabled
        isFocusableDisabled
      />,
    );
    const input = screen.getByRole('combobox');
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'pointer'])(
    'rejects %s selection after an enabled open highlight becomes disabled',
    async activation => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const source: SearchSource<SearchableItem> = {
        search: () => [],
        bootstrap: () => [resultItem, {id: '2', label: 'Banana'}],
      };
      const field = (isDisabled: boolean) => (
        <BaseTypeahead
          searchSource={source}
          value={resultItem}
          onChange={onChange}
          hasEntriesOnFocus
          isDisabled={isDisabled}
          isFocusableDisabled
        />
      );
      const {rerender} = render(field(false));
      const input = screen.getByRole('combobox');
      await user.tab();
      await user.keyboard('{ArrowDown}');
      const option = screen.getByRole('option', {name: 'Banana', hidden: true});
      expect(input).toHaveAttribute('aria-activedescendant', option.id);
      rerender(field(true));
      if (activation === 'Enter') {
        await user.keyboard('{Enter}');
      } else {
        fireEvent.click(option);
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    },
  );

  it.each(['search', 'bootstrap'] as const)(
    'invalidates pending %s on disablement even if re-enabled before resolution',
    async operation => {
      const user = userEvent.setup();
      let resolve!: (items: SearchableItem[]) => void;
      const pending = new Promise<SearchableItem[]>(done => {
        resolve = done;
      });
      const onOpenChange = vi.fn();
      const onChange = vi.fn();
      const source: SearchSource<SearchableItem> = {
        search: vi.fn(async () => pending),
        bootstrap: vi.fn(async () =>
          operation === 'bootstrap' ? pending : [],
        ),
        cancel: vi.fn(),
      };
      const field = (isDisabled: boolean) => (
        <BaseTypeahead
          searchSource={source}
          value={null}
          onChange={onChange}
          onOpenChange={onOpenChange}
          isDisabled={isDisabled}
          hasEntriesOnFocus={operation === 'bootstrap'}
          debounceMs={0}
        />
      );
      const {rerender} = render(field(false));
      const input = screen.getByRole('combobox');
      await user.tab();
      if (operation === 'search') {
        await user.type(input, 'query');
      }
      expect(input).toHaveAttribute('aria-busy', 'true');
      rerender(field(true));
      expect(input).not.toHaveAttribute('aria-busy');
      rerender(field(false));
      await act(async () => {
        resolve([resultItem]);
      });
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(
        screen.queryByRole('option', {name: 'Result', hidden: true}),
      ).not.toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(true);
      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveFocus();
    },
  );

  it('cancels a scheduled search when disabled and retains the query', async () => {
    const search = vi.fn(() => [resultItem]);
    const source = {search, bootstrap: () => []};
    const field = (isDisabled: boolean) => (
      <BaseTypeahead
        searchSource={source}
        value={null}
        onChange={vi.fn()}
        isDisabled={isDisabled}
        debounceMs={20}
      />
    );
    const {rerender} = render(field(false));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, {target: {value: 'query'}});
    rerender(field(true));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    expect(search).not.toHaveBeenCalled();
    expect(input).toHaveValue('query');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('rejects a pointer-deferred open after disablement', async () => {
    const source = {search: () => [], bootstrap: () => [resultItem]};
    const field = (isDisabled: boolean) => (
      <BaseTypeahead
        searchSource={source}
        value={null}
        onChange={vi.fn()}
        isDisabled={isDisabled}
        hasEntriesOnFocus
      />
    );
    const {rerender} = render(field(false));
    const input = screen.getByRole('combobox');
    fireEvent.pointerDown(input);
    fireEvent.focus(input);
    rerender(field(true));
    fireEvent.click(input);
    await act(async () => {
      await new Promise(requestAnimationFrame);
    });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('blocks query and activation callbacks while preserving focus observation', () => {
    const onChangeQuery = vi.fn();
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    const onFocus = vi.fn();
    const queryEntries = vi.fn(() => [resultItem]);
    render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={vi.fn()}
        isDisabled
        isFocusableDisabled
        onChangeQuery={onChangeQuery}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        __queryEntries={queryEntries}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.pointerDown(input);
    fireEvent.click(input);
    fireEvent.keyDown(input, {key: 'Backspace'});
    fireEvent.change(input, {target: {value: 'query'}});
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onChangeQuery).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(queryEntries).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('ignores isFocusableDisabled on an enabled input and preserves an explicit Tab exclusion', async () => {
    const user = userEvent.setup();
    const onChangeQuery = vi.fn();
    const {rerender} = render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={vi.fn()}
        onChangeQuery={onChangeQuery}
        isFocusableDisabled
        inputTabIndex={-1}
      />,
    );
    const input = screen.getByRole('combobox');
    await user.type(input, 'a');
    expect(input).toHaveValue('a');
    expect(onChangeQuery).toHaveBeenCalledWith('a');
    expect(input).not.toHaveAttribute('aria-disabled');
    rerender(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={vi.fn()}
        isDisabled
        inputTabIndex={-1}
      />,
    );
    expect(input).toHaveAttribute('tabindex', '-1');
    expect(input).toHaveFocus();
  });

  it('forwards supported DOM, styling, and event props to the combobox input', () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onPointerDown = vi.fn();

    render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={() => {}}
        aria-label="Find a framework"
        aria-expanded="true"
        className="consumer-input"
        data-audit-state="forwarded"
        onBlur={onBlur}
        onFocus={onFocus}
        onPointerDown={onPointerDown}
        style={{letterSpacing: '0.08em'}}
        xstyle={testStyles.input}
      />,
    );

    const input = screen.getByRole('combobox', {name: 'Find a framework'});
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('data-audit-state', 'forwarded');
    expect(input).toHaveClass('consumer-input');
    expect(input).toHaveStyle({letterSpacing: '0.08em'});
    expect(getComputedStyle(input).textTransform).toBe('uppercase');

    fireEvent.pointerDown(input);
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('preserves native input attributes when legacy aliases are undefined', () => {
    render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={() => {}}
        id="native-input"
        aria-describedby="native-description"
        aria-labelledby="native-label"
        tabIndex={3}
        inputId={undefined}
        ariaDescribedBy={undefined}
        ariaLabelledBy={undefined}
        inputTabIndex={undefined}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('id', 'native-input');
    expect(input).toHaveAttribute('aria-describedby', 'native-description');
    expect(input).toHaveAttribute('aria-labelledby', 'native-label');
    expect(input).toHaveAttribute('tabindex', '3');
  });

  it('lets defined legacy aliases override their native equivalents', () => {
    render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={() => {}}
        id="native-input"
        aria-describedby="native-description"
        aria-labelledby="native-label"
        tabIndex={3}
        inputId="legacy-input"
        ariaDescribedBy="legacy-description"
        ariaLabelledBy="legacy-label"
        inputTabIndex={-1}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('id', 'legacy-input');
    expect(input).toHaveAttribute('aria-describedby', 'legacy-description');
    expect(input).toHaveAttribute('aria-labelledby', 'legacy-label');
    expect(input).toHaveAttribute('tabindex', '-1');
  });

  it('refreshes nonempty cached results after source replacement on a focused-input click', async () => {
    const user = userEvent.setup();
    const originalSource: SearchSource<SearchableItem> = {
      search: () => [],
      bootstrap: () => [resultItem],
    };
    const updatedSource: SearchSource<SearchableItem> = {
      search: () => [],
      bootstrap: () => [{id: '2', label: 'Updated result'}],
    };
    const {rerender} = render(
      <BaseTypeahead
        searchSource={originalSource}
        value={null}
        onChange={() => {}}
        hasEntriesOnFocus
      />,
    );
    const input = screen.getByRole('combobox');

    await user.click(input);
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    expect(
      screen.getByRole('option', {name: 'Result', hidden: true}),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    rerender(
      <BaseTypeahead
        searchSource={updatedSource}
        value={null}
        onChange={() => {}}
        hasEntriesOnFocus
      />,
    );
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('option', {name: 'Result', hidden: true}),
    ).toBeInTheDocument();

    await user.click(input);
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByRole('option', {name: 'Updated result', hidden: true}),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('option', {name: 'Result', hidden: true}),
    ).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it.each([
    ['a click', 'click'],
    ['keyboard focus', 'tab'],
  ] as const)(
    'bootstraps the replacement source when %s refocuses the input',
    async (_label, refocus) => {
      const user = userEvent.setup();
      const originalSource: SearchSource<SearchableItem> = {
        search: () => [],
        bootstrap: () => [resultItem],
      };
      const updatedBootstrap = vi.fn(() => [
        {id: '2', label: 'Updated result'},
      ]);
      const updatedSource: SearchSource<SearchableItem> = {
        search: () => [],
        bootstrap: updatedBootstrap,
      };
      const renderField = (searchSource: SearchSource<SearchableItem>) => (
        <>
          <BaseTypeahead
            searchSource={searchSource}
            value={null}
            onChange={() => {}}
            hasEntriesOnFocus
          />
          <button type="button">Sort</button>
        </>
      );
      const {rerender} = render(renderField(originalSource));
      const input = screen.getByRole('combobox');
      const sortButton = screen.getByRole('button', {name: 'Sort'});

      await user.click(input);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
      });

      // Focus moves to another control, which then hands the field a new
      // source (a sort or filter change rebuilding the caller's source).
      await user.click(sortButton);
      expect(input).not.toHaveFocus();
      expect(input).toHaveAttribute('aria-expanded', 'false');
      rerender(renderField(updatedSource));

      if (refocus === 'click') {
        await user.click(input);
      } else {
        await user.tab({shift: true});
      }
      expect(input).toHaveFocus();
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(
          screen.getByRole('option', {name: 'Updated result', hidden: true}),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByRole('option', {name: 'Result', hidden: true}),
      ).not.toBeInTheDocument();
      expect(updatedBootstrap).toHaveBeenCalledTimes(1);
    },
  );

  it('re-shows cached results without bootstrapping again when the source is unchanged', async () => {
    const user = userEvent.setup();
    const bootstrap = vi.fn(() => [resultItem]);
    const source: SearchSource<SearchableItem> = {search: () => [], bootstrap};
    render(
      <>
        <BaseTypeahead
          searchSource={source}
          value={null}
          onChange={() => {}}
          hasEntriesOnFocus
        />
        <button type="button">Sort</button>
      </>,
    );
    const input = screen.getByRole('combobox');

    await user.click(input);
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    await user.click(screen.getByRole('button', {name: 'Sort'}));
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.click(input);
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });
    expect(
      screen.getByRole('option', {name: 'Result', hidden: true}),
    ).toBeInTheDocument();
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('counts grapheme clusters when enforcing minQueryLength', async () => {
    const search = vi.fn(() => [resultItem]);
    render(
      <BaseTypeahead
        searchSource={{search, bootstrap: () => []}}
        value={null}
        onChange={() => {}}
        debounceMs={0}
        minQueryLength={2}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, {target: {value: '😀'}});
    await Promise.resolve();
    expect(search).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.change(input, {target: {value: '😀a'}});
    await waitFor(() => expect(search).toHaveBeenCalledExactlyOnceWith('😀a'));
  });

  it('exposes a completed empty search as a disabled listbox option', async () => {
    render(
      <BaseTypeahead
        searchSource={emptySource}
        value={null}
        onChange={() => {}}
        debounceMs={0}
        emptySearchText="No matching frameworks"
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: {value: 'none'},
    });

    await waitFor(() => {
      expect(
        screen.getByRole('option', {
          hidden: true,
          name: 'No matching frameworks',
        }),
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
