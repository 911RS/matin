# Matin — Visual design

Developer document. Not shipped in the app.

## Direction: calm and native

Matin is a minimalist outfit picker for minimalist people. The clothes are the only colour on screen; everything around them is paper, ink and white cards. The interface follows iOS conventions (large titles, segmented controls, inset grouped lists, bottom sheets, the system font) so it feels like a phone app, not a web page, on both the native build and the home-screen PWA.

Rules:
- **Clothes carry the colour.** No accent colour. The main action is ink.
- **Native patterns first.** If iOS has a standard control for it, use that shape.
- **One shadow.** Only the selected segment of a segmented control and the round add button have a soft shadow. Nothing else.
- **Calm motion.** Pressables scale to 0.97 when pressed. Light haptics on wear, shuffle, swap, segment change and tab change (native only).

## Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F7F6F2` | App background, tab bar |
| `surface` | `#FFFFFF` | Cards, grouped lists, sheets, inputs, icon buttons, history days |
| `tile` | `#EFEEE9` | Shelf tone behind garments (outfit card, closet tiles, item photo), secondary buttons, chip and segment tracks |
| `ink` | `#1F1F1C` | Text, primary buttons, selected chips, selected tab |
| `graphite` | `#62615B` | Secondary text (≥ 5:1 on paper, tile and surface) |
| `line` | `#D9D7D0` | Hairline separators, dashed placeholders, sheet grabber |
| `trackOff` | `#8A8880` | Switch track off (≥ 3:1) |
| `danger` | `#9A3B2E` | Destructive actions |

`accent` is an alias of `ink`, kept so focus rings and existing call sites stay consistent.

Garments sit on `tile`, never on white, so white pieces stay visible.

## Type

The platform system font: SF Pro on iOS, Roboto on Android. On the web the stack starts with `-apple-system`, so the iPhone home-screen app also renders SF Pro. No custom fonts are loaded.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 34 / 41 | 700 | Large screen titles |
| `title` | 20 / 25 | 600 | Section and sheet titles, temperature, closet count |
| `body` | 17 / 22 | 400 | Rows, reasons |
| `bodyStrong` | 17 / 22 | 600 | Button labels |
| `label` | 15 / 20 | 500 | Chips, segments |
| `caption` | 13 / 18 | 400 | Secondary text, dates under titles |
| `eyebrow` | 13 / 18 | 400, uppercase | Grouped list section headers, placeholder slot labels |
| `tab` | 10 / 12 | 500 | Tab bar labels |

Numbers that line up (dates, counts, temperatures) use tabular figures.

## Shape and spacing

| Radius | Value | Use |
|---|---|---|
| `stage` | 20 | Outfit card, sheet tops, sign-in and onboarding art |
| `card` | 16 | Cards |
| `tile` | 14 | Closet tiles, buttons, placeholder slots |
| `input` | 12 | Inputs, grouped lists |
| `cell` | 10 | History days |
| `round` | 999 | Chips, icon buttons, add button, colour dots |

Screen side padding is 20. Controls are 50 high; touch targets are at least 44.

## Components

- **Button:** 50 high, radius 14. Primary ink with paper label; secondary `tile` with ink label; danger filled `danger`; text variants have no background.
- **IconButton:** 50 circle, white.
- **SegmentedControl:** `tile` track, white selected segment with a soft shadow, 32 high. Radiogroup / radio roles. Used for Today/Tomorrow and the occasion.
- **Chip:** capsule 34 high. `tile` with ink label; selected is ink with paper label. Used for closet filters and item tags.
- **Group / Row:** inset grouped list: white, radius 12, separators inset 16 from the left. Section headers use `eyebrow`.
- **Sheet:** white, top radius 20, 36×5 grabber.
- **Field:** white, radius 12, no border until focused (1 px ink).
- **Placeholder slots:** dashed `line` outlines with an `eyebrow` label, drawn by the outfit stack and the onboarding preview for missing pieces.
- **Tab bar:** paper with a hairline on top; filled icon in ink when selected, outline icon in graphite otherwise.

## Screens

- **Today:** large title is the weekday and day ("Wednesday 14") with the month under it; weather on the right (icon, temperature in `title`, condition in `caption`). The header wraps the weather under the date on narrow screens. Then the Today/Tomorrow segmented control, the flat-lay on a `tile` card, the occasion segmented control, the reason lines in graphite, and a full-width Wear this button with a round shuffle button.
- **Closet:** large title with the count on the right, chip filters, colour dots, a 3-column grid of `tile` tiles (2 columns under 360 pt), round ink add button.
- **Item:** garment on a `tile` card, wear stats, tag chips grouped under section headers.
- **Add piece:** `tile` preview card, primary Take a photo, secondary Choose from library.
- **History:** month as a large title with round arrow buttons; white rounded day cells; worn days sit on `tile` and show the hero piece; today has a graphite ring, the selected day an ink ring; the chosen day's pieces below.
- **Settings:** inset grouped lists under uppercase section headers.
- **Onboarding and sign-in:** art on a `tile` card; dashed slots fill with cut-outs as pieces are added.

## Accessibility

- Touch targets ≥ 44 pt.
- Every image of a garment has an accessibility label of the form "{color} {category}" ("navy top").
- The Today date header reads the full date ("Wednesday, October 14"); the weather reads "Feels like 14°, Clear".
- The focus ring for keyboard users is 2 px ink.
- Text never sits on a garment image.
