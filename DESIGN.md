# Pulse design system

## Overview

Pulse is a dense, read-only Solana research dashboard. Its visual idea is a quiet charcoal workspace with lavender controls and green/red trade signals. The working product leads the page: filters control the tracking list, and nearby activity explains changes. The first 390-pixel screen includes the product title, live-data action, filter action, and a tracked position.

`src/styles.css` is the style source of truth. `src/components.tsx` contains reusable primitives; `src/App.tsx` composes the dashboard, token watch, activity history, and dialogs. `src/model.ts` owns shared domain formatting and calculations.

## Colors

CSS uses a compact neutral and status palette, with semantic aliases in the root block.

| Semantic token | Value | Use |
| --- | --- | --- |
| `--bg` | `#101014` | Page canvas |
| `--surface` | `#141419` | Main panels |
| `--surface-raised` | `#18181f` | Fields and dialogs |
| `--hover` | `#1e1e27` | Hover and segmented-control backgrounds |
| `--border` | `#2c2c37` | Structural panel and field boundaries |
| `--text` | `#f0eff6` | Main text and values |
| `--muted` | `#b0afbf` | Secondary copy and controls |
| `--subtle` | `#9291a5` | Captions and metadata |
| `--accent` | `#b8a4ff` | Primary button fill and active navigation |
| `--accent-soft` | `#29223c` | Selected navigation and replacement events |
| `--accent-ink` | `#211735` | Text on the primary fill |
| `--positive` | `#6bdbb2` | Positive P/L and buy indicators |
| `--negative` | `#ff929f` | Negative P/L, sells, and form errors |
| `--warning` | `#edc080` | Paused and delayed states |
| `--focus` | `#c8b8ff` | Two-pixel keyboard outline |

The fixed dark palette is intentional; no alternate theme is implemented. Session banners use a distinct dark lavender surface (`#1c1925`), with `#cdbef4` heading text and `#b0a7c0` explanation text. Positive and negative states also include signs, action words, or directional icons. The final probe measured visible text against resolved backgrounds and passed its 4.5:1 normal-text / 3:1 large-text threshold. This does not cover every possible external token name or every browser.

## Typography

Inter Variable's local Latin WOFF2 is bundled by Vite from `@fontsource-variable/inter`. The CSS requests weights 400, 500, and 600; the supplied variable font covers 100–900. Fallbacks are Inter, the platform system stack, Segoe UI, and sans-serif. Font loading was confirmed in Chromium. Full addresses use monospace inside the details dialog.

The six declared size tokens are 12, 13, 14, 16, 24, and 30 pixels. Captions and dense data use 12; navigation/actions use 13; body and row values use 14; secondary headings and mobile inputs use 16; summary values and dialog headings use 24; the desktop page title uses 30. The phone title uses 24. Only four repeated sizes and one additional desktop title size appeared in the default rendered screen.

Body line height is 1.5; title line height is 1.2; secondary headings use 1.4. Headings use modest negative tracking, at most −0.035em for the main title. Numbers use tabular figures. Prose wraps naturally; complete addresses wrap anywhere in the detail view. Short addresses in rows are deliberate summaries with full values available in the dialog and copy control.

## Layout

The desktop shell uses a 208-pixel sticky left rail and a flexible content column. The content area has 32-pixel horizontal insets and a 1,700-pixel maximum width. Within the main workspace, spacing generally uses 4, 8, 12, 16, 20, 24, and 32 pixels; close groups use smaller gaps than section boundaries. Default grid rows combine identity, buy amount, market cap, holding time, unrealized P/L, and a sparkline. The activity column is 281 pixels at ordinary desktop widths.

Responsive behavior is explicit in `src/styles.css`:

- Above 1,600 pixels, content gains a little vertical space and the activity column grows to 310 pixels.
- At 1,350 pixels and below, activity moves under the wallet list. The sidebar narrows before it disappears.
- At 1,100 pixels, filters become a two-column form; less essential table trend cells are hidden.
- At 820 pixels, the rail becomes a compact mobile header and three-item navigation strip.
- At 700 pixels, the summary shows tracked count and unrealized return. Filters become a disclosure with the applied ranges kept visible. Each wallet row becomes a three-column responsive record with identity and holding time above labeled numeric fields. Price trends remain available in details.
- At 480 pixels, main insets are 16 pixels and the live-data action spans the content width. Activity becomes a single column. At 360 pixels, smaller insets and a shorter filter summary preserve room for controls.

The mobile filter disclosure initially follows viewport size. A user can open or close it; successful apply collapses it on narrow screens. No fixed bottom action covers the records. The actual export was checked for overflow at 320, 390, 768, 1024, and 1440 pixels. Native browser zoom, RTL, and translated layouts were not tested; English is the only implemented language.

## Elevation & Depth

Panels use flat tonal layers and a one-pixel structural border. They do not combine a border and shadow. The toast alone uses a soft shadow. Native dialogs sit in the browser's top layer over a dark backdrop with a four-pixel blur. The sidebar is sticky, while the main page, filters, and wallet records remain in normal document flow.

## Shapes

Panel radii are 9–10 pixels, controls generally 6–7 pixels, count badges 4 pixels, and dialogs 14 pixels. Token images and event markers are circular. Images have a one-pixel low-opacity white outline. Icons come from Lucide and inherit `currentColor`; the pulse logo and small platform marks are local vector shapes.

## Components

| Component or pattern | Location | Implemented behavior |
| --- | --- | --- |
| `Modal` | `src/components.tsx:10` | Native modal dialog, accessible title, Escape/backdrop close, background inertness, trigger-focus restoration |
| `CopyButton` / `Address` | `src/components.tsx` | Full value copied, brief checkmark, polite success notice; selected-address fallback on failure |
| `TokenAvatar` | `src/components.tsx` | Local token art or a text initial when metadata has no art |
| `Sparkline` | `src/components.tsx` | Observed/simulated price samples; green/red variants; larger detail-chart variant; decorative SVG with textual P/L alongside |
| `.button` | `src/styles.css` | Primary lavender fill, secondary outlined surface, compact variant, visible focus and hover states |
| Tracking filter form | `src/App.tsx:102` | Native number/select inputs, grouped legends, validated submit, error descriptions and focus, reset, mobile disclosure |
| Wallet record | `src/App.tsx:115` | Stable position identity, token copy, detail view, buy/cap/hold/P&L, responsive labeled cells |
| `EventRow` | `src/App.tsx` | Buy, sell, and replacement icons plus action text and relative timestamp |
| Session banner | `src/App.tsx:92` | Explicit demo/live/connecting/delayed/error/paused status and reconnect action |
| `.segmented` | `src/styles.css` | Native buttons with `aria-pressed` for event filtering |
| Toast | `src/App.tsx:140` | Pre-existing polite status region and persistent dismiss control |

Interaction feedback uses named color/background/border transitions lasting 120 ms. Under `prefers-reduced-motion: no-preference`, primary button presses scale to 0.96. There are no endless CSS animations. Data updates are independent of decorative motion and can be paused. Numeric inputs are 16 pixels on phones. Small copy and table controls meet the probe's minimum target/spacing rule, although many are below the optional 44-pixel comfort target.

## Do's and Don'ts

- Reuse the semantic color tokens and the six type sizes. Preserve a single visibly dominant action within a control group.
- Put controls before the data they change, and preserve the full-value path for shortened addresses.
- Label any simulated data. Show stale or unavailable provider state instead of inventing a successful connection or a wallet balance.
- Keep errors actionable, return keyboard focus from dialogs, and use native buttons, inputs, selects, and dialogs.
- Add another view through the existing hash navigation and main content shell. Reuse panel headings, empty states, copy controls, and table-to-record responsive behavior.
- Do not add an unneeded wallet connection, nested card stack, global animation, extra font family, or external runtime font dependency.

The Better Interface and Impeccable documentation guidance informed this implementation. Attribution and license texts are preserved in `THIRD_PARTY_NOTICES.md` and `licenses/`.
