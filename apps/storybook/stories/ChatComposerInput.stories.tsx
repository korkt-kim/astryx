// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @input ChatComposerInput props, draft interactions, and trigger fixtures.
 * @output Input stories and browser probes for sizing and file-drop hit targets.
 * @position Storybook evidence; the #6651 guard preserves geometry and semantics.
 */

import type {Meta, StoryObj} from '@storybook/react';
import * as stylex from '@stylexjs/stylex';
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  type ChatComposerTrigger,
} from '@astryxdesign/core/Chat';
import {createStaticSource} from '@astryxdesign/core/Typeahead';
import {Badge} from '@astryxdesign/core/Badge';
import {TypeaheadItem} from '@astryxdesign/core/Typeahead';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';
import {expect, fireEvent, userEvent, waitFor, within} from 'storybook/test';
import {useRef, useState} from 'react';

const meta: Meta = {
  title: 'Core/ChatComposerInput',
  component: ChatComposerInput,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div style={{width: 600, padding: 40}}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

// =============================================================================
// Mock data
// =============================================================================

const USERS: SearchableItem<{role: string}>[] = [
  {id: 'cindy', label: 'Cindy Zhang', auxiliaryData: {role: 'Design Systems'}},
  {id: 'alex', label: 'Alex Johnson', auxiliaryData: {role: 'Frontend'}},
  {id: 'sam', label: 'Sam Rivera', auxiliaryData: {role: 'Backend'}},
  {id: 'jordan', label: 'Jordan Lee', auxiliaryData: {role: 'Product'}},
  {id: 'taylor', label: 'Taylor Kim', auxiliaryData: {role: 'Design'}},
  {id: 'morgan', label: 'Morgan Chen', auxiliaryData: {role: 'Infrastructure'}},
];

const COMMANDS: SearchableItem<{description: string}>[] = [
  {
    id: 'summarize',
    label: 'summarize',
    auxiliaryData: {description: 'Summarize the conversation'},
  },
  {
    id: 'translate',
    label: 'translate',
    auxiliaryData: {description: 'Translate text to another language'},
  },
  {
    id: 'search',
    label: 'search',
    auxiliaryData: {description: 'Search the web or documents'},
  },
  {
    id: 'code',
    label: 'code',
    auxiliaryData: {description: 'Generate or explain code'},
  },
  {
    id: 'help',
    label: 'help',
    auxiliaryData: {description: 'Show available commands'},
  },
];

const userSource = createStaticSource(USERS);
const commandSource = createStaticSource(COMMANDS);

const asyncUserSource: SearchSource = {
  search(query: string) {
    return new Promise(resolve => {
      setTimeout(() => {
        const lower = query.toLowerCase();
        resolve(USERS.filter(u => u.label.toLowerCase().includes(lower)));
      }, 300);
    });
  },
  bootstrap() {
    return USERS;
  },
};

// =============================================================================
// Basic input stories
// =============================================================================

/** Controlled value — shows the serialized value below */
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          onSubmit={v => {
            alert(`Submitted: ${v}`);
            setValue('');
          }}
          value={value}
          onChange={setValue}
          input={
            <ChatComposerInput
              value={value}
              onChange={setValue}
              placeholder="Type a message..."
            />
          }
        />
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--color-text-secondary)',
          }}>
          Value: {JSON.stringify(value)}
        </div>
      </div>
    );
  },
};

/** Custom placeholder */
export const CustomPlaceholder: Story = {
  render: () => (
    <ChatComposer
      onSubmit={v => alert(v)}
      input={
        <ChatComposerInput placeholder="Ask me anything about Astryx..." />
      }
    />
  ),
};

/** Disabled state */
export const Disabled: Story = {
  render: () => (
    <ChatComposer
      onSubmit={() => {}}
      isDisabled
      input={<ChatComposerInput isDisabled placeholder="Input is disabled" />}
    />
  ),
};

// Reuses the isolated grid case from #6651 and PR #6654.
// Native wrappers deliberately exclude ChatComposer and themed button geometry.
const disabledHeightStyles = stylex.create({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'end',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border-emphasized)',
    width: 360,
  },
  sendReference: {
    width: 36,
    height: 36,
  },
});

function DisabledHeightToggleExample() {
  const [isDisabled, setIsDisabled] = useState(false);
  const [value, setValue] = useState('');
  return (
    <div data-testid="disabled-height-repro">
      <button
        type="button"
        aria-pressed={isDisabled}
        onClick={() => setIsDisabled(value => !value)}>
        Toggle disabled: {String(isDisabled)}
      </button>
      <div
        {...stylex.props(disabledHeightStyles.row)}
        data-testid="bottom-aligned-row">
        <ChatComposerInput
          value={value}
          onChange={setValue}
          placeholder="Type a message…"
          label="Reproduction input"
          isDisabled={isDisabled}
          data-testid="reproduction-input"
          maxRows={1}
        />
        <button
          type="button"
          aria-label="Send (layout reference)"
          {...stylex.props(disabledHeightStyles.sendReference)}>
          ↑
        </button>
      </div>
    </div>
  );
}

export const DisabledHeightToggle: Story = {
  name: 'Disabled Height Toggle (#6651)',
  render: () => <DisabledHeightToggleExample />,
};

/** Run in real Chromium by .github/scripts/story-play-guard.js, not jsdom. */
export const DisabledHeightRegression: Story = {
  render: () => <DisabledHeightToggleExample />,
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', {name: 'Reproduction input'});
    const root = canvas.getByTestId('reproduction-input');
    const row = canvas.getByTestId('bottom-aligned-row');
    const placeholder = canvas.getByText('Type a message…');
    const toggle = canvas.getByRole('button', {name: /Toggle disabled:/});
    const placeholderOffset = () =>
      placeholder.getBoundingClientRect().top - row.getBoundingClientRect().top;
    const initialHeight = root.getBoundingClientRect().height;
    const initialRowHeight = row.getBoundingClientRect().height;
    const initialOffset = placeholderOffset();

    // Start with a fresh empty editor: editing and deleting can leave a <br>
    // that masks the disabled-height regression in Chromium.
    await expect(initialHeight).toBeGreaterThan(0);
    await expect(input.textContent).toBe('');
    await expect(input).toHaveAttribute('aria-multiline', 'true');
    await userEvent.click(toggle);
    await expect(input).toHaveAttribute('contenteditable', 'false');
    await expect(input).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => {
      expect(root.getBoundingClientRect().height).toBeCloseTo(initialHeight, 1);
      expect(row.getBoundingClientRect().height).toBeCloseTo(
        initialRowHeight,
        1,
      );
      expect(placeholderOffset()).toBeCloseTo(initialOffset, 1);
    });

    await userEvent.click(toggle);
    await expect(input).toHaveAttribute('contenteditable', 'true');
    await expect(input).not.toHaveAttribute('aria-disabled');
    await expect(root.getBoundingClientRect().height).toBeCloseTo(
      initialHeight,
      1,
    );
    await expect(placeholderOffset()).toBeCloseTo(initialOffset, 1);
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'A message');
    await expect(input).toHaveTextContent('A message');
    await expect(canvas.queryByText('Type a message…')).not.toBeInTheDocument();

    // Exercise the row limit with overflowing text, not just one intrinsic line.
    await userEvent.clear(input);
    await userEvent.type(input, 'AAAAA{Shift>}{Enter}{/Shift}BBBBB');
    await expect(input.scrollHeight).toBeGreaterThan(22);

    // maxRows=1 limits the scrolling viewport, not the surrounding padding.
    const rootBounds = root.getBoundingClientRect();
    const editorBounds = input.getBoundingClientRect();
    await expect(editorBounds.height).toBeCloseTo(22, 1);
    await expect(editorBounds.top - rootBounds.top).toBeCloseTo(4, 1);
    await expect(rootBounds.bottom - editorBounds.bottom).toBeCloseTo(4, 1);
  },
};

/** Max rows — scrolls after 3 lines */
export const MaxRows: Story = {
  render: () => (
    <ChatComposer
      onSubmit={v => alert(v)}
      input={
        <ChatComposerInput
          maxRows={1}
          placeholder="Type a long message — scrolls after 3 lines..."
        />
      }
    />
  ),
};

const singleRowComparisonStyles = stylex.create({
  comparison: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 24,
    marginBlockEnd: 24,
  },
  frame: {
    padding: 12,
    marginBlockStart: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border-emphasized)',
  },
  bottomAligned: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'end',
    gap: 12,
  },
  inputBounds: {
    outlineWidth: 1,
    outlineStyle: 'dashed',
    outlineColor: 'currentColor',
    backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)',
  },
  // Reproduce only the previous root minimum; do not override the editor.
  previousMinimum: {
    minHeight: 22,
  },
  dropTarget: {
    position: 'relative',
  },
  dropMarker: {
    position: 'absolute',
    bottom: 0,
    insetInlineStart: 0,
    insetInlineEnd: 0,
    height: 8,
    pointerEvents: 'none',
    backgroundColor: 'color-mix(in srgb, currentColor 20%, transparent)',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBlockStart: 12,
  },
});

function SingleRowComparisonCase({
  layout,
  version,
}: {
  layout: 'row' | 'stack';
  version: 'before' | 'after';
}) {
  const [value, setValue] = useState('Hello');
  const isBefore = version === 'before';
  return (
    <div>
      <strong>
        {isBefore ? 'Before (old minimum)' : 'After (current minimum)'}
      </strong>
      <div
        {...stylex.props(
          singleRowComparisonStyles.frame,
          layout === 'row' && singleRowComparisonStyles.bottomAligned,
        )}
        data-testid={`${layout}-${version}-frame`}>
        <ChatComposerInput
          maxRows={1}
          value={value}
          onChange={setValue}
          label={`${layout} ${version} input`}
          placeholder="Type a message…"
          xstyle={[
            singleRowComparisonStyles.inputBounds,
            isBefore && singleRowComparisonStyles.previousMinimum,
          ]}
          data-testid={`${layout}-${version}-input`}
        />
        {layout === 'row' ? (
          <button
            type="button"
            aria-label={`${version} layout reference`}
            {...stylex.props(disabledHeightStyles.sendReference)}
            data-testid={`${layout}-${version}-reference`}>
            ↑
          </button>
        ) : (
          <div data-testid={`${layout}-${version}-reference`}>
            Following element
          </div>
        )}
      </div>
    </div>
  );
}

/** Compare the real maxRows prop; no cloned DOM or editable-height overrides. */
export const MaxRowsOneLayoutImpact: Story = {
  name: 'Max Rows 1 — Layout Impact (#6651)',
  render: () => (
    <div data-testid="single-row-layout-comparison">
      <h2>maxRows=1: layout impact</h2>
      <p>
        Both sides use maxRows=1. Only Before restores the old 22px root
        minimum. The dashed outline marks the whole input wrapper.
      </p>
      <h3>Bottom-aligned row</h3>
      <div {...stylex.props(singleRowComparisonStyles.comparison)}>
        <SingleRowComparisonCase layout="row" version="before" />
        <SingleRowComparisonCase layout="row" version="after" />
      </div>
      <h3>Vertical stack</h3>
      <div {...stylex.props(singleRowComparisonStyles.comparison)}>
        <SingleRowComparisonCase layout="stack" version="before" />
        <SingleRowComparisonCase layout="stack" version="after" />
      </div>
      <p>
        The one-line editor can scroll on both sides; that limit predates the
        root-height change. Reload the story to reset the comparison.
      </p>
    </div>
  ),
};

function SingleRowFileDropCase({version}: {version: 'before' | 'after'}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('Hello');
  const [receivedFiles, setReceivedFiles] = useState<string[]>([]);
  const [result, setResult] = useState('Not tested');

  function simulateDrop(location: 'bottom' | 'inside') {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const bounds = root.getBoundingClientRect();
    const x = bounds.left + 12;
    const y = location === 'bottom' ? bounds.bottom - 4 : bounds.top + 8;
    const target = root.ownerDocument.elementFromPoint(x, y);
    if (!target || !root.contains(target)) {
      setResult('Scroll the input into view, then try again.');
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File(['demo'], 'demo.txt', {type: 'text/plain'}));
    // Exercise actual hit-testing and React drag/drop handlers. Synthetic
    // events deliberately avoid a real OS file drop navigating the browser.
    const dragover = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    target.dispatchEvent(dragover);
    const drop = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    target.dispatchEvent(drop);
    const hit =
      target.getAttribute('role') === 'textbox' ? 'editor' : 'wrapper';
    setResult(
      `Hit: ${hit}. Dragover prevented: ${dragover.defaultPrevented}. Drop prevented: ${drop.defaultPrevented}.`,
    );
  }

  return (
    <div>
      <h3>
        {version === 'before'
          ? 'Before (old minimum)'
          : 'After (current minimum)'}
      </h3>
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={() => {}}
        input={
          <div {...stylex.props(singleRowComparisonStyles.dropTarget)}>
            <ChatComposerInput
              ref={rootRef}
              maxRows={1}
              label={`${version} file drop input`}
              xstyle={[
                singleRowComparisonStyles.inputBounds,
                version === 'before' &&
                  singleRowComparisonStyles.previousMinimum,
              ]}
              onFiles={files =>
                setReceivedFiles(previous => [
                  ...previous,
                  ...files.map(file => file.name),
                ])
              }
              data-testid={`file-drop-${version}-input`}
            />
            <div
              aria-hidden="true"
              {...stylex.props(singleRowComparisonStyles.dropMarker)}
            />
          </div>
        }
      />
      <div {...stylex.props(singleRowComparisonStyles.actions)}>
        <button
          type="button"
          onClick={() => simulateDrop('bottom')}
          data-testid={`file-drop-${version}-bottom`}>
          Drop at bottom edge
        </button>
        <button
          type="button"
          onClick={() => simulateDrop('inside')}
          data-testid={`file-drop-${version}-inside`}>
          Drop inside editor
        </button>
        <button
          type="button"
          onClick={() => {
            setReceivedFiles([]);
            setResult('Not tested');
          }}>
          Reset result
        </button>
      </div>
      <div role="status" aria-live="polite">
        <p data-testid={`file-drop-${version}-files`}>
          Received files: {receivedFiles.join(', ') || 'none'}
        </p>
        <p data-testid={`file-drop-${version}-result`}>{result}</p>
      </div>
    </div>
  );
}

/** Functional probe: the extra root area must not silently lose file intake. */
export const MaxRowsOneFileDropGap: Story = {
  name: 'Max Rows 1 — File Drop Gap (#6651)',
  render: () => (
    <div data-testid="single-row-file-drop-comparison">
      <h2>maxRows=1: file-drop hit area</h2>
      <p>
        Both inputs use ChatComposer and maxRows=1. The shaded bottom strip
        marks the test area and does not intercept pointer events.
      </p>
      <p>
        Click Drop at bottom edge on each side. Then try Drop inside editor as a
        control. Buttons dispatch demo File drag/drop events at the
        browser-selected target; they do not call onFiles directly. No real file
        drag is needed.
      </p>
      <div {...stylex.props(singleRowComparisonStyles.comparison)}>
        <SingleRowFileDropCase version="before" />
        <SingleRowFileDropCase version="after" />
      </div>
    </div>
  ),
};

/** Message history — submit a few messages, then ArrowUp/Down to recall */
export const MessageHistory: Story = {
  render: () => {
    const [log, setLog] = useState<string[]>([]);
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          onSubmit={v => setLog(prev => [...prev, v])}
          input={
            <ChatComposerInput placeholder="Submit messages, then ArrowUp to recall..." />
          }
        />
        {log.length > 0 && (
          <div
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--color-text-secondary)',
            }}>
            {log.map((msg, i) => (
              <div key={i}>→ {msg}</div>
            ))}
          </div>
        )}
      </div>
    );
  },
};

/** File paste handler */
export const FilePaste: Story = {
  render: () => {
    const [files, setFiles] = useState<string[]>([]);
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          onSubmit={v => alert(v)}
          input={
            <ChatComposerInput
              onFiles={f => setFiles(prev => [...prev, ...f.map(x => x.name)])}
              placeholder="Paste files here (Ctrl+V)..."
            />
          }
        />
        {files.length > 0 && (
          <div style={{fontSize: 12, color: 'var(--color-text-secondary)'}}>
            Files: {files.join(', ')}
          </div>
        )}
      </div>
    );
  },
};

/** Programmatic text follows the same observable draft path as typing. */
export const ImperativeInsertion: Story = {
  render: () => {
    const inputRef = useRef<ChatComposerInputHandle>(null);
    const [value, setValue] = useState('');
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          value={value}
          onChange={setValue}
          onSubmit={() => {}}
          input={
            <ChatComposerInput
              handleRef={inputRef}
              placeholder="Waiting for dictated text"
            />
          }
        />
        <button
          type="button"
          onClick={() => {
            inputRef.current?.focus();
            inputRef.current?.insertText('Dictated text');
          }}>
          Insert dictated text
        </button>
        <output aria-label="Serialized draft">{value || 'Empty'}</output>
      </div>
    );
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', {name: 'Insert dictated text'}),
    );
    await expect(canvas.getByRole('textbox')).toHaveTextContent(
      'Dictated text',
    );
    await expect(
      canvas.getByRole('status', {name: 'Serialized draft'}),
    ).toHaveTextContent('Dictated text');
    await expect(
      canvas.queryByText('Waiting for dictated text'),
    ).not.toBeInTheDocument();
  },
};

/** Dropped files reach the same attachment callback as pasted files. */
export const FileDrop: Story = {
  render: () => {
    const [files, setFiles] = useState<string[]>([]);
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          onSubmit={() => {}}
          input={
            <ChatComposerInput
              onFiles={next => setFiles(next.map(file => file.name))}
              placeholder="Drop a file here"
            />
          }
        />
        <output aria-label="Received files">
          {files.length === 0 ? 'No files' : files.join(', ')}
        </output>
      </div>
    );
  },
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const textbox = canvas.getByRole('textbox');
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['audit'], 'dropped.txt', {type: 'text/plain'}),
    );

    fireEvent.dragOver(textbox, {dataTransfer: transfer});
    fireEvent.drop(textbox, {dataTransfer: transfer});

    await expect(
      canvas.getByRole('status', {name: 'Received files'}),
    ).toHaveTextContent('dropped.txt');
  },
};

// =============================================================================
// Trigger stories
// =============================================================================

/** Static @ mentions — type @ to see the menu */
export const MentionTrigger: Story = {
  render: () => {
    const [value, setValue] = useState('');
    const [log, setLog] = useState<string[]>([]);
    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: userSource,
      renderItem: item => (
        <TypeaheadItem
          item={item}
          description={(item.auxiliaryData as {role: string})?.role}
        />
      ),
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'blue' as const,
      }),
    };

    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <ChatComposer
          onSubmit={v => {
            setLog(prev => [...prev, v]);
            setValue('');
          }}
          input={
            <ChatComposerInput
              value={value}
              onChange={setValue}
              triggers={[mentionTrigger]}
              placeholder="Type @ to mention someone..."
            />
          }
        />
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--color-text-secondary)',
          }}>
          Value: {JSON.stringify(value)}
        </div>
        {log.length > 0 && (
          <div
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--color-text-secondary)',
            }}>
            {log.map((msg, i) => (
              <div key={i}>→ {msg}</div>
            ))}
          </div>
        )}
      </div>
    );
  },
};

/** Static / commands — type / to see commands */
export const SlashCommands: Story = {
  render: () => {
    const commandTrigger: ChatComposerTrigger = {
      character: '/',
      searchSource: commandSource,
      renderItem: item => (
        <TypeaheadItem
          item={item}
          description={
            (item.auxiliaryData as {description: string})?.description
          }
        />
      ),
      onSelect: item => ({
        value: `/${item.label}`,
        label: `/${item.label}`,
        variant: 'yellow' as const,
      }),
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[commandTrigger]}
            placeholder="Type / for commands..."
          />
        }
      />
    );
  },
};

/** Async search source — type @ to trigger a simulated API search */
export const AsyncSearch: Story = {
  render: () => {
    const asyncTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: asyncUserSource,
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'blue' as const,
      }),
      loadingText: 'Searching users…',
      emptySearchResultsText: 'No users found',
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[asyncTrigger]}
            placeholder="Type @ for async user search (300ms delay)..."
          />
        }
      />
    );
  },
};

/** Multiple triggers — @ for mentions, / for commands */
export const MultipleTriggers: Story = {
  render: () => {
    const [value, setValue] = useState('');
    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: userSource,
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'blue' as const,
      }),
    };
    const commandTrigger: ChatComposerTrigger = {
      character: '/',
      searchSource: commandSource,
      onSelect: item => ({
        value: `/${item.label}`,
        label: `/${item.label}`,
        variant: 'yellow' as const,
      }),
    };

    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <ChatComposer
          onSubmit={v => {
            alert(`Sent: ${v}`);
            setValue('');
          }}
          input={
            <ChatComposerInput
              value={value}
              onChange={setValue}
              triggers={[mentionTrigger, commandTrigger]}
              placeholder="Type @ or / ..."
            />
          }
        />
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--color-text-secondary)',
          }}>
          Value: {JSON.stringify(value)}
        </div>
      </div>
    );
  },
};

/** Custom item rendering in the trigger menu */
export const CustomRenderItem: Story = {
  render: () => {
    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: userSource,
      renderItem: item => (
        <TypeaheadItem
          item={item}
          description={(item.auxiliaryData as {role: string})?.role}
          icon={
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#e8d5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#7c3aed',
              }}>
              {item.label.charAt(0)}
            </div>
          }
        />
      ),
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'purple' as const,
        icon: (
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: '#e8d5f5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 700,
              color: '#7c3aed',
            }}>
            {item.label.charAt(0)}
          </span>
        ),
      }),
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[mentionTrigger]}
            placeholder="Type @ — tokens have icons via badge config..."
          />
        }
      />
    );
  },
};

/** Token color variants — different badge colors per trigger */
export const TokenVariants: Story = {
  render: () => {
    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: userSource,
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'blue' as const,
      }),
    };
    const commandTrigger: ChatComposerTrigger = {
      character: '/',
      searchSource: commandSource,
      onSelect: item => ({
        value: `/${item.label}`,
        label: `/${item.label}`,
        variant: 'purple' as const,
      }),
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[mentionTrigger, commandTrigger]}
            placeholder="@ for blue mentions, / for purple commands..."
          />
        }
      />
    );
  },
};

/** Custom render — full control via render() for rich token content */
export const CustomRender: Story = {
  render: () => {
    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: userSource,
      renderItem: item => (
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
            }}>
            {item.label.charAt(0)}
          </div>
          <span>{item.label}</span>
        </div>
      ),
      onSelect: item => ({
        value: `@${item.id}`,
        render: () => (
          <span
            title={`Click to view ${item.label}'s profile`}
            style={{cursor: 'pointer'}}
            onClick={() => alert(`Profile: ${item.label}`)}>
            <Badge
              variant="blue"
              label={item.label}
              icon={
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: '#c4d4f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 700,
                  }}>
                  {item.label.charAt(0)}
                </span>
              }
            />
          </span>
        ),
      }),
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[mentionTrigger]}
            placeholder="Type @ — tokens are clickable with avatars..."
          />
        }
      />
    );
  },
};

/** Grouped menu items — items with auxiliaryData.group render under headings */
export const GroupedItems: Story = {
  render: () => {
    const groupedUsers = createStaticSource([
      {
        id: 'cindy',
        label: 'Cindy Zhang',
        auxiliaryData: {group: 'Design', role: 'Design Systems'},
      },
      {
        id: 'taylor',
        label: 'Taylor Kim',
        auxiliaryData: {group: 'Design', role: 'Product Design'},
      },
      {
        id: 'alex',
        label: 'Alex Johnson',
        auxiliaryData: {group: 'Engineering', role: 'Frontend'},
      },
      {
        id: 'sam',
        label: 'Sam Rivera',
        auxiliaryData: {group: 'Engineering', role: 'Backend'},
      },
      {
        id: 'morgan',
        label: 'Morgan Chen',
        auxiliaryData: {group: 'Engineering', role: 'Infrastructure'},
      },
      {
        id: 'jordan',
        label: 'Jordan Lee',
        auxiliaryData: {group: 'Product', role: 'Product Manager'},
      },
    ] as SearchableItem[]);

    const mentionTrigger: ChatComposerTrigger = {
      character: '@',
      searchSource: groupedUsers,
      renderItem: item => (
        <TypeaheadItem
          item={item}
          description={(item.auxiliaryData as {role?: string})?.role}
        />
      ),
      onSelect: item => ({
        value: `@${item.id}`,
        label: item.label,
        variant: 'blue' as const,
      }),
    };

    return (
      <ChatComposer
        onSubmit={value => alert(`Sent: ${value}`)}
        input={
          <ChatComposerInput
            triggers={[mentionTrigger]}
            placeholder="Type @ to see grouped mentions..."
          />
        }
      />
    );
  },
};
