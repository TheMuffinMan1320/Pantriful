# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Home cooks who keep a real kitchen pantry and want to know what they have, avoid buying duplicates, and reduce food waste. Primary near-term user is the solo developer building this for personal use, but the app is explicitly being built and polished as if for real App Store users and as a portfolio/interview showcase — design and code quality should hold up to that bar, not just "good enough for me."

## Product Purpose

Pantriful tracks a household's kitchen inventory (manual entry, camera photo ID, receipt scanning, barcode lookup) and turns that inventory into cooking help: AI-generated recipes built from what's actually on hand, with a "mark as made" action that automatically decrements the ingredients used. Success looks like: adding items to the pantry is fast and low-friction (not a chore), and recipe suggestions feel like a genuine shortcut to "what can I cook right now" rather than a generic recipe search.

## Positioning

Unlike a plain shopping-list app or a generic recipe app, Pantriful's mechanism ties real, quantity-tracked inventory directly to recipe generation and back again: recipes are generated against the user's actual current stock (not a static recipe database), ingredients in a generated recipe are linked back to specific inventory rows, and cooking a recipe transactionally decrements those exact quantities. Low-stock detection and push notifications close the loop. No other layer of the product (camera capture, receipt parsing, barcode lookup) exists just for its own sake — each is a faster way to get real quantities into that same inventory-to-recipe loop.

## Operating Context

Used in a kitchen, phone in hand, often with wet or busy hands — quick single-handed interactions matter more than dense information display. Common workflows: putting away groceries (batch add via receipt or barcode scans), a quick top-up add for one or two items, checking "do I have X" before a store trip, and "what should I cook tonight" against current stock. Camera-based flows (photo ID, receipt scan, barcode scan) are used standing at a counter or in front of an open fridge/pantry.

## Capabilities and Constraints

- React Native + Expo (managed workflow), TypeScript, `expo-router` file-based navigation. Custom dev-client builds via EAS (not Expo Go) since the app uses native modules (Google Sign-In, camera, notifications).
- iOS-first target for real App Store submission; Android is a secondary target that comes free from Expo/React Native but has not been the focus of testing or visual tuning so far.
- Backend is a custom Spring Boot + PostgreSQL API (not a BaaS) that this frontend talks to over REST; all inventory/recipe data is real and per-user (Google OAuth2 today, with Sign in with Apple planned before App Store submission).
- Existing screens/flows that this redesign must preserve the behavior of, not just the look: Home (sign-in/sign-out), Pantry (inventory list + manual add/edit/delete + camera-photo-ID mode + receipt-scan mode + barcode-scan mode, each pre-filling the same add/edit form), and Recipes (AI-generate a recipe from current pantry, view recipe detail, mark a recipe as made).
- No existing design system, component library, or documented visual language — current screens use the stock Expo starter-template theme (plain black/white/gray, default system fonts) essentially unchanged.
- No custom app icon, logo, or wordmark exists yet beyond the default Expo template icon.

## Brand Commitments

- Product name "Pantriful" is fixed — already used in the iOS bundle identifier (`com.pantriful.app`), Google OAuth client configuration, and the EAS project, so it cannot change as part of this redesign.
- Everything else visual — icon, color identity, typography, component style, wordmark treatment — is explicitly open for this redesign.

## Evidence on Hand

None. Pre-launch, no real user testimonials, press, case studies, or marketing copy exist. Do not fabricate any.

## Product Principles

1. Inventory entry must feel faster than the alternative (a paper list or a shopping app), which shapes the redesign toward large touch targets, minimal typing, and prominent camera/scan entry points rather than form-first design.
2. Recipe suggestions should feel personally relevant (built from *this* pantry), not generic — the recipe surface should visually communicate "made from what you have," not read like a stock recipe browser.
3. The app must read as a real, finished consumer product — since it doubles as a portfolio piece, avoid anything that looks like an unstyled scaffold or a default framework template.
4. One-handed, kitchen-context usability outranks information density on every core action screen.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet.
