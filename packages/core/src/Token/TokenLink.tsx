// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

/**
 * @file TokenLink.tsx
 * @input Rendered token pieces (icon, label, endContent, remove button) plus
 *   container/link styling props and the resolved LinkComponent
 * @output Exports TokenLink, the href+onRemove container with a stable,
 *   focusable primary link and disabled navigation/activation guards
 * @position Internal to Token; keeps Token.tsx presentational
 *
 * Token is a presentational component (see
 * /internal/eslint-plugin-astryx/presentational-component.js) and must not use
 * refs or effects. When a Token has both `href` and `onRemove`, the remove
 * <button> must be a sibling of the link (nesting a button inside an anchor is
 * invalid HTML — WCAG 4.1.2), so the surface becomes a clickable container that
 * delegates to an inner link. That delegation needs refs, so it lives here.
 *
 * useClickableContainer gives the container middle-click and cmd/ctrl-click
 * open-in-new-tab behavior for the link, ignores clicks on nested interactive
 * elements (the remove button), and skips activation during text selection.
 *
 * SYNC: When modified, update these files to stay in sync:
 * - /packages/core/src/Token/Token.tsx (renders TokenLink for the href+onRemove case)
 * - /packages/core/src/Token/Token.test.tsx (tests for delegated behavior)
 */

import type {
  ReactNode,
  CSSProperties,
  Ref,
  HTMLAttributes,
  SyntheticEvent,
} from 'react';
import {useRef} from 'react';
import {useClickableContainer} from '../hooks/useClickableContainer';
import type {LinkComponentType} from '../Link/types';
import {composeEventHandlers} from '../utils';
import {disabledInteractionProps} from '../utils/disabledInteraction';

import {useMergedRefs} from '../hooks/useMergedRefs';
export interface TokenLinkProps extends HTMLAttributes<HTMLElement> {
  /** Ref forwarded to the container element. */
  ref?: Ref<HTMLElement>;
  /** Link URL. */
  href: string;
  /** Whether the token is disabled. */
  isDisabled: boolean;
  /** Resolved link component (native `<a>` or a router link). */
  LinkComponent: LinkComponentType;
  /** `stylex.props()` output applied to the invisible inner link. */
  linkStyleProps: {className?: string; style?: CSSProperties};
  /** Visible (or visually hidden) label node rendered inside the link. */
  labelContent: ReactNode;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Content rendered after the label, before the remove button. */
  endContent?: ReactNode;
  /** The remove button node, rendered as a sibling of the link. */
  removeButton: ReactNode;
  /** Allow data-* attributes (e.g. data-testid, theme targets) on the container. */
  [dataAttr: `data-${string}`]: unknown;
}

function blockActivation(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Interactive container for a Token that is both a link and removable.
 *
 * Renders a `<span>` wrapping an invisible inner link and the remove button as
 * siblings. useClickableContainer delegates clicks on the surface to the link
 * (including middle-click / cmd+click to open in a new tab) while the remove
 * button keeps handling its own clicks.
 */
export function TokenLink({
  ref,
  href,
  isDisabled,
  LinkComponent,
  linkStyleProps,
  labelContent,
  icon,
  endContent,
  removeButton,
  onClick: onClickProp,
  onMouseUp: onMouseUpProp,
  ...containerProps
}: TokenLinkProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const linkRef = useRef<HTMLElement | null>(null);

  const {onClick, onMouseUp} = useClickableContainer({
    containerRef,
    interactiveRef: linkRef,
    href,
    disabled: isDisabled,
  });

  return (
    <span
      ref={useMergedRefs(ref, containerRef)}
      {...containerProps}
      // The container receives capture events before either child control.
      // Guard activation here too; focus/blur and nonactivation keys still pass.
      {...(isDisabled && {
        onClickCapture: blockActivation,
        onDoubleClickCapture: blockActivation,
        onAuxClickCapture: blockActivation,
        onContextMenuCapture: blockActivation,
        onDragStartCapture: blockActivation,
        onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            blockActivation(event);
          } else {
            containerProps.onKeyDownCapture?.(event);
          }
        },
        onKeyUpCapture: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            blockActivation(event);
          } else {
            containerProps.onKeyUpCapture?.(event);
          }
        },
      })}
      onClick={
        isDisabled ? onClickProp : composeEventHandlers(onClickProp, onClick)
      }
      onMouseUp={
        isDisabled
          ? onMouseUpProp
          : composeEventHandlers(onMouseUpProp, onMouseUp)
      }>
      {icon}
      <LinkComponent
        ref={linkRef as Ref<HTMLAnchorElement>}
        href={href}
        _isDisabled={isDisabled}
        role={isDisabled ? 'link' : undefined}
        aria-disabled={isDisabled || undefined}
        {...(isDisabled ? disabledInteractionProps() : null)}
        {...linkStyleProps}>
        {labelContent}
      </LinkComponent>
      {endContent}
      {removeButton}
    </span>
  );
}

TokenLink.displayName = 'TokenLink';
