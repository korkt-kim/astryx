// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file ChatComposerInput.disabled.test.tsx
 * @input Public ChatComposerInput props, editor events, and imperative handle
 * @output Regression coverage for focusable, non-operable disabled editing
 * @position Colocated AST-085 interaction tests; browser focus is also exercised by the story
 */

import {createRef} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {ChatComposer} from './ChatComposer';
import {
  ChatComposerInput,
  type ChatComposerInputHandle,
} from './ChatComposerInput';
import {createStaticSource} from '../Typeahead/createStaticSource';

function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('ChatComposerInput disabled editing', () => {
  it('keeps the same editor focus owner, draft, selection, and Tab entry on disablement', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const rootRef = createRef<HTMLDivElement>();
    const view = (isDisabled: boolean) => (
      <>
        <button type="button">Before</button>
        <ChatComposerInput
          ref={rootRef}
          value="Draft"
          isDisabled={isDisabled}
          onChange={onChange}
          onSubmit={onSubmit}
        />
        <button type="button">After</button>
      </>
    );
    const {rerender} = render(view(false));
    await user.tab();
    await user.tab();
    const editor = screen.getByRole('textbox');
    expect(editor).toHaveFocus();
    const textNode = editor.firstChild!;
    placeCaret(textNode, 2);

    rerender(view(true));
    expect(screen.getByRole('textbox')).toBe(editor);
    expect(rootRef.current).toBe(editor.parentElement);
    expect(editor).toHaveFocus();
    expect(editor).toHaveAttribute('aria-disabled', 'true');
    expect(editor).toHaveAttribute('contenteditable', 'false');
    expect(editor).not.toHaveAttribute('disabled');
    expect(window.getSelection()?.anchorNode).toBe(textNode);
    expect(window.getSelection()?.anchorOffset).toBe(2);
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(editor).toHaveTextContent('Draft');

    screen.getByRole('button', {name: 'Before'}).focus();
    await user.tab();
    expect(editor).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
  });

  it('exposes the caller description on the disabled semantic editor', () => {
    render(
      <>
        <p id="reason">Unavailable while sending</p>
        <ChatComposerInput
          isDisabled
          label="Message"
          aria-describedby="reason"
        />
      </>,
    );
    expect(
      screen.getByRole('textbox', {name: 'Message'}),
    ).toHaveAccessibleDescription('Unavailable while sending');
  });

  it('blocks owned keys, input, paste, and drop before caller callbacks', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    const onFiles = vi.fn();
    const onDrop = vi.fn();
    const onInput = vi.fn();
    const onKeyDownCapture = vi.fn();
    render(
      <ChatComposerInput
        isDisabled
        value="Draft"
        onChange={onChange}
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFiles={onFiles}
        onDrop={onDrop}
        onInput={onInput}
        onKeyDownCapture={onKeyDownCapture}
      />,
    );
    const editor = screen.getByRole('textbox');
    for (const key of [
      'Enter',
      ' ',
      'Backspace',
      'Delete',
      'ArrowUp',
      'ArrowDown',
    ]) {
      fireEvent.keyDown(editor, {key});
    }
    expect(fireEvent.keyDown(editor, {key: 'Tab'})).toBe(true);
    fireEvent.input(editor);
    const file = new File(['content'], 'test.txt', {type: 'text/plain'});
    for (const files of [[], [file]]) {
      expect(
        fireEvent.paste(editor, {
          clipboardData: {files, getData: () => 'pasted text'},
        }),
      ).toBe(false);
      expect(
        fireEvent.drop(editor, {
          dataTransfer: {
            files,
            types: files.length ? ['Files'] : ['text/plain'],
          },
        }),
      ).toBe(false);
    }
    for (const callback of [
      onChange,
      onSubmit,
      onKeyDown,
      onPaste,
      onFiles,
      onDrop,
      onInput,
      onKeyDownCapture,
    ]) {
      expect(callback).not.toHaveBeenCalled();
    }
    expect(editor).toHaveTextContent('Draft');
  });

  it('blocks insert, expand, and token deletion even through a previously captured handle', () => {
    const handleRef = createRef<ChatComposerInputHandle>();
    const onChange = vi.fn();
    const {rerender} = render(
      <ChatComposerInput handleRef={handleRef} onChange={onChange} />,
    );
    const editor = screen.getByRole('textbox');
    const handle = handleRef.current!;
    let tokenId: string | undefined;
    act(() => {
      tokenId = handle.insertToken({value: '@sam', label: 'Sam'});
    });
    expect(tokenId).toBeDefined();
    const token = editor.querySelector('[data-astryx-token]');
    placeCaret(editor.lastChild!, 1);
    const draft = handle.getValue();
    rerender(
      <ChatComposerInput
        isDisabled
        handleRef={handleRef}
        onChange={onChange}
      />,
    );
    onChange.mockClear();

    act(() => {
      handle.insertText('blocked');
      expect(
        handle.insertToken({value: '@alex', label: 'Alex'}),
      ).toBeUndefined();
      handle.expandToken(tokenId!);
    });
    fireEvent.keyDown(editor, {key: 'Backspace'});
    expect(editor.querySelector('[data-astryx-token]')).toBe(token);
    expect(handle.getValue()).toBe(draft);
    expect(onChange).not.toHaveBeenCalled();
    handle.focus();
    expect(editor).toHaveFocus();

    rerender(<ChatComposerInput handleRef={handleRef} onChange={onChange} />);
    act(() => handle.insertText('enabled'));
    expect(handle.getValue()).toContain('enabled');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not recall history while disabled and resumes it when enabled', () => {
    const {rerender} = render(<ChatComposerInput />);
    const editor = screen.getByRole('textbox');
    editor.textContent = 'Previous message';
    fireEvent.input(editor);
    fireEvent.keyDown(editor, {key: 'Enter'});
    editor.textContent = 'Pending draft';
    fireEvent.input(editor);
    placeCaret(editor.firstChild!, 0);
    rerender(<ChatComposerInput isDisabled />);
    fireEvent.keyDown(editor, {key: 'ArrowUp'});
    expect(editor).toHaveTextContent('Pending draft');
    rerender(<ChatComposerInput />);
    fireEvent.keyDown(editor, {key: 'ArrowUp'});
    expect(editor).toHaveTextContent('Previous message');
  });

  it('dismisses an open trigger without selecting and retains combobox semantics', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn(() => '@sam ');
    const triggers = [
      {
        character: '@',
        searchSource: createStaticSource([{id: 'sam', label: 'Sam'}]),
        onSelect,
      },
    ];
    const {rerender} = render(<ChatComposerInput triggers={triggers} />);
    const editor = screen.getByRole('combobox');
    await user.type(editor, '@');
    // jsdom does not expose the native popover in its accessibility tree.
    await screen.findByText('Sam');
    expect(editor).toHaveAttribute('aria-expanded', 'true');
    rerender(<ChatComposerInput isDisabled triggers={triggers} />);
    expect(editor).toHaveAttribute('aria-expanded', 'false');
    expect(editor).not.toHaveAttribute('aria-activedescendant');
    expect(
      screen.queryByRole('option', {hidden: true}),
    ).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(editor).toHaveTextContent('@');
  });

  it('keeps controlled updates available while disabled without emitting edits', () => {
    const onChange = vi.fn();
    const {rerender} = render(
      <ChatComposerInput isDisabled value="Draft" onChange={onChange} />,
    );
    const editor = screen.getByRole('textbox');
    rerender(
      <ChatComposerInput
        isDisabled
        value="External update"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('textbox')).toBe(editor);
    expect(editor).toHaveTextContent('External update');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('inherits composer disablement without clearing the draft or submitting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const view = (isDisabled: boolean) => (
      <ChatComposer
        value="Draft"
        onChange={onChange}
        onSubmit={onSubmit}
        isDisabled={isDisabled}
        input={<ChatComposerInput />}
      />
    );
    const {rerender} = render(view(false));
    const editor = screen.getByRole('textbox');
    editor.focus();
    rerender(view(true));
    await user.keyboard('{Enter}');
    expect(editor).toHaveTextContent('Draft');
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
