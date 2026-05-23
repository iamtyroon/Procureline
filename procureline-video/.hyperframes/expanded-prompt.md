# Expanded Prompt: Procureline Product Automation Demo

A 10-second product demo video divided into three thematic acts to showcase Procureline's automated workflow solution.

## 1. Style & Design Grounding
- **Background Color**: `#FAF9F6` (Alabaster / Warm Off-White)
- **Primary Text / Dark Elements**: `#1A1A1C` (Deep Rich Charcoal)
- **Accents**: 
  - Indigo (`#3F51B5`) - Workflow block state / active links
  - Terracotta (`#D4501E`) - Critical warning or key action block
  - Gold (`#D4AF37`) - Highlighting success / automation paths
- **Typography**:
  - Headlines: `Plus Jakarta Sans`, 800 weight, letter-spacing `-0.03em`
  - Labels & Body: `Inter`, 400 weight
- **Shape Specs**: Corner rounding `8px` to `12px` border-radius; margins and padding aligned on a base-8 grid (`16px`, `24px`, `48px`).

## 2. Rhythm Declaration
**Pattern: chaotic-PAUSE-smooth-snappy**
- **Act 1: The Pain** (0.0s - 4.0s) - Rapid, overwhelming visual clutter.
- **Act 2: The Breath** (4.0s - 5.5s) - Sudden pause, smooth clearing sweep.
- **Act 3: The Automation** (5.5s - 10.0s) - Rhythmic, physical block snapping with elastic overshoot.

---

## 3. Per-Scene Beats

### Scene 1: Act 1 — The Pain (0.0s - 4.0s)
- **Concept**: Visual representation of manual procurement friction. Stacked spreadsheets, overlapping data cells, flashing error boxes, and a chaotic headline to simulate a chaotic workday.
- **Mood Direction**: Industrial overwhelm, geometric noise, dense text layers.
- **Depth Layers**:
  - **BG**: Warm alabaster canvas with a faint, tight grid pattern overlaid with chaotic code blocks.
  - **MG**: Overlapping card nodes representing spreadsheets, purchase requests, and emails colliding.
  - **FG**: Flashing alert text "MANUAL OVERLOAD" in terracotta (`#D4501E`) and deep charcoal (`#1A1A1C`) headlines.
- **Animation Choreography**:
  - Headline "MANUAL CHAOS" SLAMS down at 0.2s with a slight rotate (-2deg).
  - Four spreadsheet rows CASCADE and overlay each other rapidly at 0.5s, 0.8s, 1.1s, and 1.4s.
  - Terracotta alerts PUNCH in with high-velocity jitter at 1.8s and 2.2s.
- **Transition Out**: Velocity-matched upward sweep: outgoing elements exit with a vertical translation (`y: -300px`, `opacity: 0`, `duration: 0.5s`, ease: `power2.in`), leading into Act 2.

### Scene 2: Act 2 — The Breath (4.0s - 5.5s)
- **Concept**: A sudden pause. A single, clean sweep lines up all the clutter and wipes it off the canvas, leaving a peaceful, empty alabaster workspace. A simple, elegant title appears.
- **Mood Direction**: Editorial calm, minimalism, clean paper sweep.
- **Depth Layers**:
  - **BG**: Solid `#FAF9F6` background. Faint horizontal line rules.
  - **MG**: A single, clean title card: "Enter Procureline."
  - **FG**: None (intentional negative space to let the viewer breathe).
- **Animation Choreography**:
  - A vertical dividing line DRAWS down the center at 4.2s.
  - Outgoing Act 1 cards are swept to the left and fade away completely at 4.4s.
  - The words "Enter Procureline." slide up from an invisible baseline (`y: 40px` to `0`, `opacity: 0` to `1`, `duration: 0.8s`, ease: `power3.out`) at 4.5s.
- **Transition Out**: Clean horizontal whip pan (`x: -1920px`, `duration: 0.5s`, ease: `power2.inOut`).

### Scene 3: Act 3 — The Automation (5.5s - 10.0s)
- **Concept**: Procurement automation in motion. Clean UI workflow blocks (Indigo, Terracotta, Gold) float down and snap together perfectly to show how Procureline automates tasks.
- **Mood Direction**: Tactile, satisfying mechanical precision, playful physics.
- **Depth Layers**:
  - **BG**: Clean alabaster canvas with a soft radial glow (`#3F51B5` at 5% opacity) in the center.
  - **MG**: Three workflow blocks: "Purchase Request" (Indigo), "Budget Check" (Gold), and "Auto-Approval" (Indigo).
  - **FG**: Connectors and validation checkmark (Terracotta) showing the automation path.
- **Animation Choreography**:
  - Headline "EFFORTLESS FLOW." fades in and moves up slightly at 5.8s.
  - Block 1 (Indigo) DROPS down and lands at 6.2s with `elastic.out(1, 0.7)` bounce.
  - Block 2 (Gold) SLIDES in from the right and snaps into Block 1 at 6.8s with elastic overshoot.
  - Block 3 (Indigo) DROPS down and snaps at 7.4s with elastic overshoot.
  - A glowing terracotta connector line DRAWS from Block 1 to Block 3 at 8.0s.
  - A success checkmark icon BOUNCES into view on the final node at 8.5s.
  - Final scene elements hold, then fade to black (opacity `0`) at 9.6s.
