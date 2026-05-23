---
name: Alabaster Precision
colors:
  primary: "#FAF9F6"
  on-primary: "#1A1A1C"
  accent-indigo: "#3F51B5"
  accent-terracotta: "#D4501E"
  accent-gold: "#D4AF37"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "5rem"
    fontWeight: 800
    letterSpacing: "-0.03em"
  label:
    fontFamily: "Inter"
    fontSize: "0.875rem"
    fontWeight: 400
  stat:
    fontFamily: "Plus Jakarta Sans"
    fontSize: "7rem"
    fontWeight: 800
    letterSpacing: "-0.03em"
rounded:
  none: 0px
  md: 8px
  lg: 12px
spacing:
  sm: 16px
  md: 24px
  lg: 48px
motion:
  energy: moderate
  easing:
    entry: "power3.out"
    exit: "power2.in"
    elastic: "elastic.out(1, 0.7)"
  duration:
    entrance: 0.6
    hold: 2.0
    transition: 0.8
  transition: cross-warp-morph
---

# Alabaster Precision Design System

Mathematical precision with approachable, warm aesthetics. Designed for the Procureline product demonstration.

## Overview
Alabaster Precision balances structural rigidity with humanistic design details. It is built on a base-8 grid system and uses a warm off-white canvas coupled with deep charcoal text and intentional, warm accents.

## Colors
- **Primary Canvas (Background)**: `#FAF9F6` (Alabaster / Warm Off-White) - Avoids pure white to prevent eye strain and feel premium.
- **On-Primary (Text & Dark Elements)**: `#1A1A1C` (Deep Rich Charcoal) - Banned pure black.
- **Accent - Indigo**: `#3F51B5` (Deep, soft Indigo) - Main color for active items/workflow states.
- **Accent - Terracotta**: `#D4501E` (Muted Terracotta) - Focus items or warnings.
- **Accent - Gold**: `#D4AF37` (Warm Gold) - Secondary highlights.

## Typography
- **Headlines & Stats**: `Plus Jakarta Sans`, Extra Bold (800), with reduced letter-spacing (`-0.03em`) for a strong visual anchor.
- **Body & Labels**: `Inter`, Regular (400) or Light (300). Readable geometric sans-serif.

## Spacing & Shape (Grid & Corners)
- **Base-8 Grid**: Margins, padding, and layout gaps must snap to `16px` (`sm`), `24px` (`md`), or `48px` (`lg`).
- **Rounded Corners**: Use `8px` (`md`) to `12px` (`lg`) border-radius on all cards, buttons, and visual block containers to soften the layout while remaining professional.

## Motion & Pacing
- **Act 1: The Pain**: Chaotic, overlapping, rapid cuts. Visual clutter and spreadsheet rows stacked tightly.
- **Act 2: The Breath**: Smooth sweep (e.g. clean transition clearing the canvas).
- **Act 3: The Automation**: Rhythmic snapping of workflow blocks with tactile elastic overshoot (`elastic.out`).
