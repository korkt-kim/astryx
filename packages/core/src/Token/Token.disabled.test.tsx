// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Token.disabled.test.tsx
 * @input Token's public href, isDisabled, removal, ref, and LinkProvider APIs
 * @output Regressions for stable, focusable, inert disabled link tokens
 * @position Component-local disabled transition coverage; browser evidence
 *   separately verifies real focus, navigation, and accessibility-tree state.
 *
 * SYNC: When Token's link structures change, preserve these transition checks.
 */

import {createRef, type ComponentPropsWithRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {LinkProvider} from '../Link/LinkProvider';
import {InteractiveRoleContext} from '../InteractiveRoleContext/InteractiveRoleContext';
import {Token} from './Token';

function RouterLink(props: ComponentPropsWithRef<'a'>) {
  if (props.href == null) {
    throw new Error('RouterLink requires a destination');
  }
  return <a {...props} data-router-link="true" />;
}

for (const removable of [false, true]) {
  for (const customLink of [false, true]) {
    describe(`disabled Token: removable=${removable}, customLink=${customLink}`, () => {
      it('keeps the focused link, its name, and tab stop across disable and re-enable', async () => {
        const user = userEvent.setup();
        const ref = createRef<HTMLElement>();
        const onRemove = removable ? vi.fn() : undefined;
        function fixture(isDisabled: boolean) {
          const content = (
            <>
              <button type="button">Before</button>
              <Token
                ref={ref}
                label="Tag"
                href="#destination"
                onRemove={onRemove}
                isDisabled={isDisabled}
                data-testid="token"
              />
              <button type="button">After</button>
            </>
          );
          return customLink ? (
            <LinkProvider component={RouterLink}>{content}</LinkProvider>
          ) : (
            content
          );
        }
        const {rerender} = render(fixture(false));
        const root = ref.current;
        const link = screen.getByRole('link', {name: 'Tag'});
        await user.tab();
        await user.tab();
        expect(link).toHaveFocus();

        rerender(fixture(true));
        expect(screen.getByRole('link', {name: 'Tag'})).toBe(link);
        expect(link).toHaveFocus();
        expect(ref.current).toBe(root);
        expect(link).toHaveAttribute('aria-disabled', 'true');
        expect(link).not.toHaveAttribute('disabled');
        expect(link).not.toHaveAttribute('href');
        if (customLink) {
          expect(link).toHaveAttribute('data-router-link', 'true');
        }

        await user.tab({shift: true});
        expect(screen.getByRole('button', {name: 'Before'})).toHaveFocus();
        await user.tab();
        expect(link).toHaveFocus();
        await user.tab();
        if (removable) {
          expect(
            screen.getByRole('button', {name: 'Remove Tag'}),
          ).toHaveFocus();
          expect(
            screen.getByRole('button', {name: 'Remove Tag'}),
          ).toHaveAttribute('aria-disabled', 'true');
          await user.tab();
        }
        expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();

        link.focus();
        rerender(fixture(false));
        expect(screen.getByRole('link', {name: 'Tag'})).toBe(link);
        expect(link).toHaveFocus();
        expect(link).toHaveAttribute('href', '#destination');
        expect(link).not.toHaveAttribute('aria-disabled');
      });

      it('blocks forwarded activation handlers but preserves inspection events', () => {
        const activation = {
          onClickCapture: vi.fn(),
          onDoubleClick: vi.fn(),
          onDoubleClickCapture: vi.fn(),
          onAuxClick: vi.fn(),
          onAuxClickCapture: vi.fn(),
          onContextMenu: vi.fn(),
          onDragStart: vi.fn(),
          onKeyDown: vi.fn(),
          onKeyDownCapture: vi.fn(),
          onKeyUp: vi.fn(),
          onKeyUpCapture: vi.fn(),
        };
        const onFocus = vi.fn();
        const onBlur = vi.fn();
        function fixture(isDisabled: boolean) {
          const token = (
            <Token
              label="Tag"
              href="#destination"
              isDisabled={isDisabled}
              onRemove={removable ? () => {} : undefined}
              data-testid="token"
              {...activation}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          );
          return customLink ? (
            <LinkProvider component={RouterLink}>{token}</LinkProvider>
          ) : (
            token
          );
        }
        const {rerender} = render(fixture(false));
        const link = screen.getByRole('link', {name: 'Tag'});
        rerender(fixture(true));
        link.focus();
        link.blur();
        expect(onFocus).toHaveBeenCalledOnce();
        expect(onBlur).toHaveBeenCalledOnce();
        for (const node of new Set([link, screen.getByTestId('token')])) {
          fireEvent.click(node);
          fireEvent.doubleClick(node);
          fireEvent(
            node,
            new MouseEvent('auxclick', {
              bubbles: true,
              cancelable: true,
              button: 1,
            }),
          );
          fireEvent.contextMenu(node);
          fireEvent.dragStart(node);
          for (const key of ['Enter', ' ']) {
            fireEvent.keyDown(node, {key});
            fireEvent.keyUp(node, {key});
          }
        }
        for (const handler of Object.values(activation)) {
          expect(handler).not.toHaveBeenCalled();
        }
        fireEvent.keyDown(link, {key: 'Escape'});
        fireEvent.keyUp(link, {key: 'Escape'});
        for (const handler of [
          activation.onKeyDown,
          activation.onKeyDownCapture,
          activation.onKeyUp,
          activation.onKeyUpCapture,
        ]) {
          expect(handler).toHaveBeenCalledOnce();
        }
        rerender(fixture(false));
        fireEvent.doubleClick(link);
        expect(activation.onDoubleClick).toHaveBeenCalledOnce();
        expect(activation.onDoubleClickCapture).toHaveBeenCalledOnce();
      });

      it('blocks keyboard, direct and delegated activation while disabled', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const onRemove = vi.fn();
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const token = (
          <Token
            label="Tag"
            href="#destination"
            isDisabled
            onClick={onClick}
            onRemove={removable ? onRemove : undefined}
            icon={<span data-testid="icon">Icon</span>}
          />
        );
        render(
          customLink ? (
            <LinkProvider component={RouterLink}>{token}</LinkProvider>
          ) : (
            token
          ),
        );
        const link = screen.getByRole('link', {name: /Tag/});
        expect(link).not.toHaveAttribute('href');
        await user.tab();
        expect(link).toHaveFocus();
        await user.keyboard('{Enter} ');
        fireEvent.click(link);
        fireEvent.click(link, {metaKey: true});
        fireEvent(
          link,
          new MouseEvent('auxclick', {
            bubbles: true,
            cancelable: true,
            button: 1,
          }),
        );
        fireEvent.click(screen.getByTestId('icon'));
        fireEvent.click(screen.getByTestId('icon'), {ctrlKey: true});
        fireEvent.mouseUp(screen.getByTestId('icon'), {button: 1});
        if (removable) {
          await user.tab();
          await user.keyboard('{Enter} ');
          fireEvent.click(screen.getByRole('button', {name: 'Remove Tag'}));
        }
        expect(onClick).not.toHaveBeenCalled();
        expect(onRemove).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
        open.mockRestore();
      });
    });
  }
}

describe('disabled Token link attributes', () => {
  it('preserves caller ARIA when enabled and overrides it only while disabled', () => {
    const fixture = (isDisabled: boolean) => (
      <Token
        label="Tag"
        href="#destination"
        aria-disabled={false}
        isDisabled={isDisabled}
      />
    );
    const {rerender} = render(fixture(false));
    const link = screen.getByRole('link', {name: 'Tag'});
    expect(link).toHaveAttribute('aria-disabled', 'false');
    rerender(fixture(true));
    expect(link).toHaveAttribute('aria-disabled', 'true');
    rerender(fixture(false));
    expect(screen.getByRole('link', {name: 'Tag'})).toBe(link);
    expect(link).toHaveAttribute('aria-disabled', 'false');
  });

  it.each([false, true])(
    'does not add a tab stop for a rejected destination (removable=%s)',
    async removable => {
      const user = userEvent.setup();
      const rejectedHref = 'javascript:alert(1)';
      const fixture = (isDisabled: boolean) => (
        <>
          <button type="button">Before</button>
          <Token
            label="Tag"
            // eslint-disable-next-line @eslint-react/dom-no-script-url -- verifies rejected input never gains a Tab stop
            href={rejectedHref}
            isDisabled={isDisabled}
            onRemove={removable ? () => {} : undefined}
          />
          <button type="button">After</button>
        </>
      );
      const {rerender} = render(fixture(false));
      const next = screen.getByRole('button', {
        name: removable ? 'Remove Tag' : 'After',
      });
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(next).toHaveFocus();
      rerender(fixture(true));
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(next).toHaveFocus();
    },
  );

  it('keeps link priority over an enclosing trigger context while disabled', () => {
    const fixture = (isDisabled: boolean) => (
      <InteractiveRoleContext value="button">
        <Token label="Tag" href="#destination" isDisabled={isDisabled} />
      </InteractiveRoleContext>
    );
    const {rerender} = render(fixture(false));
    const link = screen.getByRole('link', {name: 'Tag'});
    link.focus();
    rerender(fixture(true));
    expect(screen.getByRole('link', {name: 'Tag'})).toBe(link);
    expect(link).toHaveFocus();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves the non-link context trigger and its disabled guard', async () => {
    const user = userEvent.setup();
    const activate = vi.fn();
    const fixture = (isDisabled: boolean) => (
      <InteractiveRoleContext value="button">
        <Token label="Tag" isDisabled={isDisabled} />
      </InteractiveRoleContext>
    );
    const {rerender} = render(fixture(false));
    const button = screen.getByRole('button', {name: 'Tag'});
    button.addEventListener('click', activate);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(activate).toHaveBeenCalledOnce();
    activate.mockClear();
    rerender(fixture(true));
    expect(screen.getByRole('button', {name: 'Tag'})).toBe(button);
    expect(button).toHaveFocus();
    await user.keyboard('{Enter} ');
    expect(activate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps rejected destinations out of the router (removable=%s)',
    removable => {
      const router = vi.fn(RouterLink);
      const fixture = (href: string, isDisabled: boolean) => (
        <LinkProvider component={router}>
          <Token
            label="Tag"
            href={href}
            isDisabled={isDisabled}
            onRemove={removable ? () => {} : undefined}
          />
        </LinkProvider>
      );
      const {rerender} = render(fixture('#destination', false));
      expect(router).toHaveBeenCalled();
      router.mockClear();
      rerender(fixture('javascript:alert(1)', true));
      expect(router).not.toHaveBeenCalled();
      expect(screen.getByRole('link', {name: 'Tag'})).not.toHaveAttribute(
        'href',
      );
      rerender(fixture('javascript:alert(1)', false));
      expect(router).not.toHaveBeenCalled();
      expect(screen.getByText('Tag').closest('a')).not.toHaveAttribute('href');
    },
  );

  it('preserves an explicit tab exclusion', async () => {
    const user = userEvent.setup();
    const {rerender} = render(
      <Token label="Tag" href="#destination" tabIndex={-1} />,
    );
    const link = screen.getByRole('link', {name: 'Tag'});
    link.focus();
    rerender(
      <>
        <Token label="Tag" href="#destination" tabIndex={-1} isDisabled />
        <button type="button">After</button>
      </>,
    );
    expect(screen.getByRole('link', {name: 'Tag'})).toBe(link);
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
  });

  it('keeps the description and caller reason on a disabled root link', () => {
    render(
      <>
        <Token
          label="Tag"
          href="#destination"
          isDisabled
          description="Tag details"
          aria-describedby="reason"
        />
        <p id="reason">Unavailable until approved</p>
      </>,
    );
    const link = screen.getByRole('link', {name: 'Tag'});
    expect(link).toHaveAttribute('aria-description', 'Tag details');
    expect(link).toHaveAccessibleDescription('Unavailable until approved');
  });
});
