// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @input Built core Dialog and CSS, built neutral theme CSS (no reset.css).
 * @output Isolated Storybook reproduction of the native dialog border in #6678.
 * @position Distribution diagnostic; keeps Storybook's global reset out of the iframe.
 *
 * Build core and theme-neutral before viewing this story. Importing the normal
 * @astryxdesign/core/Dialog entry would resolve to source in Storybook, which
 * uses a different StyleX pipeline from the published package in #6678.
 */

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {Meta, StoryObj} from '@storybook/react';
import * as stylex from '@stylexjs/stylex';
import {Dialog} from '../../../packages/core/dist/Dialog/index.js';

const coreCSS = new URL(
  '../../../packages/core/dist/astryx.css',
  import.meta.url,
).href;
const themeCSS = new URL(
  '../../../packages/themes/neutral/dist/theme.css',
  import.meta.url,
).href;
const noResetDocument = `<!doctype html>
<html lang="en" data-theme="light" data-astryx-theme="neutral">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${coreCSS}">
  <link rel="stylesheet" href="${themeCSS}">
</head>
<body></body>
</html>`;

const styles = stylex.create({
  frame: {
    width: '100%',
    height: 480,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
  },
});

function NoResetDialogExample() {
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [border, setBorder] = useState('Waiting for Dialog…');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!frameDocument || !isOpen) {
      return;
    }
    const view = frameDocument.defaultView;
    const frame = view?.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog?.open) {
        return;
      }
      dialog.focus();
      const computed = view.getComputedStyle(dialog);
      setBorder(`${computed.borderTopWidth} ${computed.borderTopStyle}`);
    });
    return () => {
      if (frame != null) {
        view?.cancelAnimationFrame(frame);
      }
    };
  }, [frameDocument, isOpen]);

  return (
    <>
      <p>
        Built Dialog + astryx.css + neutral theme.css, without reset.css.
        Chromium shows a 3px solid native border in #6678; a fixed build should
        show 0px. The Storybook toolbar does not theme this isolated document.
      </p>
      <p data-testid="dialog-no-reset-border">Dialog border: {border}</p>
      <iframe
        title="Dialog without reset.css (#6678)"
        srcDoc={noResetDocument}
        {...stylex.props(styles.frame)}
        onLoad={event => setFrameDocument(event.currentTarget.contentDocument)}
      />
      {frameDocument &&
        createPortal(
          <>
            <button type="button" onClick={() => setIsOpen(true)}>
              Reopen Dialog
            </button>
            <Dialog
              ref={dialogRef}
              tabIndex={-1}
              aria-label="No-reset border reproduction"
              isOpen={isOpen}
              onOpenChange={setIsOpen}
              purpose="form">
              <p>The native dialog border is visible without reset.css.</p>
              <button type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </Dialog>
          </>,
          frameDocument.body,
        )}
    </>
  );
}

const meta: Meta = {
  title: 'Core/Dialog/No reset CSS (#6678)',
  parameters: {
    docs: {
      description: {
        component:
          'Distribution-only reproduction: a same-origin iframe loads the built ' +
          'core and neutral theme CSS without Storybook’s global reset.css.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const BorderReproduction: Story = {
  render: () => <NoResetDialogExample />,
};
