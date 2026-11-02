---
version: alpha
name: Digitalsale
description: Warm paper marketplace — ink black, ember accent, Instrument Serif + Space Grotesk. No gradients, no glassmorphism.
colors:
  paper: "#FBFAF7"
  paper-2: "#F5F1E9"
  card: "#FFFFFF"
  ink: "#1C1917"
  body: "#44403C"
  muted: "#78716C"
  faint: "#A8A29E"
  line: "#E7E0D4"
  line-soft: "#F0EAE0"
  ember: "#EA580C"
  ember-deep: "#C2410C"
  ember-soft: "#FFF1E8"
  mint: "#15803D"
  mint-soft: "#E8F7EE"
  gold: "#D97706"
  gold-soft: "#FFF7E6"
typography:
  display:
    fontFamily: Instrument Serif
    fontSize: clamp(2.2rem, 5vw, 3.6rem)
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  ui-h1:
    fontFamily: Instrument Serif
    fontSize: clamp(1.5rem, 3vw, 2.1rem)
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  ui-h2:
    fontFamily: Instrument Serif
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.15
  ui-h3:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: Space Grotesk
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.6
  body-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.04em
  mono-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.14em
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  section: 72px
rounded:
  sm: 10px
  md: 12px
  lg: 16px
  pill: 999px
shadow:
  card: "0 1px 2px rgba(28, 25, 23, 0.05), 0 4px 16px rgba(28, 25, 23, 0.06)"
  lift: "0 2px 4px rgba(28, 25, 23, 0.06), 0 12px 32px rgba(28, 25, 23, 0.10)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    fontWeight: 600
    fontSize: 15px
  button-primary-hover:
    backgroundColor: "#000000"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  button-outline:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.line}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 26px"
    fontWeight: 600
    fontSize: 15px
  button-outline-hover:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.ink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.line}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    fontSize: 15px
  input-focus:
    borderColor: "{colors.ember}"
    boxShadow: "0 0 0 3px {colors.ember-soft}"
  product-card:
    backgroundColor: "{colors.card}"
    borderColor: "{colors.line-soft}"
    rounded: "{rounded.lg}"
    shadow: "{shadow.card}"
  empty-state:
    textAlign: center
    padding: "72px 24px"
    color: "{colors.muted}"
dark:
  paper: "#121110"
  paper-2: "#1A1815"
  card: "#1D1B17"
  ink: "#F2EDE3"
  body: "#CFC8BC"
  muted: "#A39E93"
  faint: "#6E6A61"
  line: "#2E2A24"
  line-soft: "#232019"
  ember: "#FF6B2C"
  ember-deep: "#FF8A50"
  ember-soft: "#2B1A0E"
  mint: "#4ADE80"
  mint-soft: "#0E2A1A"
  gold: "#FBBF24"
  gold-soft: "#2A2110"

## Overview

Digitalsale is a warm paper marketplace for digital goods. The visual language is
paper and ink with a single ember accent — no gradients, no glassmorphism, no
SaaS gradients, no indigo/violet defaults. Typography is the primary design
element: Instrument Serif for headlines, Space Grotesk for UI and body.

## Colors

- **Paper (#FBFAF7):** Canvas background. Warm, not stark white.
- **Ink (#1C1917):** Near-black for headlines, primary buttons, important text.
- **Body (#44403C):** Main body text.
- **Muted (#78716C):** Secondary text, labels, captions.
- **Line (#E7E0D4):** Borders and dividers.
- **Ember (#EA580C):** Single accent — focus states, active items, category chips,
  price emphasis. Used sparingly.
- **Mint (#15803D):** Positive states, seller earnings, "keep 90%" cues.
- **Gold (#D97706):** Affiliate, verification, trust cues.
- **Dark mode:** Same ink on dark paper. Ember shifts to #FF6B2C. Never pure
  black backgrounds — paper-2 (#1A1815) and card (#1D1B17) keep depth subtle.

## Typography

Instrument Serif for headlines (h1, h2) — editorial, confident, expensive.
Space Grotesk for UI, body, labels, navigation — clean, legible at small sizes.
One type system across every page. No mixing in system-ui fallbacks.

## Layout

One spacing scale: 8, 16, 24, 32, 48, 72. Used everywhere. Sections use 72px
vertical padding. Cards use 16px radius max. Buttons are pill-shaped (999px).
Mobile-first: Telegram Mini App is the primary surface. Desktop is deliberate,
not stretched — max-width 1200px.

## Components

Buttons: primary (ink fill), outline (card fill, line border), dark (ink fill,
dark mode inverse). Inputs: card background, line border, ember focus ring.
ProductCard: cover image leads, category chip above title, price at bottom right,
store name quiet (muted). Empty states: centered, no illustration, headline +
body + optional action.

## Accessibility

Focus-visible rings on all interactive elements. Touch targets minimum 44px.
Color never used alone to convey state — icons and text accompany color cues.
