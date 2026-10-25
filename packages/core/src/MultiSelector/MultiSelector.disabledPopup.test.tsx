// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file MultiSelector.disabledPopup.test.tsx
 * @input Uses Testing Library, user-event, and the public MultiSelector API
 * @output Covers retained disabled popup search, clear, and collection owners
 * @position Tests; complements disabled selection-commit and trigger coverage
 */

import {StrictMode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MultiSelector} from './MultiSelector';

const OPTIONS = ['Apple', 'Banana'];
const VALUE = ['Apple'];
const h = {hidden: true} as const;

// Supply only the native primitive missing in jsdom, not component behavior.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
  HTMLElement.prototype.showPopover = vi.fn(function (this: HTMLElement) {
    this.setAttribute('popover-open', '');
    const event = new Event('toggle');
    Object.defineProperty(event, 'newState', {value: 'open'});
    this.dispatchEvent(event);
  });
  HTMLElement.prototype.hidePopover = vi.fn(function (this: HTMLElement) {
    this.removeAttribute('popover-open');
    const event = new Event('toggle');
    Object.defineProperty(event, 'newState', {value: 'closed'});
    this.dispatchEvent(event);
  });
});

const presentations = ['popover', 'bottom-sheet'] as const;

describe('MultiSelector retained popup availability (spec:AST-085)', () => {
  it('keeps modal descriptions text-only and current when an independent caller replaces their source', async () => {
    const user = userEvent.setup();
    const external = render(
      <span id="external-help">
        <a href="#help">Caller help</a>
      </span>,
    );
    const field = (isDisabled: boolean) => (
      <StrictMode>
        <MultiSelector
          label="Fruit"
          aria-describedby="external-help"
          disabledMessage="Fruit unavailable"
          options={OPTIONS}
          value={VALUE}
          onChange={vi.fn()}
          isDisabled={isDisabled}
          presentation="bottom-sheet"
          hasSearch
        />
      </StrictMode>
    );
    const view = render(field(false));
    await user.click(screen.getByRole('button', {name: 'Fruit'}));
    const search = await screen.findByRole('combobox', {
      name: 'Search options',
      ...h,
    });
    await waitFor(() => expect(search).toHaveFocus());
    view.rerender(field(true));
    expect(search).toHaveAccessibleDescription('Caller help Fruit unavailable');
    const projection = document.getElementById(
      search.getAttribute('aria-describedby')?.split(' ')[0] ?? '',
    );
    expect(
      projection?.querySelector('a, button, input, [tabindex]'),
    ).toBeNull();
    // Only the independent source root rerenders; MultiSelector must not be
    // needed to discover a new owner of the same description ID.
    external.rerender(
      <span key="replacement" id="external-help">
        Replacement help
      </span>,
    );
    await waitFor(() =>
      expect(search).toHaveAccessibleDescription(
        'Replacement help Fruit unavailable',
      ),
    );
    external.rerender(null);
    await waitFor(() =>
      expect(search).toHaveAccessibleDescription(/^\s*Fruit unavailable$/),
    );
    external.rerender(<span id="external-help">Reappeared help</span>);
    await waitFor(() =>
      expect(search).toHaveAccessibleDescription(
        'Reappeared help Fruit unavailable',
      ),
    );
    expect(search).toHaveFocus();
    expect(screen.getByRole('combobox', {name: 'Search options', ...h})).toBe(
      search,
    );
    view.unmount();
    external.rerender(<span id="external-help">After unmount</span>);
    expect(projection).toHaveTextContent('Reappeared help');
  });

  describe.each(presentations)('%s', presentation => {
    it.each([false, true])(
      'blocks search edits and preserves the active input and descriptions (reason=%s)',
      async reason => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const changeAction = vi.fn();
        const field = (isDisabled: boolean) => (
          <form aria-label="Form">
            <span id="caller-help">Caller help</span>
            <MultiSelector
              label="Fruit"
              description="Choose a fruit"
              aria-describedby="caller-help"
              disabledMessage={reason ? 'Fruit unavailable' : undefined}
              options={OPTIONS}
              value={VALUE}
              onChange={onChange}
              changeAction={changeAction}
              isDisabled={isDisabled}
              presentation={presentation}
              hasSearch
              htmlName="fruit"
            />
          </form>
        );
        const {rerender} = render(field(false));
        await user.click(screen.getByRole('button', {name: 'Fruit'}));
        const search = await screen.findByRole('combobox', {
          name: 'Search options',
          ...h,
        });
        await waitFor(() => expect(search).toHaveFocus());
        const tabIndex = search.tabIndex;
        rerender(field(true));
        expect(search).toHaveFocus();
        expect(
          screen.getByRole('combobox', {name: 'Search options', ...h}),
        ).toBe(search);
        expect(search.tabIndex).toBe(tabIndex);
        expect.soft(search).toHaveAttribute('aria-disabled', 'true');
        expect(search).not.toHaveAttribute('disabled');
        expect.soft(search).toHaveAttribute('readonly');
        expect
          .soft(search)
          .toHaveAccessibleDescription(
            reason
              ? 'Caller help Choose a fruit Fruit unavailable'
              : 'Caller help Choose a fruit',
          );
        await user.keyboard('Ban');
        expect.soft(search).toHaveValue('');
        await user.paste('Cherry');
        expect.soft(search).toHaveValue('');
        fireEvent.change(search, {target: {value: 'Apple'}});
        expect.soft(search).toHaveValue('');
        expect(onChange).not.toHaveBeenCalled();
        expect(changeAction).not.toHaveBeenCalled();
        const form = screen.getByRole<HTMLFormElement>('form', {
          name: 'Form',
          ...h,
        });
        expect(new FormData(form).getAll('fruit')).toEqual([]);
        rerender(field(false));
        expect(search).toHaveFocus();
        expect(search).not.toHaveAttribute('readonly');
        expect(search).not.toHaveAttribute('aria-disabled');
        await user.clear(search);
        await user.type(search, 'Ban');
        expect(search).toHaveValue('Ban');
        expect(screen.getAllByRole('option', h)).toHaveLength(1);
        expect(
          screen.getByRole('option', {name: 'Banana', ...h}),
        ).toBeInTheDocument();
        expect(new FormData(form).getAll('fruit')).toEqual(VALUE);
      },
    );

    it.each([false, true])(
      'keeps the existing focused search clear inert and described (reason=%s)',
      async reason => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const changeAction = vi.fn();
        const field = (isDisabled: boolean) => (
          <>
            <span id="caller-help">Caller help</span>
            <MultiSelector
              label="Fruit"
              description="Choose a fruit"
              aria-describedby="caller-help"
              disabledMessage={reason ? 'Fruit unavailable' : undefined}
              options={OPTIONS}
              value={VALUE}
              onChange={onChange}
              changeAction={changeAction}
              isDisabled={isDisabled}
              presentation={presentation}
              hasSearch
            />
          </>
        );
        const {rerender} = render(field(false));
        await user.click(screen.getByRole('button', {name: 'Fruit'}));
        const search = await screen.findByRole('combobox', {
          name: 'Search options',
          ...h,
        });
        await waitFor(() => expect(search).toHaveFocus());
        await user.type(search, 'a');
        await user.tab();
        const clear = screen.getByRole('button', {
          name: 'Clear Search options',
          ...h,
        });
        expect(clear).toHaveFocus();
        const tabIndex = clear.tabIndex;
        rerender(field(true));
        expect(clear).toHaveFocus();
        expect(clear.tabIndex).toBe(tabIndex);
        expect(clear).not.toHaveAttribute('disabled');
        expect.soft(clear).toHaveAttribute('aria-disabled', 'true');
        expect
          .soft(clear)
          .toHaveAccessibleDescription(/Caller help Choose a fruit/);
        if (reason) {
          expect.soft(clear).toHaveAccessibleDescription(/Fruit unavailable/);
        }
        await user.keyboard('{Enter} ');
        expect.soft(search).toHaveValue('a');
        expect.soft(clear).toHaveFocus();
        // Use the retained public DOM control even if a broken clear unmounts it.
        fireEvent.click(clear);
        expect.soft(search).toHaveValue('a');
        expect(onChange).not.toHaveBeenCalled();
        expect(changeAction).not.toHaveBeenCalled();
        rerender(field(false));
        // Enabled recovery remains independently observable after a baseline failure.
        await user.clear(search);
        await user.type(search, 'a');
        await user.tab();
        await user.keyboard('{Enter}');
        expect(search).toHaveValue('');
        expect(search).toHaveFocus();
      },
    );
  });

  it.each([
    {presentation: 'popover' as const, external: true},
    {presentation: 'bottom-sheet' as const, external: false},
  ])(
    'describes the retained non-search collection owner ($presentation)',
    async ({presentation, external}) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const changeAction = vi.fn();
      const field = (isDisabled: boolean) => (
        <>
          <span id="caller-help">Caller help</span>
          <MultiSelector
            label="Fruit"
            description="Choose a fruit"
            aria-describedby="caller-help"
            disabledMessage="Fruit unavailable"
            options={OPTIONS}
            value={VALUE}
            onChange={onChange}
            changeAction={changeAction}
            isDisabled={isDisabled}
            presentation={presentation}
            renderTrigger={
              external
                ? props => (
                    <button type="button" {...props}>
                      Choose fruit
                    </button>
                  )
                : undefined
            }
          />
        </>
      );
      const {rerender} = render(field(false));
      await user.click(
        screen.getByRole(external ? 'button' : 'combobox', {
          name: external ? 'Choose fruit' : 'Fruit',
        }),
      );
      const listbox = await screen.findByRole('listbox', h);
      await waitFor(() => expect(listbox).toHaveFocus());
      const tabIndex = listbox.tabIndex;
      rerender(field(true));
      expect(listbox).toHaveFocus();
      expect(screen.getByRole('listbox', h)).toBe(listbox);
      expect(listbox.tabIndex).toBe(tabIndex);
      expect.soft(listbox).toHaveAttribute('aria-disabled', 'true');
      expect.soft(listbox).toHaveAccessibleDescription(/Caller help/);
      expect.soft(listbox).toHaveAccessibleDescription(/Fruit unavailable/);
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onChange).not.toHaveBeenCalled();
      expect(changeAction).not.toHaveBeenCalled();
      rerender(field(false));
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onChange).toHaveBeenCalledOnce();
      expect(changeAction).toHaveBeenCalledOnce();
    },
  );
});
