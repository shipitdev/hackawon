# Hackawon visual system

## Direction

Hackawon is a technical discovery index with a Mistral-inspired visual language: a full-bleed
amber marquee, sparse geometric type, layered monochrome depth, compact navigation, and a
rule-led catalogue. The reference is an influence, not an asset source. Hackawon keeps its own
wordmark, content, interactions, and original CSS-built deadline terrain.

Design dials: variance 8, motion 4, density 6. Composition may be asymmetric on large screens,
but collapses to a strict single column below 768px. Motion is limited to entry, hover, and state
feedback and must respect reduced-motion preferences.

## Tokens

| Role | Light | Dark |
| --- | --- | --- |
| Hero | `#ec9209` | `#9a3908` |
| Hero depth | `#ab3f05` | `#5d210d` |
| Hero detail | `#f2cc7c` | `#e8ad45` |
| Catalogue | `#eee7dc` | `#151524` |
| Raised surface | `#e5d9c7` | `#211d2d` |
| Ink | `#151524` | `#f4dfb5` |
| Muted ink | `#62594f` | `#c9ad83` |
| Rule | `#c9bba8` | `#493b3a` |

Use semantic CSS tokens rather than raw component colors. Amber is the only accent. Dark mode
uses deep rust and navy surfaces with pale amber text; it keeps the same hierarchy rather than
inverting isolated sections.

## Typography and rhythm

- Geist Variable for display and body; Geist Mono for numbers, dates, labels, and controls.
- Display type is lightweight, tightly tracked, and at most two lines on desktop.
- Use an 8/16/24/40/160px rhythm. Minor 4/12px offsets are allowed for control internals.
- Content width is capped at 1440px.
- Radii are restrained: 0px for sections and catalogue rows, 4px for small controls, 8px for
  primary controls, and 12px only for the detail sheet's contained content.

## Composition

- The sticky header sits in the amber marquee and stays compact at 64px or less.
- The homepage hero is near one viewport tall, split between a two-line statement and an
  integrated deadline module. The deadline terrain uses clipped CSS gradients only.
- The catalogue begins on a warm pale surface. Filters form a command strip with a dominant
  search field, labeled selects, and one horizontal chip rail.
- Listings are an editorial card catalogue: deadline, title, summary, idea teaser, and compact
  facts appear before the detail sheet. Cards are 1 column below 768px, 2 columns through tablet,
  then repeat asymmetric 7/5 and 5/7 spans on a 12-column desktop grid.
- The warm catalogue surface carries a faint engineering grid. Raised cards use 8px corners and
  shallow tonal depth; urgency is the only reason to use pale gold and the amber rule.
- Loading, empty, and error states use the same card geometry as real listings.

## Interaction and accessibility

- Preserve 44px minimum targets for navigation, controls, rows, and save actions.
- Keep visible keyboard focus, native form labels, native dialog behavior, shareable URLs, and
  browser history behavior.
- Sticky filters apply only when the viewport is at least 640px wide and 576px tall.
- All transitions stop under `prefers-reduced-motion: reduce`.
- Do not introduce destinations, account features, dependencies, generated assets, or backend
  behavior.
