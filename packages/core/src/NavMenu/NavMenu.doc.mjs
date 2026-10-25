// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file NavMenu.doc.mjs
 * @input Public NavHeadingMenu composition and item interaction behavior
 * @output Consumer guidance for disabled navigation, click/activation-key callbacks, and focus
 * @position Shipped NavHeadingMenu documentation
 */

/** @type {import('@astryxdesign/cli/authoring').ComponentAnatomyElement[]} */
const anatomy = [
  {
    name: 'Menu',
    required: true,
    description:
      'Menu container for nav-heading actions, with menu semantics and keyboard navigation.',
  },
  {
    name: 'Item',
    required: true,
    description: 'Selectable action or navigation link inside the Menu.',
  },
  {
    name: 'Icon',
    required: false,
    description: 'Optional Icon-rendered artwork shown before an Item label.',
  },
  {
    name: 'Text-rendered item label',
    required: false,
    description: 'String Item label rendered through Text.',
  },
  {
    name: 'Caller-rendered item label',
    required: false,
    description: 'Non-string Item label content rendered directly by the caller.',
  },
  {
    name: 'Item description',
    required: false,
    description: 'Optional supporting description rendered through Text.',
  },
];

/** @type {import('@astryxdesign/cli/authoring').ComponentDoc} */

export const docs = {
  name: 'NavHeadingMenu',
  displayName: 'Nav Heading Menu',
  group: 'Navigation',
  category: 'Navigation',
  isHiddenFromOverview: true,
  hidden: false,
  keywords: ['nav', 'menu', 'navigation', 'heading', 'menu-item', 'popover'],
  usage: {
    anatomy,
    description:
      'Accessible menu container and items for nav heading popovers. ' +
      'NavHeadingMenu provides role="menu" with keyboard navigation; ' +
      'NavHeadingMenuItem renders individual selectable items. ' +
      'Pass as the menu prop of SideNavHeading or TopNavHeading. ' +
      'Disabled items keep their focus owner and tabIndex=-1 without navigating or invoking selection, click-capture, auxiliary-click, or double-click callbacks on the item. ' +
      'Disabled action rows also withhold Enter/Space from item keydown, keypress, and keyup callbacks in capture and bubble phases; other keys, focus/hover observation, parent menu events, and caller-rendered label events remain available. ' +
      'Arrow navigation and typeahead continue to skip disabled items. ' +
      'Use aria-describedby on NavHeadingMenuItem to connect an explanation.',
  },
  playground: {
    defaults: {
      children: [
        {__element: 'NavHeadingMenuItem', props: {label: 'Dashboard', href: '#'}},
        {__element: 'NavHeadingMenuItem', props: {label: 'Analytics', href: '#'}},
        {__element: 'NavHeadingMenuItem', props: {label: 'Settings', href: '#'}},
      ],
    },
  },
  props: [
    {name: 'children', type: 'ReactNode', required: true, description: 'Menu items.'},
    {name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Controls min-width and item padding.'},
    {name: 'minWidth', type: 'number | string', description: 'Minimum width override.'},
    {name: 'xstyle', type: 'StyleXStyles', description: 'StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}.'},
  ],
  theming: {
    targets: [
      {className: 'astryx-nav-heading-menu', visualProps: ['size']},
      {className: 'astryx-nav-heading-menu-item', visualProps: ['size']},
    ],
  },
};

/** @type {import('@astryxdesign/cli/authoring').ComponentTranslationDoc} */
export const docsDense = {
  description: 'Accessible menu container + items for nav heading popovers. NavHeadingMenu = role="menu" w/ keyboard nav; NavHeadingMenuItem renders selectable items.',
  usage: {
    anatomy,
    description:
      'Accessible menu container + items for nav heading popovers. NavHeadingMenu provides role="menu" w/ keyboard navigation; NavHeadingMenuItem renders individual selectable items. Pass as menu prop of SideNavHeading or TopNavHeading. Disabled items retain focus + tabIndex=-1, block navigation and item selection/click-capture/auxiliary-click/double-click callbacks, and stay skipped by arrows/typeahead. Disabled action rows withhold Enter/Space from item keydown/keypress/keyup callbacks (capture + bubble), preserving other keys, focus/hover, parent menu events, and caller-rendered label events. Connect explanations via item aria-describedby.',
  },
  propDescriptions: {
    size: 'controls min-width + item padding',
    minWidth: 'minimum width override',
  },
};
