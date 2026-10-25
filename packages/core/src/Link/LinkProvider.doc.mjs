// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file LinkProvider.doc.mjs
 * @input Provider-level router integration and navigation safety behavior
 * @output Consumer guidance for accepted destinations and forwarded DOM refs/events
 * @position Shipped LinkProvider documentation
 */

/** @type {import('@astryxdesign/cli/authoring').ComponentDoc} */

export const docs = {
  name: 'LinkProvider',
  displayName: 'Link Provider',
  group: 'Utilities',
  category: 'Utility',
  isHiddenFromOverview: true,
  keywords: ['link', 'provider', 'router', 'nextjs', 'client-side-routing'],
  usage: {
    description: 'Wraps your app to replace the default <a> tag with a framework-specific link component (e.g. Next.js Link) for client-side routing across all Astryx components.',
  },
  props: [
    {name: 'component', type: 'LinkComponentType', required: true, description: 'Link component to use for all link elements in the subtree (e.g. Next.js Link). It receives accepted `href` and `to` values under the shared navigation rule described on the Link `href` prop. Supported structured destinations, including their `protocol`, are checked without changing object identity. If either supplied destination is rejected, Astryx renders inert content without invoking this component; it does not pass undefined or fall back to the other destination. Forward the DOM ref and supplied DOM event handlers to the anchor. Link uses them to keep a mounted router focused while disabled, remove its native destination, and block activation; initially disabled Link renders without invoking the router.'},
    {name: 'children', type: 'ReactNode', required: true, description: 'Content to render with the link provider.'},
  ],
};

/** @type {import('@astryxdesign/cli/authoring').ComponentTranslationDoc} */
export const docsDense = {
  description: 'Wraps app to replace default <a> tag w/ framework-specific link component (e.g. Next.js Link) for client-side routing across all Astryx components.',
  usage: {
    description: 'Wraps app to replace default <a> tag w/ framework-specific link component (e.g. Next.js Link) for client-side routing across all Astryx components.',
  },
  propDescriptions: {
    component: 'link component for all link elements in subtree (e.g. Next.js Link). Accepted href/to follow the Link href rule; structured fields including protocol are checked, preserving identity. Either rejected => inert content, no router invocation or fallback. Forward the anchor DOM ref and supplied DOM event handlers so Link can preserve focus and block disabled activation. Initially disabled Link skips the router.',
  },
};
