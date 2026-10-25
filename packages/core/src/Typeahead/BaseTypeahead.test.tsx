// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file BaseTypeahead.test.tsx
 * @input BaseTypeahead public props, synchronous and asynchronous SearchSources
 * @output Combobox contracts, including renewed enabled focus, disabled guards, inspection, and stale work
 * @position Colocated verification for BaseTypeahead
 */

import {createRef} from 'react';
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

  it('opens on renewed keyboard focus after disabled cached results were explicitly closed', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    const onFocus = vi.fn();
    const source: SearchSource<SearchableItem> = {
      search: () => [],
      bootstrap: () => [resultItem],
    };
    const field = (isDisabled: boolean) => (
      <>
        <button type="button">Before</button>
        <BaseTypeahead
          ref={ref}
          searchSource={source}
          value={resultItem}
          onChange={onChange}
          onOpenChange={onOpenChange}
          onFocus={onFocus}
          hasEntriesOnFocus
          isDisabled={isDisabled}
        />
        <button type="button">After</button>
      </>
    );
    const {rerender} = render(field(false));
    await user.tab();
    await user.tab();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    onOpenChange.mockClear();

    rerender(field(true));
    expect(input).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
    rerender(field(false));
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.tab({shift: true});
    expect(input).toHaveFocus();
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('option', {name: 'Result', hidden: true}),
    ).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();

    // Re-enabling is not itself a new focus intent, even with focus retained.
    await user.keyboard('{Escape}');
    onOpenChange.mockClear();
    rerender(field(true));
    rerender(field(false));
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps renewed-focus results when a pre-disable bootstrap resolves later', async () => {
    const user = userEvent.setup();
    let resolveOld!: (items: SearchableItem[]) => void;
    const old = new Promise<SearchableItem[]>(resolve => {
      resolveOld = resolve;
    });
    const freshItem = {id: 'fresh', label: 'Fresh result'};
    const source: SearchSource<SearchableItem> = {
      search: () => [],
      bootstrap: vi.fn().mockReturnValueOnce(old).mockReturnValue([freshItem]),
    };
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    const field = (isDisabled: boolean) => (
      <>
        <BaseTypeahead
          searchSource={source}
          value={resultItem}
          onChange={onChange}
          onOpenChange={onOpenChange}
          hasEntriesOnFocus
          isDisabled={isDisabled}
        />
        <button type="button">After</button>
      </>
    );
    const {rerender} = render(field(false));
    await user.tab();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-busy', 'true');
    rerender(field(true));
    await user.tab();
    rerender(field(false));
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.tab({shift: true});
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await act(async () => {
      resolveOld([resultItem]);
    });
    expect(
      screen.getByRole('option', {name: 'Fresh result', hidden: true}),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: 'Result', hidden: true}),
    ).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-busy');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(onChange).not.toHaveBeenCalled();
  });

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

  it.each([
    ['keyDown', 'onKeyDownCapture', 'onKeyDown'],
    ['keyPress', 'onKeyPressCapture', 'onKeyPress'],
    ['keyUp', 'onKeyUpCapture', 'onKeyUp'],
    ['click', 'onClickCapture', 'onClick'],
    ['doubleClick', 'onDoubleClickCapture', 'onDoubleClick'],
    ['auxClick', 'onAuxClickCapture', 'onAuxClick'],
    ['pointerDown', 'onPointerDownCapture', 'onPointerDown'],
    ['pointerUp', 'onPointerUpCapture', 'onPointerUp'],
    ['mouseDown', 'onMouseDownCapture', 'onMouseDown'],
    ['mouseUp', 'onMouseUpCapture', 'onMouseUp'],
    ['touchStart', 'onTouchStartCapture', 'onTouchStart'],
    ['touchEnd', 'onTouchEndCapture', 'onTouchEnd'],
  ] as const)(
    'withholds %s activation callbacks in both phases only while disabled',
    (event, capture, bubble) => {
      const calls: string[] = [];
      const ref = createRef<HTMLInputElement>();
      const handlers = {
        [capture]: () => calls.push('capture'),
        [bubble]: () => calls.push('bubble'),
      };
      const field = (isDisabled: boolean) => (
        <BaseTypeahead
          searchSource={emptySource}
          value={null}
          onChange={vi.fn()}
          ref={ref}
          isDisabled={isDisabled}
          {...handlers}
        />
      );
      const {rerender} = render(field(false));
      const input = screen.getByRole('combobox');
      const activate = () =>
        event === 'auxClick'
          ? fireEvent(input, new MouseEvent('auxclick', {bubbles: true}))
          : fireEvent[event](input, {key: 'Enter', charCode: 13});
      activate();
      expect(calls).toEqual(['capture', 'bubble']);
      calls.length = 0;

      rerender(field(true));
      expect(ref.current).toBe(input);
      expect(input).toHaveAttribute('aria-disabled', 'true');
      activate();
      expect(calls).toEqual([]);

      rerender(field(false));
      expect(ref.current).toBe(input);
      activate();
      expect(calls).toEqual(['capture', 'bubble']);
    },
  );

  it.each([
    ['paste', 'clipboardData', 'onPasteCapture', 'onPaste'],
    ['drop', 'dataTransfer', 'onDropCapture', 'onDrop'],
  ] as const)(
    'withholds disabled %s mutation callbacks while preserving enabled phases and cancellation',
    (event, transferProp, capture, bubble) => {
      const calls: string[][] = [];
      const onChange = vi.fn();
      const onChangeQuery = vi.fn();
      const record =
        (phase: string) => (event: React.ClipboardEvent | React.DragEvent) => {
          const transfer =
            'clipboardData' in event ? event.clipboardData : event.dataTransfer;
          calls.push([phase, transfer.getData('text/plain')]);
          event.preventDefault();
        };
      const field = (isDisabled: boolean) => (
        <BaseTypeahead
          searchSource={emptySource}
          value={null}
          onChange={onChange}
          onChangeQuery={onChangeQuery}
          isDisabled={isDisabled}
          {...{[capture]: record('capture'), [bubble]: record('bubble')}}
        />
      );
      const {rerender} = render(field(false));
      const input = screen.getByRole('combobox');
      fireEvent.change(input, {target: {value: 'Original'}});
      onChangeQuery.mockClear();
      const transfer = {
        getData: (format: string) =>
          format === 'text/plain' ? 'Replacement' : '',
      };
      const transferText = () =>
        fireEvent[event](input, {[transferProp]: transfer});
      expect(transferText()).toBe(false);
      expect(calls).toEqual([
        ['capture', 'Replacement'],
        ['bubble', 'Replacement'],
      ]);
      calls.length = 0;

      rerender(field(true));
      transferText();
      expect(calls).toEqual([]);
      expect(input).toHaveValue('Original');
      expect(onChange).not.toHaveBeenCalled();
      expect(onChangeQuery).not.toHaveBeenCalled();

      rerender(field(false));
      expect(transferText()).toBe(false);
      expect(calls).toEqual([
        ['capture', 'Replacement'],
        ['bubble', 'Replacement'],
      ]);
    },
  );

  it('preserves disabled focus, hover, context-menu, selection, and copy/cut inspection', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onFocusCapture = vi.fn();
    const onBlur = vi.fn();
    const onBlurCapture = vi.fn();
    const onPointerEnter = vi.fn();
    const onMouseMove = vi.fn();
    const onSelect = vi.fn();
    const onCopy = vi.fn();
    const onCopyCapture = vi.fn();
    const onCut = vi.fn();
    const onCutCapture = vi.fn();
    const onContextMenu = vi.fn();
    const field = (isDisabled: boolean) => (
      <>
        <button type="button">Before</button>
        <BaseTypeahead
          searchSource={emptySource}
          value={null}
          onChange={vi.fn()}
          isDisabled={isDisabled}
          onFocus={onFocus}
          onFocusCapture={onFocusCapture}
          onBlur={onBlur}
          onBlurCapture={onBlurCapture}
          onPointerEnter={onPointerEnter}
          onMouseMove={onMouseMove}
          onSelect={onSelect}
          onCopy={onCopy}
          onCopyCapture={onCopyCapture}
          onCut={onCut}
          onCutCapture={onCutCapture}
          onContextMenu={onContextMenu}
        />
        <button type="button">After</button>
      </>
    );
    const {rerender} = render(field(false));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, {target: {value: 'Inspect text'}});
    rerender(field(true));
    await user.tab();
    await user.tab();
    expect(input).toHaveFocus();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onFocusCapture).toHaveBeenCalledOnce();
    fireEvent.select(input, {target: {selectionStart: 0, selectionEnd: 12}});
    expect(onSelect).toHaveBeenCalled();
    const clipboard = await user.copy();
    expect(clipboard?.getData('text/plain')).toBe('Inspect text');
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onCopyCapture).toHaveBeenCalledOnce();
    expect(fireEvent.cut(input)).toBe(true);
    expect(onCut).toHaveBeenCalledOnce();
    expect(onCutCapture).toHaveBeenCalledOnce();
    fireEvent.pointerEnter(input);
    fireEvent.mouseMove(input);
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(onMouseMove).toHaveBeenCalledOnce();
    expect(fireEvent.contextMenu(input)).toBe(true);
    expect(onContextMenu).toHaveBeenCalledOnce();
    // Withhold activation callbacks without cancelling native word selection.
    expect(fireEvent.doubleClick(input)).toBe(true);
    expect(input).toHaveValue('Inspect text');
    await user.tab();
    expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
    expect(onBlur).toHaveBeenCalledOnce();
    expect(onBlurCapture).toHaveBeenCalledOnce();
  });

  it.each(['onKeyDownCapture', 'onKeyDown'] as const)(
    'preserves enabled %s cancellation before internal selection',
    async handler => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onKeyUp = vi.fn();
      const cancel = vi.fn((event: React.KeyboardEvent) =>
        event.preventDefault(),
      );
      render(
        <BaseTypeahead
          searchSource={{search: () => [], bootstrap: () => [resultItem]}}
          value={null}
          onChange={onChange}
          hasEntriesOnFocus
          {...{[handler]: cancel}}
          onKeyUp={onKeyUp}
        />,
      );
      await user.tab();
      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      onKeyUp.mockClear();
      await user.keyboard('{Enter}');
      expect(cancel).toHaveBeenCalledOnce();
      expect(onKeyUp).toHaveBeenCalledOnce();
      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-expanded', 'true');
    },
  );

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
