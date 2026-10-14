# Matin — Visual design

Developer document. Not shipped in the app.

## Direction: the flat-lay

Matin is a morning ritual: you look at today's clothes and get dressed. The clothes are the hero. Every garment is a cut-out, so the app lays them out like a flat-lay photo on a single flat color field. The interface around that field stays quiet: neutral surfaces, one accent, one typeface, no shadows.

The one memorable element is the **stage**: a large, flat, rounded color field behind today's outfit. Its color changes with the outfit and the weather. Everything else is calm and leaves room for it.

Rules that follow from this:
- **Flat.** No shadows, gradients, blur or glass. Depth comes only from color fields and overlap.
- **Garments over labels.** Closet tiles show the cut-out only, with no text under it. Names live on the detail screen.
- **One accent.** Cobalt marks the main action on each screen. Nothing else is cobalt.
- **Radius follows hierarchy,** not one value everywhere: stage 28, tiles 20, inputs 14, buttons and chips fully round.
- **Left-aligned text.** Only numbers inside calendar cells are centered.

## Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F4F5F3` | App background (cool neutral, not cream) |
| `surface` | `#FFFFFF` | Sheets, settings rows, inputs |
| `ink` | `#16181A` | Text, selected chips, icons |
| `graphite` | `#5F6368` | Secondary text (5.5:1 on paper, 5.1:1 on tile, at least 4.5:1 on every stage tint) |
| `trackOff` | `#84888D` | Switch track when off (3.3:1 on paper, 3.6:1 on surface) |
| `line` | `#E3E4E0` | Hairlines (1 px), unselected chip borders |
| `tile` | `#ECEDE9` | Closet tiles, empty slots |
| `accent` | `#2B4BDB` | Primary button, active tab, focus ring |
| `onAccent` | `#FFFFFF` | Text on accent |
| `danger` | `#C2412D` | Delete account, destructive confirm |

### Stage tints

The Today stage, the Add-item preview and the item detail header use a tint picked from the outfit:

1. If the outfit has a non-neutral piece, use that piece's family tint. If it has two, use the first in outfit order.
2. Otherwise use the weather tint.

Color family tints:

| Family | Tint | Family | Tint |
|---|---|---|---|
| black | `#E4E4E2` | green | `#DCE8DF` |
| white | `#EDEEEA` | red | `#F3DCD8` |
| grey | `#E3E5E6` | pink | `#F5E1E8` |
| navy | `#DCE2EE` | yellow | `#F4EDCB` |
| blue | `#D9E4F7` | purple | `#E6DFF1` |
| beige | `#EFE7DA` | denim | `#DAE3EE` |
| brown | `#E9DDD3` | multi | `#ECE6F0` |

Weather tints (for all-neutral outfits):

| Condition | Tint |
|---|---|
| Rain | `#DDE3EA` |
| Cold (< 12°C) | `#DCE6EF` |
| Mild | `#E6EBE3` |
| Warm (≥ 22°C) | `#F2E7D9` |

Text on any tint is `ink`. All tints are light enough for 7:1 contrast with ink and 4.5:1 with graphite. `src/__tests__/theme.test.ts` checks these ratios.

## Type

One family: **Instrument Sans** (`@expo-google-fonts/instrument-sans`, weights 400, 500, 600, 700), loaded with `expo-font` before the splash hides.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 34 / 38, letter-spacing −0.6 | 600 | Screen titles (Today's date, Closet, History) |
| `title` | 22 / 28, −0.3 | 600 | Section titles, sheet titles |
| `body` | 16 / 23 | 400 | Reason text, paragraphs |
| `bodyStrong` | 16 / 23 | 600 | Buttons, selected values |
| `label` | 14 / 19 | 500 | Chips, row labels, tab labels |
| `caption` | 13 / 18 | 400 | Secondary info, counts |
| `tab` | 12 / 16 | 500 | Tab bar labels |

- Sentence case everywhere. No all-caps labels, no tracked-out eyebrows.
- No middle-dot meta strings. The engine's reason comes as `"A · B"`: split it on `" · "` and render each part as its own line.
- Numbers (temperature, counts) use the same family with `fontVariant: ['tabular-nums']`.

## Spacing

Spacing comes from `space(px)` with values 0, 4, 8, 12, 16, 20, 24 and 32.
- Screen side padding: 20.
- Space between major blocks: 24.

## Components

- **Control height:** `size.control` = 52, used by buttons, icon buttons, fields and placeholders.
- **Button, primary:** accent fill, onAccent `bodyStrong`, height 52, fully round, full width or flex. Pressed state: opacity 0.85. Disabled: `tile` fill with `graphite` text.
- **Button, secondary:** `surface` fill, 1 px `line` border, ink text, same shape.
- **Icon button:** 52 × 52 circle in `surface` with a 1 px `line` border, Ionicons outline at 22 px in ink. Shuffle uses `shuffle-outline`.
- **Chip:** height 36, horizontal padding 14, fully round.
  - Unselected: transparent with a 1 px `line` border and ink `label`.
  - Selected: ink fill with white `label`.
  - Chips in a single-choice set (the Today day switch, the occasion row) use the `radio` role with a checked state. Other chips are buttons with a selected state.
  - Color chips are 28 px circles of the family's swatch color with a 2 px `line` ring. Selected: a 2 px ink ring with 2 px offset.
- **Tile:** `tile` fill, radius 20, square, cut-out centered with 12 padding, `contentFit="contain"`.
- **Row (settings):** `surface`, height ≥ 56, left label, right value in `graphite`, hairline between rows. Grouped in a radius 20 block with no outer border.
- **Tab bar:** `paper` background, top hairline, no shadow. Icons are Ionicons outline, filled when active. Active color `accent`, inactive `graphite`. Labels use the `tab` type token.

Swatch colors for color chips (the garment color itself, not the tint):
black `#1C1C1C`, white `#F7F7F5`, grey `#9A9DA0`, navy `#1F2A44`, blue `#3A6FD8`, beige `#D8C3A5`, brown `#6B4423`, green `#3F7D3A`, red `#C0392B`, pink `#E89AB5`, yellow `#F1C40F`, purple `#7D3C98`, denim `#5470A0`, multi = a 4-segment conic of red/yellow/blue/green (or a split circle; flat, no gradient blur).

## Screens

### Today

```
┌──────────────────────────────────┐
│ Monday 13     Feels like 9°      │  display date left; feels-like temperature (title) right,
│ October                 rain     │  caption month under the date; condition (label) under the temperature
│ ┌──────────────────────────────┐ │
│ │            ▟▙ jacket          │ │  stage: tinted field, radius 28, height ~58% of screen
│ │     ▄▄ top                    │ │  pieces as a flat-lay: vertical order outerwear, top/dress,
│ │          ▐▌ trousers          │ │  bottom, shoes; alternate left/right offsets of ±12% width,
│ │     ▂▂ shoes                  │ │  each piece overlapping the previous by ~10%; no shadows
│ └──────────────────────────────┘ │
│ Rain expected: jacket on         │  reason parts, body, one per line
│ Navy and beige match             │
│                                  │
│ [      Wear this       ]  ( ⤨ )  │  primary button + shuffle icon button
└──────────────────────────────────┘
```

- Tap a piece to swap that slot. The piece cross-fades to the next one (180 ms opacity plus 8 px vertical shift). Use `reduceMotion` to make it an instant change. This is the only animation on the screen.
- After "Wear this", the button becomes secondary with a checkmark icon and the text "Worn today", and is disabled.
- The chip reads "Feels like 9°" ("Ressenti 9°"). The number comes from the engine's `shownTemperature`, so it matches the reason line.
- Weather assumed: no number. The chip shows a small `help-circle-outline` icon with "Weather assumed", and the reason's first line explains it.
- Offline on a new day with a cached closet: the app suggests from the cache with assumed weather and syncs the row later. With nothing cached it shows the offline message and a Retry button instead of the loading skeleton.
- Day switch: above the stage, a "Today" / "Tomorrow" pair of chips in a row (gap 8, bottom padding 16), exposed as a radio group. Tomorrow shows a read-only preview. Its pieces are not buttons and read as images. The weather chip reads "Tomorrow" instead of "Feels like". Under the reason: a `caption` "Preview. It may change if you add pieces or the forecast changes." and a secondary "Back to today" button. Offline with nothing cached it shows the offline message instead of the skeleton.
- Occasion chips: a wrapping row of three chips above the reason, Casual / Work / Going out, exposed as a radio group. Tapping one re-picks the outfit with the same seed for that formality. Tapping the selected chip clears it. The choice is remembered for the day on the device, and reverts if the write fails. Hidden once the outfit is worn and in the tomorrow preview.
- In the wash: if a piece of today's outfit is in the wash, a `caption` "A piece is in the wash" sits under the reason with a text button "New outfit" that shuffles.
- Missing state: the stage shows empty `tile`-colored slot outlines (1.5 px dashed `line`) for the missing categories with their names in `label`, then the sentence "Add a top and shoes to get suggestions" and a primary "Add a piece" button.
- Loading: the stage at its tint with three `tile` placeholder blocks. No spinner.

### Closet

```
┌──────────────────────────────────┐
│ Closet                       24  │  display title, count in graphite title size
│ (All)(Tops)(Bottoms)(Shoes)(…)   │  horizontally scrolling category chips
│ ● ● ● ● ●                        │  color dots for families present
│ ┌──────┐ ┌──────┐                │  2-column grid of tiles, gap 12
│ │ cut  │ │ cut  │                │
│ └──────┘ └──────┘                │
│                          ( + )   │  floating round accent button 60 px, bottom right, 20 inset
└──────────────────────────────────┘
```

- Forgotten chip: the last chip in the category row, "Forgotten". Selected, it shows only pieces older than 30 days that have not been worn in the last 30 days. With no match it shows "Nothing forgotten. Nice."
- Wash badge: a tile for a piece in the wash is dimmed to 40% opacity and shows a 16 px `water-outline` icon in `graphite`, 8 px from the top-right corner. Its accessible label adds "in the wash until {date}".
- Empty state: one large `tile` square with a `shirt-outline` icon, the sentence "Your closet is empty", and a primary "Add your first piece" button.
- Long-press a tile, or tap it, to open the item screen. Tap is fine here.

### Add item (modal)

1. **Choose:** two large stacked buttons ("Take a photo" primary, "Choose from library" secondary) on `paper`. A caption under them: "Lay the piece flat or hang it, on a plain background."
2. **Processing:** the chosen photo dimmed in a radius 28 frame, with the text "Removing the background…" under it. Preparing (model download): same layout with "Getting ready. This happens once."
3. **Review:**
   - The cut-out on a stage tinted with its detected family, radius 28, height ~40%.
   - Below it, groups with `title`-less `label` headings in graphite: Category chips, Color dots, Warmth chips (Light / Medium / Warm), Occasion chips.
   - A pinned bottom primary button "Save piece", disabled until a category is chosen.
4. **Failed:**
   - The original photo in the frame.
   - The message in body.
   - Two buttons: "Retake photo" (primary) and "Use photo as is" (secondary).

### Item

- Header stage with the cut-out (tinted), then the same chip groups as Add review.
- Stats: under the stage, one `body` line "Worn N times" (or "Worn once") and a `caption` line "Last worn N days ago" ("Last worn today"). A piece never worn shows only "Not worn yet". They appear once the wear history has loaded.
- Availability: a group labelled "Availability" with chips "Available", "1 day", "3 days", "1 week" (a single choice). A chosen duration puts the piece in the wash until that date. "Available" clears it.
- At the bottom, a text-style destructive button "Archive piece" in `danger`, which opens a confirm sheet.

### History

```
┌──────────────────────────────────┐
│ October 2026            ‹   ›    │  display month, icon buttons
│ M  T  W  T  F  S  S              │  caption weekday initials (locale order)
│ ┌──┐┌──┐┌──┐...                  │  7-column grid of square cells, radius 12
│ │12││▟▙││14│                     │  worn days show a tiny cut-out of the top/dress on the
│ └──┘└──┘└──┘                     │  day's stage tint; other days show the number in caption
│                                  │
│ Tuesday 13                       │  selected day: title + horizontal row of tiles
│ [tile][tile][tile]               │
└──────────────────────────────────┘
```

- Today's cell has a 2 px ink ring. The selected cell has a 2 px accent ring.

### Settings

- `display` title "Settings", then grouped rows:
  - **Mornings:** Notification time; Location (Use my location / city).
  - **App:** Language.
  - **Account:** Sign out; Delete account in danger.
  - **About:** "Weather data: MET Norway" in caption.
- The time picker is a sheet with two wheels or a 15-minute list. Keep it flat.

### Onboarding

- `display` heading "Start your closet", a short body line, then three rows: Tops, Bottoms, Shoes.
- Each row has the label, `n / target` in tabular graphite, and a segmented bar under it (one 6 px segment per required piece, ink when filled, `line` otherwise, 4 px gaps).
- Primary "Add a piece" button. When everything is done, the button becomes "Continue". Step 2 reuses the settings rows for time and location, then "Finish".

### Sign-in

- The top half is a stage tinted `#DCE2EE` with three demo cut-outs (from the demo assets) laid out as a flat-lay.
- Under it: "Matin" in `display`, one body line "Your outfit for the day, every morning.", then stacked buttons: Apple (iOS only, black system button), "Continue with Google" (secondary), "Continue with email" (secondary).
- The email step replaces the buttons with an input and a primary button. It does not open a new screen.

## Accessibility

- Touch targets ≥ 44 pt.
- Every image of a garment has an accessibility label of the form "{color} {category}" ("navy top").
- The focus ring for keyboard/switch users is 2 px `accent`.
- Text never sits on a garment image. It sits on tints or `paper` only.
