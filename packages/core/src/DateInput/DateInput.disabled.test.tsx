// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file DateInput.disabled.test.tsx
 * @input Uses DateInput's public props and calendar interactions
 * @output Regression coverage for disablement while a picker is already open
 * @position DateInput tests; browser evidence separately verifies native focus
 */

import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {getButton} from '../__tests__/fastRoleQueries';
import {DateInput, type DateInputProps} from './DateInput';
import type {ISODateString} from '../utils';

function ControlledDateInput(props: Partial<DateInputProps>) {
  const [value, setValue] = useState<ISODateString | undefined>('2026-10-15');
  return (
    <DateInput
      label="Date"
      presentation="popover"
      min="2026-10-01"
      max="2026-10-31"
      {...props}
      value={value}
      onChange={next => {
        props.onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe('DateInput open-picker disablement', () => {
  it.each([
    {activation: 'pointer', disabledMessage: undefined},
    {activation: 'Enter', disabledMessage: 'Scheduling is locked'},
    {activation: 'Space', disabledMessage: undefined},
  ])(
    'rejects $activation selection after disablement without closing or losing focus',
    async ({activation, disabledMessage}) => {
      const user = userEvent.setup();
      const events: string[] = [];
      const onChange = vi.fn(() => events.push('change'));
      const changeAction = vi.fn(() => {
        events.push('action');
      });
      const props = {onChange, changeAction, disabledMessage};
      const {rerender} = render(<ControlledDateInput {...props} />);

      act(() => screen.getByRole('combobox').focus());
      await user.keyboard('{ArrowDown}');
      const day = getButton(/October 16, 2026/);
      act(() => day.focus());
      rerender(<ControlledDateInput {...props} isDisabled />);

      expect(day).toHaveFocus();
      if (activation === 'pointer') {
        await user.click(day);
      } else {
        await user.keyboard(activation === 'Enter' ? '{Enter}' : ' ');
      }

      expect(onChange).not.toHaveBeenCalled();
      expect(changeAction).not.toHaveBeenCalled();
      expect(screen.getByRole('combobox')).toHaveValue('October 15, 2026');
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(day).toHaveFocus();

      // The same mounted picker can commit again when its owner is enabled.
      rerender(<ControlledDateInput {...props} />);
      await user.click(day);
      expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-16');
      expect(changeAction).toHaveBeenCalledExactlyOnceWith('2026-10-16');
      expect(events).toEqual(['change', 'action']);
      expect(screen.getByRole('combobox')).toHaveValue('October 16, 2026');
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    },
  );

  it('preserves busy-only selection dismissal without committing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const changeAction = vi.fn();
    const props = {onChange, changeAction};
    const {rerender} = render(<ControlledDateInput {...props} />);
    await user.click(getButton('Open calendar'));
    const day = getButton(/October 16, 2026/);
    rerender(<ControlledDateInput {...props} isLoading />);
    await user.click(day);
    expect(onChange).not.toHaveBeenCalled();
    expect(changeAction).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('October 15, 2026');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
