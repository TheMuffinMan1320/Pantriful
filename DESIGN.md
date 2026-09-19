# Design

<!-- impeccable:design-schema 1 -->

## World

**Konbini Label System.** Every screen reads as real printed inventory data — a barcode
rule, a stamped status mark, dense precise numeric type — never a generic recipe-blog card
grid or a bare CRUD list. Assigned via Impeccable's concept-seed process (mode: operate,
seed `07567a1d`, index 7 of 7 grounded kitchen-world candidates), raised with four
disciplines borrowed from declined catalog challengers: a single global expand-all control
(reserved for a future density toggle), one continuous "freshness" value driving subtle
fade (reserved for expiration-based styling once expiration dates are surfaced in the UI),
urgency expressed as item-name type weight/size rather than a colored badge alone, and
dismissed low-stock alerts move to a visible "set aside" tray instead of vanishing.

## Palette

**Restrained** color strategy (neutrals plus one accent) — this is an Operate-mode app,
task completion over persuasion, on every screen.

Chosen from one physical scene: a home cook in a bright kitchen, daylight or warm overhead
light, unpacking groceries or checking the fridge. Light is the primary designed mode.

- `background` — warm kraft-toned canvas the label cards sit on top of (`#F1EAD9` light /
  `#17130E` dark)
- `backgroundElement` — brighter label-stock surface for every card (`#FFFCF4` /
  `#241E17`)
- `backgroundSelected` — `#ECE0C3` / `#332A1E`
- `text` — warm near-black ink, never pure black (`#221D16` / `#F5EFE2`)
- `textSecondary` — `#655D4D` / `#AFA48C` (both ≥4.5:1 against both surface tones)
- `border` — `#DCD1B4` / `#3A3226`
- `accent` — the one identity color, a stamp-ink/hanko red (`#BE3A26` / `#DD6448`), used
  deliberately: the primary "Add" action, the Recipes "Generate" action, low-stock stamps
- `fresh` — secondary functional color for positive/completed states only ("Active" stamp,
  "Made" stamp, "Mark as made" action) — never a second identity color (`#3A6244` /
  `#6FA47D`)
- `danger` — reuses the accent red for destructive actions (Delete), since a second red
  would dilute the one-accent discipline

All text/background pairs verified ≥4.5:1 (body) or ≥3:1 (large text) by computed WCAG
contrast ratio, not by eye.

## Type

- **Display** (headings, item names, nav labels, buttons): Space Grotesk, weights 400–700.
  A sourced, distinctive grotesk — not a system default — carrying the identity voice.
- **Data** (every number the user reads as data — quantity, price, date, threshold,
  nutrition figures): Space Mono, 400/700. Reinforces the "printed label/receipt" material;
  never used as a "technical" costume elsewhere.
- **Body** (dense paragraph copy — recipe instructions): system font, for legibility at
  small sizes where Space Grotesk's character isn't needed.

## Components

- `LabelCard` (`src/components/label-card.tsx`) — the base surface for every grouped
  content block. Label-stock background, small corner radius (not a pill — real labels and
  shelf tags aren't fully rounded), a fully dashed border reading as a die-cut/tear-off
  perforation, real offset+blur shadow (not flat).
- `BarcodeRule` (`src/components/barcode-rule.tsx`) — a deterministic bar pattern derived
  from a seed string (item id, recipe id, user email), so the same entity always draws the
  same "barcode." Used as a divider under item/recipe names and on the Home wordmark block.
- `StampBadge` (`src/components/stamp-badge.tsx`) — a rotated, circular, ink-colored ring
  with small caps label text. Used for low-stock alerts (accent red "LOW"), a made recipe
  ("MADE", fresh green), and the signed-in state ("ACTIVE", fresh green).
- `Icon` (`src/components/icon.tsx`) — thin wrapper over `expo-symbols`' `SymbolView`. Real
  SF Symbols throughout; no emoji or unicode glyphs stand in for icons anywhere in the app.
- Native tab bar icons use `NativeTabs.Trigger.Icon`'s `sf` prop directly (house.fill,
  shippingbox.fill, fork.knife) — no custom PNG assets.

## Layout discipline

- `ThemedView`'s default `type` paints `background` (the kraft canvas). Only true
  screen-level containers should use `ThemedView` with no explicit `type`; every layout
  wrapper living *inside* a `LabelCard` (or any other themed surface) must be a plain RN
  `View`, or it paints a visibly different-colored rectangle behind its content. This was a
  real defect caught during finish review (canvas-colored blocks behind every grouped text
  section) and fixed across all three screens — worth remembering before adding new
  screens.
- Urgency is expressed by promoting a low-stock item's name to the `title` text style
  (larger, bolder Space Grotesk) rather than only a color badge — the raised discipline
  from the concept-seed process, implemented in the Pantry screen's `isLowStock` check.

## Known gaps / follow-ups

- No custom app icon or wordmark asset exists yet (still the default Expo template icon in
  `app.json`/`assets/expo.icon`) — this needs a produced icon asset before App Store
  submission; out of scope for this pass since no image generation was available.
- The web build (`*.web.tsx` variants, `app-tabs.web.tsx`) was not touched — it still shows
  literal Expo-starter-template branding ("Expo Starter", a link to Expo's docs) and predates
  the app's real screens. Out of scope since the product's platform is iOS-first and web was
  never a tested target; flag before ever shipping the web target.
- Barcode/receipt/camera scanning could not be visually verified against a real photo this
  session (iOS Simulator has no camera) — verified only that the new UI renders and the full
  pipeline runs without crashing, using the earlier session's real-API verification as
  evidence the underlying calls work correctly.
- The "single global expand-all control" and "freshness fade" raised disciplines are
  recorded here as committed system ideas but not yet implemented in the UI — there is no
  density toggle and no expiration-date-driven fade yet, since expiration dates aren't
  currently surfaced as an editable field in the add/edit form.
- No authored motion moment exists yet (e.g. a real "stamp" animation on marking a recipe
  made or on a low-stock alert firing) — `react-native-reanimated` is already a dependency
  and this is a natural next enhancement, deliberately deferred rather than scattering ad
  hoc transitions across the pass.
