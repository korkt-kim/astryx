// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file NavHeadingMenuItem.test.tsx
 * @input Public NavMenu exports and browser-like user interaction
 * @output Regression coverage for disabled navigation, action callbacks, and focus
 * @position Component-local tests for NavHeadingMenuItem
 */

import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRef, type ComponentPropsWithRef} from 'react';
import {renderToString} from 'react-dom/server';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {LinkProvider} from '../Link';
import {
  NavHeadingCloseContext,
  NavHeadingMenu,
  NavHeadingMenuItem,
} from './index';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('NavHeadingMenuItem disabled navigation', () => {
  it('does not become a Tab stop that navigates on Enter when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <NavHeadingMenuItem
          label="Destination"
          href="#probe-destination"
          isDisabled
          onClick={onClick}
        />
        <button type="button">After</button>
      </>,
    );
    screen.getByRole('button', {name: 'Before'}).focus();

    await user.tab();
    await user.keyboard('{Enter}');

    expect(onClick).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
  });

  it.each(['native', 'router'] as const)(
    'keeps the focused %s menu item inert until reenabled',
    async kind => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onAuxClick = vi.fn();
      const onKeyDown = vi.fn();
      const onClickCapture = vi.fn();
      const onFocus = vi.fn();
      const navigate = vi.fn();
      const closeMenu = vi.fn();
      const ref = createRef<HTMLElement>();
      const Router = vi.fn(function Router({
        href,
        to,
        onClick: routerClick,
        ...props
      }: ComponentPropsWithRef<'a'> & {to?: string}) {
        if (!href || href !== to) {
          throw new Error('The router requires its original destination');
        }
        return (
          <a
            {...props}
            href={to}
            onClick={event => {
              navigate();
              routerClick?.(event);
            }}
          />
        );
      });
      const fixture = (isDisabled: boolean) => (
        <LinkProvider component={kind === 'router' ? Router : 'a'}>
          <NavHeadingCloseContext value={{closeMenu}}>
            <button type="button">Before</button>
            <NavHeadingMenu>
              <NavHeadingMenuItem label="First" />
              <NavHeadingMenuItem
                ref={ref}
                id="destination"
                label="Destination"
                href="#probe-destination"
                isDisabled={isDisabled}
                aria-describedby="reason"
                onClick={onClick}
                onAuxClick={onAuxClick}
                onKeyDown={onKeyDown}
                onClickCapture={onClickCapture}
                onFocus={onFocus}
              />
              <NavHeadingMenuItem label="Last" />
            </NavHeadingMenu>
            <button type="button">After</button>
            <p id="reason">Access is unavailable.</p>
          </NavHeadingCloseContext>
        </LinkProvider>
      );
      const {rerender, unmount} = render(fixture(false));
      const item = screen.getByRole('menuitem', {name: 'Destination'});
      item.focus();
      expect(item).toHaveAttribute('tabindex', '-1');
      rerender(fixture(true));
      expect(screen.getByRole('menuitem', {name: 'Destination'})).toBe(item);
      expect(ref.current).toBe(item);
      expect(item).toHaveFocus();
      expect(item).toHaveAttribute('tabindex', '-1');
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAccessibleDescription('Access is unavailable.');
      expect(item).not.toHaveAttribute('disabled');
      expect(item).not.toHaveAttribute('href');
      expect(item).not.toHaveAttribute('_isDisabled');
      if (kind === 'router') {
        expect(Router.mock.lastCall?.[0]).toMatchObject({
          href: '#probe-destination',
          to: '#probe-destination',
        });
      }

      await user.keyboard('{Enter}{ }');
      expect(fireEvent.click(item)).toBe(false);
      expect(fireEvent.click(item, {ctrlKey: true})).toBe(false);
      expect(fireEvent.click(item, {metaKey: true})).toBe(false);
      expect(
        fireEvent(
          item,
          new MouseEvent('auxclick', {
            button: 1,
            bubbles: true,
            cancelable: true,
          }),
        ),
      ).toBe(false);
      expect(fireEvent.contextMenu(item)).toBe(false);
      for (const handler of [
        onClick,
        onAuxClick,
        onClickCapture,
        onKeyDown,
        navigate,
        closeMenu,
      ]) {
        expect(handler).not.toHaveBeenCalled();
      }
      expect(window.location.hash).toBe('');
      expect(item).toHaveFocus();

      // Preserve the composite's existing disabled-skipping arrow policy.
      screen.getByRole('menuitem', {name: 'First'}).focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', {name: 'Last'})).toHaveFocus();
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
      item.focus();
      expect(onFocus).toHaveBeenCalledTimes(2);
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus();

      item.focus();
      rerender(fixture(false));
      expect(screen.getByRole('menuitem', {name: 'Destination'})).toBe(item);
      expect(item).toHaveFocus();
      expect(item).toHaveAttribute('href', '#probe-destination');
      expect(item).not.toHaveAttribute('aria-disabled');
      await user.keyboard('{Enter}');
      await waitFor(() =>
        expect(window.location.hash).toBe('#probe-destination'),
      );
      expect(onClick).toHaveBeenCalledOnce();
      expect(closeMenu).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledTimes(kind === 'router' ? 1 : 0);
      unmount();
      expect(ref.current).toBeNull();
    },
  );

  it('renders initially disabled router items without a destination or router invocation', () => {
    const router = vi.fn(() => {
      throw new Error('An initially disabled item must not mount its router');
    });
    const html = renderToString(
      <LinkProvider component={router}>
        <NavHeadingMenuItem
          label="Destination"
          href="/destination"
          isDisabled
        />
      </LinkProvider>,
    );
    expect(router).not.toHaveBeenCalled();
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('_isDisabled');
  });

  it('does not turn a rejected destination into a disabled item or invoke its router', () => {
    const router = vi.fn();
    const onClick = vi.fn();
    const rejectedHref = 'javascript:alert(1)';
    render(
      <LinkProvider component={router}>
        <NavHeadingMenuItem
          label="Destination"
          // eslint-disable-next-line @eslint-react/dom-no-script-url -- verifies rejection before router handoff
          href={rejectedHref}
          onClick={onClick}
        />
      </LinkProvider>,
    );
    const item = screen.getByRole('menuitem');
    expect(router).not.toHaveBeenCalled();
    expect(item).not.toHaveAttribute('href');
    expect(item).not.toHaveAttribute('aria-disabled');
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('guards action callbacks at the current disabled state without replacing the focused owner', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const onAuxClick = vi.fn();
    const onAuxClickCapture = vi.fn();
    const onDoubleClick = vi.fn();
    const onDoubleClickCapture = vi.fn();
    const closeMenu = vi.fn();
    const ref = createRef<HTMLElement>();
    const fixture = (isDisabled: boolean) => (
      <NavHeadingCloseContext value={{closeMenu}}>
        <NavHeadingMenu>
          <NavHeadingMenuItem
            ref={ref}
            label="Action"
            isDisabled={isDisabled}
            onClick={onClick}
            onClickCapture={onClickCapture}
            onAuxClick={onAuxClick}
            onAuxClickCapture={onAuxClickCapture}
            onDoubleClick={onDoubleClick}
            onDoubleClickCapture={onDoubleClickCapture}
          />
        </NavHeadingMenu>
      </NavHeadingCloseContext>
    );
    const {rerender, unmount} = render(fixture(false));
    const item = screen.getByRole('menuitem');
    item.focus();
    rerender(fixture(true));
    expect(screen.getByRole('menuitem')).toBe(item);
    expect(ref.current).toBe(item);
    expect(item).toHaveFocus();
    expect(item).toHaveAttribute('tabindex', '-1');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).not.toHaveAttribute('_isDisabled');
    await user.keyboard('{Enter}{ }');
    await user.click(item);
    await user.pointer({target: item, keys: '[MouseMiddle]'});
    await user.dblClick(item);
    for (const handler of [
      onClick,
      onClickCapture,
      onAuxClick,
      onAuxClickCapture,
      onDoubleClick,
      onDoubleClickCapture,
      closeMenu,
    ]) {
      expect(handler).not.toHaveBeenCalled();
    }
    expect(item).toHaveFocus();
    rerender(fixture(false));
    expect(ref.current).toBe(item);
    expect(item).toHaveFocus();
    await user.keyboard('{Enter}{ }');
    await user.click(item);
    await user.pointer({target: item, keys: '[MouseMiddle]'});
    await user.dblClick(item);
    expect(onClick).toHaveBeenCalledTimes(5);
    expect(onClickCapture).toHaveBeenCalledTimes(5);
    expect(closeMenu).toHaveBeenCalledTimes(5);
    expect(onAuxClick).toHaveBeenCalledOnce();
    expect(onAuxClickCapture).toHaveBeenCalledOnce();
    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(onDoubleClickCapture).toHaveBeenCalledOnce();
    unmount();
    expect(ref.current).toBeNull();
  });

  it('preserves observation events and caller-rendered child activation on a disabled action', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onPointerEnter = vi.fn();
    const onPointerLeave = vi.fn();
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    const onClickCapture = vi.fn();
    const childClick = vi.fn();
    const childAuxClick = vi.fn();
    const ancestorClick = vi.fn();
    render(
      <div onClick={ancestorClick}>
        <NavHeadingMenu>
          <NavHeadingMenuItem label="First" />
          <NavHeadingMenuItem
            isDisabled
            label={
              <a
                href="#child-destination"
                onClick={childClick}
                onAuxClick={childAuxClick}>
                Child destination
              </a>
            }
            onClick={onClick}
            onClickCapture={onClickCapture}
            onFocus={onFocus}
            onBlur={onBlur}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onKeyDown={onKeyDown}
          />
          <NavHeadingMenuItem label="Last" />
        </NavHeadingMenu>
      </div>,
    );
    const item = screen.getByRole('menuitem', {name: 'Child destination'});
    item.focus();
    await user.hover(item);
    await user.unhover(item);
    await user.keyboard('{ArrowDown}');
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onBlur).toHaveBeenCalledOnce();
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(onPointerLeave).toHaveBeenCalledOnce();
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', {name: 'Last'})).toHaveFocus();
    await user.keyboard('f');
    expect(screen.getByRole('menuitem', {name: 'First'})).toHaveFocus();

    const child = screen.getByRole('link', {name: 'Child destination'});
    expect(child).toHaveAttribute('href', '#child-destination');
    expect(fireEvent.click(child)).toBe(true);
    expect(
      fireEvent(
        child,
        new MouseEvent('auxclick', {
          button: 1,
          bubbles: true,
          cancelable: true,
        }),
      ),
    ).toBe(true);
    expect(childClick).toHaveBeenCalledOnce();
    expect(childAuxClick).toHaveBeenCalledOnce();
    expect(ancestorClick).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    expect(onClickCapture).not.toHaveBeenCalled();
  });

  it('preserves enabled capture composition and consumer cancellation', () => {
    const onClick = vi.fn();
    const closeMenu = vi.fn();
    const ancestorAuxClick = vi.fn();
    const events: string[] = [];
    const fixture = (cancel: boolean) => (
      <div onAuxClick={ancestorAuxClick}>
        <NavHeadingCloseContext value={{closeMenu}}>
          <NavHeadingMenu>
            <NavHeadingMenuItem
              label="Action"
              onClick={onClick}
              onClickCapture={event => {
                events.push('capture');
                if (cancel) {
                  event.stopPropagation();
                }
              }}
              onAuxClickCapture={event => {
                events.push(
                  `aux-capture:${event.currentTarget.getAttribute('role')}`,
                );
                event.preventDefault();
              }}
              onAuxClick={event => {
                events.push(`aux:${event.defaultPrevented}`);
                event.stopPropagation();
              }}
            />
          </NavHeadingMenu>
        </NavHeadingCloseContext>
      </div>
    );
    const {rerender} = render(fixture(true));
    const item = screen.getByRole('menuitem');
    fireEvent.click(item);
    expect(events).toEqual(['capture']);
    expect(onClick).not.toHaveBeenCalled();
    expect(closeMenu).not.toHaveBeenCalled();
    rerender(fixture(false));
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
    expect(closeMenu).toHaveBeenCalledOnce();
    expect(
      fireEvent(
        item,
        new MouseEvent('auxclick', {
          button: 1,
          bubbles: true,
          cancelable: true,
        }),
      ),
    ).toBe(false);
    expect(events).toEqual([
      'capture',
      'capture',
      'aux-capture:menuitem',
      'aux:true',
    ]);
    expect(ancestorAuxClick).not.toHaveBeenCalled();
  });
});
