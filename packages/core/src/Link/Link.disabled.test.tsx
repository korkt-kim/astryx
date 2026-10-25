// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file Link.disabled.test.tsx
 * @input Public Link and LinkProvider, React rerenders, keyboard/pointer events
 * @output Regression coverage for disabled focus identity and activation guards
 * @position Testing; protects Link's enabled-to-disabled transition
 */

import type {ComponentPropsWithRef} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Link} from './Link';
import {LinkProvider} from './LinkProvider';

function RouterLink({href, ...props}: ComponentPropsWithRef<'a'>) {
  if (href == null) {
    throw new Error('RouterLink requires a destination');
  }
  return <a {...props} data-router="true" href={href} />;
}

describe('Link disabled transitions', () => {
  it.each(['native', 'callback', 'provider', 'as', 'action'] as const)(
    '%s keeps the focused node and ref when disabled and re-enabled',
    async mode => {
      const user = userEvent.setup();
      const ref = vi.fn();
      const onClick = vi.fn();
      const fixture = (isDisabled: boolean) => (
        <LinkProvider component={mode === 'provider' ? RouterLink : 'a'}>
          <button type="button">Before</button>
          <Link
            href={mode === 'action' ? undefined : '#destination'}
            as={mode === 'as' ? RouterLink : undefined}
            onClick={
              mode === 'callback' || mode === 'action' ? onClick : undefined
            }
            isDisabled={isDisabled}
            aria-describedby="reason"
            ref={ref}>
            Destination
          </Link>
          <span id="reason">Unavailable reason</span>
          <button type="button">After</button>
        </LinkProvider>
      );
      const {rerender} = render(fixture(false));
      const role = mode === 'action' ? 'button' : 'link';
      const link = screen.getByRole(role, {name: 'Destination'});
      await user.tab();
      await user.tab();
      expect(link).toHaveFocus();
      ref.mockClear();

      rerender(fixture(true));
      expect(link).toHaveFocus();
      expect(screen.getByRole(role, {name: 'Destination'})).toBe(link);
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAccessibleDescription('Unavailable reason');
      expect(ref).not.toHaveBeenCalled();
      await user.keyboard('{Enter} ');
      fireEvent.click(link);
      expect(onClick).not.toHaveBeenCalled();
      await user.tab();
      expect(screen.getByRole('button', {name: 'After'})).toHaveFocus();
      await user.tab({shift: true});
      expect(link).toHaveFocus();

      rerender(fixture(false));
      expect(screen.getByRole(role, {name: 'Destination'})).toBe(link);
      expect(link).toHaveFocus();
      expect(ref).not.toHaveBeenCalled();
      if (mode !== 'action') {
        expect(link).toHaveAttribute('href', '#destination');
      }
      if (mode === 'provider' || mode === 'as') {
        expect(link).toHaveAttribute('data-router', 'true');
      }
    },
  );

  it.each([undefined, -1, 0])(
    'preserves tabIndex=%s when disabled',
    async tabIndex => {
      const user = userEvent.setup();
      const fixture = (isDisabled: boolean) => (
        <>
          <button type="button">Before</button>
          <Link href="#destination" tabIndex={tabIndex} isDisabled={isDisabled}>
            Destination
          </Link>
          <button type="button">After</button>
        </>
      );
      const {rerender} = render(fixture(false));
      const link = screen.getByRole('link');
      link.focus();
      rerender(fixture(true));
      expect(link).toHaveFocus();
      expect(link).toHaveAttribute('tabindex', String(tabIndex ?? 0));
      screen.getByRole('button', {name: 'Before'}).focus();
      await user.tab();
      expect(
        tabIndex === -1 ? screen.getByRole('button', {name: 'After'}) : link,
      ).toHaveFocus();
    },
  );

  it('keeps explicit positive tab eligibility', () => {
    const {rerender} = render(
      <Link href="#destination" tabIndex={3}>
        Destination
      </Link>,
    );
    const link = screen.getByRole('link');
    link.focus();
    rerender(
      <Link href="#destination" tabIndex={3} isDisabled>
        Destination
      </Link>,
    );
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute('tabindex', '3');
  });

  it('keeps focus, blur, and nonactivation key observations available', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    render(
      <Link
        href="#destination"
        isDisabled
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onClick={onClick}>
        Destination
      </Link>,
    );
    const link = screen.getByRole('link');
    link.focus();
    expect(onFocus).toHaveBeenCalledOnce();
    fireEvent.keyDown(link, {key: 'Tab'});
    expect(onKeyDown).toHaveBeenCalledOnce();
    fireEvent.keyDown(link, {key: 'Enter'});
    fireEvent.keyUp(link, {key: 'Enter'});
    fireEvent.click(link);
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    link.blur();
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
