// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file NavHeadingMenuItem.tsx
 * @input Uses React, StyleX, Icon, Text, NavMenuContext, and the disabled-link boundary
 * @output NavHeadingMenuItem and props; disabled rows retain focus and guard click/activation-key callbacks
 * @position Core implementation; consumed by index.ts
 *
 * SYNC: When modified, update:
 * - /packages/core/src/NavMenu/index.ts
 * - /packages/core/src/NavMenu/NavMenu.doc.mjs
 */

import React, {useCallback, type ReactNode} from 'react';
import * as stylex from '@stylexjs/stylex';
import {renderIconSlot, type IconType} from '../Icon';
import {Text} from '../Text';
import {
  colorVars,
  spacingVars,
  typographyVars,
  typeScaleVars,
  radiusVars,
} from '../theme/tokens.stylex';
import {mergeProps} from '../utils';
import type {BaseProps} from '../BaseProps';
import {useNavHeadingMenuContext} from './NavMenuContext';
import {useLinkComponent} from '../Link/useLinkComponent';
import {themeProps} from '../utils/themeProps';

const styles = stylex.create({
  root: {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: spacingVars['--spacing-2'],
    width: '100%',
    borderRadius: radiusVars['--radius-element'],
    fontFamily: typographyVars['--font-family-body'],
    fontSize: typeScaleVars['--text-label-size'],
    color: colorVars['--color-text-primary'],
    backgroundColor: {
      default: 'transparent',
      ':focus': colorVars['--color-overlay-hover'],
      ':hover:where(:not(:disabled,[aria-disabled="true"]))': {
        '@media (hover: hover)': colorVars['--color-overlay-hover'],
      },
    },
    borderWidth: 0,
    borderStyle: 'none',
    cursor: {
      default: 'pointer',
      ':is(:disabled,[aria-disabled="true"])': 'default',
    },
    textAlign: 'start',
    outline: 'none',
    textDecoration: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  disabled: {
    opacity: 0.5,
    cursor: 'default',
  },
});

const sizeStyles = stylex.create({
  sm: {
    paddingBlock: spacingVars['--spacing-1'],
    paddingInline: spacingVars['--spacing-2'],
  },
  md: {
    paddingBlock: spacingVars['--spacing-2'],
    paddingInline: spacingVars['--spacing-2'],
  },
  lg: {
    paddingBlock: spacingVars['--spacing-3'],
    paddingInline: spacingVars['--spacing-3'],
  },
});

export interface NavHeadingMenuItemProps extends Omit<
  BaseProps<HTMLElement>,
  'onClick'
> {
  ref?: React.Ref<HTMLElement>;
  /** Icon to display before the label. */
  icon?: ReactNode | IconType;
  /** Primary label text. */
  label: ReactNode;
  /** Secondary description text displayed below the label. */
  description?: ReactNode;
  /** URL to navigate to. Renders as an anchor element when provided. */
  href?: string;
  /** Callback when the item is selected. */
  onClick?: () => void;
  /** Whether the item is disabled. @default false */
  isDisabled?: boolean;
}

/**
 * Menu item for nav heading popovers.
 *
 * Reads size from the parent NavHeadingMenu for consistent padding.
 * Automatically dismisses the menu on click via context.
 * Renders as a link when `href` is provided. Disabled items keep their focus
 * owner and tabIndex=-1 while withholding navigation and activation callbacks.
 *
 * @example
 * ```
 * <NavHeadingMenu>
 *   <NavHeadingMenuItem label="Dashboard" href="/dashboard" />
 *   <NavHeadingMenuItem label="Settings" icon={GearIcon} onClick={open} />
 * </NavHeadingMenu>
 * ```
 */
export function NavHeadingMenuItem({
  ref,
  icon,
  label,
  description,
  href,
  onClick,
  isDisabled = false,
  xstyle,
  className,
  style,
  'data-testid': testId,
  ...restProps
}: NavHeadingMenuItemProps) {
  const ctx = useNavHeadingMenuContext();
  const size = ctx?.size ?? 'md';

  const handleClick = useCallback(() => {
    if (isDisabled) {
      return;
    }
    onClick?.();
    ctx?.closeMenu();
  }, [isDisabled, onClick, ctx]);

  const LinkComponent = useLinkComponent();
  const Element = href ? LinkComponent : 'div';

  // The link boundary owns href items. Filter only this action's consumers,
  // leaving nonactivation keys, parent routing, and child-owned events intact.
  const guardActionKeyCallback = (
    handler: React.KeyboardEventHandler<HTMLElement> | undefined,
  ): React.KeyboardEventHandler<HTMLElement> | undefined => {
    if (href || !isDisabled || !handler) {
      return handler;
    }
    return event => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        handler(event);
      }
    };
  };

  return (
    <Element
      {...restProps}
      {...(href ? {_isDisabled: isDisabled} : {})}
      ref={ref}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={isDisabled || undefined}
      href={href}
      onClick={handleClick}
      // Suppress row activation callbacks, not observation or child-owned events.
      onClickCapture={isDisabled ? undefined : restProps.onClickCapture}
      onAuxClick={isDisabled ? undefined : restProps.onAuxClick}
      onAuxClickCapture={isDisabled ? undefined : restProps.onAuxClickCapture}
      onDoubleClick={isDisabled ? undefined : restProps.onDoubleClick}
      onDoubleClickCapture={
        isDisabled ? undefined : restProps.onDoubleClickCapture
      }
      onKeyDownCapture={guardActionKeyCallback(restProps.onKeyDownCapture)}
      onKeyDown={guardActionKeyCallback(restProps.onKeyDown)}
      onKeyPressCapture={guardActionKeyCallback(restProps.onKeyPressCapture)}
      onKeyPress={guardActionKeyCallback(restProps.onKeyPress)}
      onKeyUpCapture={guardActionKeyCallback(restProps.onKeyUpCapture)}
      onKeyUp={guardActionKeyCallback(restProps.onKeyUp)}
      data-testid={testId}
      {...mergeProps(
        themeProps('nav-heading-menu-item', {size}),
        stylex.props(
          styles.root,
          sizeStyles[size],
          isDisabled && styles.disabled,
          xstyle,
        ),
        className,
        style,
      )}>
      {icon && renderIconSlot(icon, {size: 'sm', color: 'secondary'})}
      <span {...stylex.props(styles.content)}>
        {typeof label === 'string' ? (
          <Text type="body" maxLines={1}>
            {label}
          </Text>
        ) : (
          label
        )}
        {description && (
          <Text type="supporting" maxLines={1}>
            {description}
          </Text>
        )}
      </span>
    </Element>
  );
}

NavHeadingMenuItem.displayName = 'NavHeadingMenuItem';
