# Datrix Design System

> The intelligence layer beneath every AI system — documented end to end.
> **Version 1.0** · Dark + Light themes · Blue accent · `data-theme`-driven

This is the canonical reference for building any Datrix surface. The system is driven entirely by **CSS custom properties**: mode-independent primitives live on `:root`; each theme overrides a small set of semantic tokens under a `data-theme` attribute. Ship [`datrix-tokens.css`](./datrix-tokens.css) and you have the whole foundation.

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Theming architecture](#2-theming-architecture)
3. [Token reference](#3-token-reference)
4. [Color](#4-color)
5. [Accessibility & contrast](#5-accessibility--contrast)
6. [Typography](#6-typography)
7. [Spacing, radii & layout](#7-spacing-radii--layout)
8. [Breakpoints & responsive rules](#8-breakpoints--responsive-rules)
9. [Z-index scale](#9-z-index-scale)
10. [Elevation & glow](#10-elevation--glow)
11. [Motion](#11-motion)
12. [Iconography](#12-iconography)
13. [Components](#13-components)
14. [Data visualization](#14-data-visualization)
15. [Interaction patterns](#15-interaction-patterns)
16. [Voice & content](#16-voice--content)
17. [Implementation](#17-implementation)
18. [Quality checklist](#18-quality-checklist)
19. [Changelog](#19-changelog)

---

## 1. Design principles

| Principle | In practice |
|---|---|
| **Restraint** | One accent. Two–three surface steps. Hairline borders, not boxes. |
| **Precision** | Mono for labels & numbers. Tabular figures everywhere numeric. |
| **Light type** | Display weight 300; bold (600) only for emphasis spans. |
| **Glow as signal** | Blue glow marks "live" or "interactive" — never decoration alone. |
| **Same system, dialed to context** | Marketing can carry WebGL + motion; a data workspace keeps the tokens, type and hairlines but drops ambient motion. |

The aesthetic is an **instrument panel**: a near-black canvas, a single luminous blue, hairline dividers, mono micro-labels, light-weight display type. Light mode keeps that identity by holding the blue and the hairline language while inverting surfaces.

---

## 2. Theming architecture

### Rules of the system

1. **Themed background goes on `<html>`** (it carries `data-theme`). Body background propagates to the viewport canvas and will *not* repaint reliably when a variable changes on toggle.
2. **Never put a `transition` on a `var()`-driven color.** Chromium can leave the property stuck on its old value. Theme swaps are **instant** by design.
3. **Derive, don't duplicate.** Tints/glows come from `color-mix()` against the live `--accent`, so changing one token cascades everywhere, in both themes.
4. **Semantic over literal.** Components reference `--text-secondary`, never `#7a8aaa`. Only the theme blocks contain raw hex.

### The toggle

```js
// read + apply on load (before paint to avoid a flash)
const saved = localStorage.getItem('datrix-theme') || 'dark';
document.documentElement.dataset.theme = saved;

// flip
function setTheme(t) {
  document.documentElement.dataset.theme = t;          // 'dark' | 'light'
  localStorage.setItem('datrix-theme', t);
}

// optional: follow the OS only if the user hasn't chosen
if (!localStorage.getItem('datrix-theme')) {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark ? 'dark' : 'light');
}
```

To avoid a flash of the wrong theme, set `data-theme` from an inline `<head>` script before the body renders.

---

## 3. Token reference

### Mode-independent primitives (`:root`)

| Group | Tokens |
|---|---|
| **Blue ramp** | `--blue-50 … --blue-900` (accent = `--blue-400` dark / `--blue-600` light) |
| **Fonts** | `--font-display`, `--font-sans`, `--font-mono` |
| **Weights** | `--fw-light: 300`, `--fw-regular: 400`, `--fw-medium: 500`, `--fw-bold: 600` |
| **Type scale** | `--fs-hero`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-stat`, `--fs-lede`, `--fs-body`, `--fs-sm`, `--fs-xs`, `--fs-label`, `--fs-micro` |
| **Spacing** | `--s-0 … --s-30` (4px base) |
| **Radii** | `--radius-xs`, `--radius-btn`, `--radius-md`, `--radius-card`, `--radius-lg`, `--radius-pill` |
| **Layout** | `--container`, `--container-wide`, `--measure-title`, `--measure-body`, `--nav-h`, `--grid-size`, `--hairline` |
| **Z-index** | `--z-base … --z-cursor` |
| **Motion** | `--ease-*`, `--dur-*` |

### Themed semantic tokens

| Token | Dark | Light | Role |
|---|---|---|---|
| `--accent` | `#63b3ff` | `#2f6fe4` | Primary actions, links, live indicators, focus |
| `--accent-hover` | `#7cc0ff` | `#2560cc` | Accent hover |
| `--accent-active` | `#4f9fef` | `#2257bf` | Accent pressed |
| `--bg` | `#050810` | `#ffffff` | Page canvas (on `<html>`) |
| `--bg-2` | `#090d1a` | `#f4f7fc` | Alternating sections, table heads, code |
| `--bg-3` | `#11172a` | `#eaeff8` | Hover fills, raised insets |
| `--bg-card` | `#0d1220` | `#ffffff` | Cards, panels, tiles |
| `--bg-inset` | `#070b15` | `#f8fafd` | Wells, input backgrounds |
| `--border` | `rgba(255,255,255,.07)` | `rgba(13,27,51,.10)` | Hairlines, 1px grid gaps |
| `--border-strong` | `rgba(255,255,255,.15)` | `rgba(13,27,51,.22)` | Hover edges, secondary button |
| `--border-accent` | accent @ 28% | accent @ 32% | Active / featured edges |
| `--text-primary` | `#f0f4ff` | `#0d1b33` | Headlines & key copy |
| `--text-secondary` | `#7a8aaa` | `#4a5878` | Body copy, sub-labels |
| `--text-tertiary` | `#3d4d6a` | `#8a96ad` | Mono micro-labels, captions — **large/decorative only** |
| `--text-on-accent` | `#050810` | `#ffffff` | Text on accent fills |
| `--green` / `--warn` / `--bad` | bright | muted | Success / warning / critical |
| `--glow` | `1` | `0.4` | Global glow intensity multiplier |
| `--grid-opacity` | `0.03` | `0.05` | Backdrop line-grid opacity |

### Status dots (mode-independent)

`#ff5f57` red · `#ffbd2e` yellow · `#28c840` green — only used in the "browser chrome" header of the score card.

---

## 4. Color

One blue spine, three neutral surface steps, three semantic signals.

### Usage rules

- **Accent is precious.** One primary action per view. Don't tint large areas with it — use `--blue-tint` / `--blue-glow` for that.
- **Surfaces step, never clash.** `--bg` → `--bg-2` (sections) → `--bg-card` (cards) → `--bg-inset` (wells). Don't skip steps or stack two cards of the same level with a visible gap; use the 1px hairline grid instead.
- **Semantic colors mean status, not decoration.** Green = healthy/positive delta, warn = at-risk, bad = failing/blocking. Never use green purely because it "looks nice."
- **Borders are hairlines.** Default to `--border`; escalate to `--border-strong` on hover and `--border-accent` for active/featured.

### ✅ Do / ❌ Don't

- ✅ `color: var(--text-secondary)` for body copy.
- ❌ `color: var(--text-tertiary)` for body copy — it fails contrast (see §5).
- ✅ One `.btn-primary` per section.
- ❌ Two accent-filled buttons side by side — demote one to `.btn-secondary`.
- ✅ `background: var(--blue-tint)` behind an icon.
- ❌ `background: var(--accent)` behind a paragraph of text.

---

## 5. Accessibility & contrast

Approximate WCAG 2.1 contrast ratios for the core pairings (verify with your final renders). Thresholds: **AA** 4.5:1 normal / 3:1 large · **AAA** 7:1 normal / 4.5:1 large.

### Dark theme (on `--bg` `#050810`)

| Pairing | Ratio | Verdict |
|---|---|---|
| `--text-primary` `#f0f4ff` | ~18.2:1 | AAA ✓ |
| `--text-secondary` `#7a8aaa` | ~5.7:1 | AA ✓ (not AAA) |
| `--accent` `#63b3ff` | ~8.9:1 | AAA ✓ |
| `--text-tertiary` `#3d4d6a` | ~2.4:1 | ✗ body — **large / decorative only** |

### Light theme (on `--bg` `#ffffff`)

| Pairing | Ratio | Verdict |
|---|---|---|
| `--text-primary` `#0d1b33` | ~17.2:1 | AAA ✓ |
| `--text-secondary` `#4a5878` | ~7.1:1 | AAA ✓ |
| `--accent` `#2f6fe4` (text) | ~4.7:1 | AA ✓ — for small UI text prefer `--blue-700` |
| white on `--accent` (buttons) | ~4.7:1 | AA ✓ |
| `--text-tertiary` `#8a96ad` | ~3.0:1 | AA large only |

### Non-color requirements

- **Focus:** every interactive element shows a visible `:focus-visible` ring (`outline: 2px solid var(--accent)`); never `outline: none` without a replacement.
- **Hit targets:** minimum **44×44px** touch target (pad small controls; don't shrink).
- **Motion:** all entrances/loops gated behind `@media (prefers-reduced-motion: no-preference)`; final visible state is the base style so reduced-motion users never see `opacity:0`.
- **Status is never color-only:** pair `--green/--warn/--bad` with an icon, label, or glyph (`✓`, `↑`, `!`).
- **Semantics:** real `<button>`/`<a>`, `aria-pressed` on toggles, `aria-current` on the active nav link, labelled form fields.

---

## 6. Typography

Two families: **Inter** (display & UI, favoring weight 300 with 600 for emphasis) and **IBM Plex Mono** (labels, numbers, anything technical). Headers tighten tracking; mono labels widen it.

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Role | Token | Family / weight | Size | Tracking | Line height |
|---|---|---|---|---|---|
| Hero | `--fs-hero` | Inter 300 | clamp(44–88px) | −0.03em | 1.05 |
| H1 | `--fs-h1` | Inter 300 | clamp(34–56px) | −0.03em | 1.05 |
| H2 / section | `--fs-h2` | Inter 300 | clamp(28–44px) | −0.02em | 1.15 |
| H3 | `--fs-h3` | Inter 500 | 20px | −0.01em | 1.3 |
| Stat / metric | `--fs-stat` | Inter 300 · tabular | 44px | −0.03em | 1.0 |
| Lede | `--fs-lede` | Inter 300 | clamp(16–20px) | — | 1.6 |
| Body | `--fs-body` | Inter 400 | 16px | — | 1.7 |
| Small | `--fs-sm` | Inter 400 | 14px | — | 1.5 |
| XS | `--fs-xs` | Inter 400 | 13px | — | 1.5 |
| Mono label | `--fs-label` | IBM Plex Mono 400 | 11px | +0.12em · UPPERCASE | — |
| Micro label | `--fs-micro` | IBM Plex Mono 400 | 10px | +0.15em · UPPERCASE | — |

**Rules**

- Body copy never below 13px; mono labels never below 10px.
- Numbers use `font-variant-numeric: tabular-nums` so they don't jitter when counting up.
- Emphasis spans use the accent gradient clip:

```css
.headline strong {
  font-weight: var(--fw-bold);
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

- Cap measure: titles ≤ `--measure-title` (640px), body ≤ `--measure-body` (540px). Use `text-wrap: balance` on headings, `pretty` on paragraphs.

---

## 7. Spacing, radii & layout

A 4px base scale. Sections breathe at 100px; content columns cap at 1100px.

### Spacing tokens

| Token | px | Typical use |
|---|---|---|
| `--s-1` | 4 | Icon nudge, fine gaps |
| `--s-2` | 8 | Chip padding, icon-text gap |
| `--s-3` | 12 | Control padding (Y), tight stacks |
| `--s-4` | 16 | Card gaps, body rhythm |
| `--s-6` | 24 | Page gutter, card padding |
| `--s-8` | 32 | Card padding (roomy) |
| `--s-12` | 48 | Feature column gap |
| `--s-16` | 64 | Head → grid margin |
| `--s-25` | 100 | Section padding (vertical) |

### Radii

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 4 | Focus ring rounding, tiny chips |
| `--radius-btn` | 6 | Buttons, inputs, badges |
| `--radius-md` | 8 | Icon tiles, small panels |
| `--radius-card` | 12 | Cards, panels |
| `--radius-lg` | 16 | Modals, large surfaces |
| `--radius-pill` | 999 | Status pills, toggles, avatars |

### The signature 1px hairline grid

Card groups share crisp single-pixel dividers via `gap: 1px` over a `--border` background — never stacked borders.

```css
.hairline-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--hairline);
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.hairline-grid > * { background: var(--bg-card); }
```

### Backdrop line-grid

```css
html { background-color: var(--bg); }
body::before {
  content: ''; position: fixed; inset: 0; z-index: var(--z-base);
  pointer-events: none;
  background-image:
    linear-gradient(color-mix(in srgb, var(--accent) calc(var(--grid-opacity)*100%), transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--accent) calc(var(--grid-opacity)*100%), transparent) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
}
```

---

## 8. Breakpoints & responsive rules

| Token | Width | Behavior |
|---|---|---|
| `sm` | ≤ 560px | Single column; stack split layouts; metric grids → 2-up; hide secondary nav |
| `md` | ≤ 768px | 2-up card grids; collapse nav to menu; reduce section padding to ~72px |
| `lg` | ≤ 960px | Sidebar → top bar; 3-up grids stay, 4/5-up → 2/3-up |
| `xl` | ≥ 1200px | Full layout; container caps at 1100px (content) / 1280px (wide) |

Rules: never shrink hit targets below 44px on touch; collapse multi-column card grids progressively (5→3→2→1); keep section vertical rhythm proportional (`--s-25` desktop → ~72px mobile).

---

## 9. Z-index scale

Always use the scale; never invent magic numbers.

| Token | Value | Layer |
|---|---|---|
| `--z-base` | 0 | Backdrop grid, hero canvas |
| `--z-raised` | 1 | Content above backdrop |
| `--z-sticky` | 50 | Sticky sub-headers, sticky preview |
| `--z-nav` | 100 | Fixed top nav |
| `--z-overlay` | 800 | Scrims, drawers |
| `--z-modal` | 900 | Dialogs |
| `--z-toast` | 1000 | Toasts / notifications |
| `--z-cursor` | 10000 | Custom cursor (marketing only) |

---

## 10. Elevation & glow

Depth = soft ambient shadow + a blue glow scaled by `--glow` (1 dark, 0.4 light). Glow signals interactive/live.

| Token | Dark definition | Use |
|---|---|---|
| `--shadow-soft` | `0 12px 40px -24px rgba(0,0,0,.7)` | Ambient panel depth |
| `--shadow-card` | `0 24px 80px -32px accent@40%` | Hovered / featured cards |
| `--shadow-pop` | `0 16px 48px -16px rgba(0,0,0,.8)` | Modals, popovers, toasts |
| `--blue-glow` | `accent @ 14%` | Button & dot glow, focus rings |
| `--focus-ring` | `0 0 0 3px var(--blue-glow)` | Input focus halo |

```css
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px calc(30px * var(--glow)) var(--blue-glow);
}
```

Live "pulse" dot:

```css
.dot-live {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 calc(8px * var(--glow)) var(--accent);
  animation: pulse 2.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.5; transform:scale(.8);} }
```

---

## 11. Motion

Quick and eased, never bouncy. House easing: `cubic-bezier(.2,.7,.2,1)`.

| Motion | Token(s) | Spec | Where |
|---|---|---|---|
| Hover | `--dur-fast`/`--dur-base` | 0.15–0.2s ease | Links, buttons, cards |
| Reveal | `--ease-out` | 0.8s, stagger 0.09 | On-scroll section entrances |
| Count-up | `--dur-count` | 1.3s ease-out | Stats, metrics |
| Bar fill | `--dur-bar` + `--ease-standard` | 1.1s | Score bars |
| Pulse | — | 2.5s ease-in-out ∞ | Live dot / status |
| Theme swap | — | instant | Token re-resolve (no color tween) |

```css
@media (prefers-reduced-motion: no-preference) {
  [data-reveal] { /* animate from hidden */ }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

> Make the **visible end-state the base style** and animate *from* hidden. Print, PDF export, and reduced-motion then show content, never pre-animation `opacity:0`.

---

## 12. Iconography

- **Style:** thin line icons, ~1.5px stroke, 24px grid, rounded joins. Match the hairline aesthetic; avoid filled/duotone.
- **Sizing:** 16px inline, 18–20px in buttons, 24px standalone. Icon tiles sit in a 40px rounded square (`--radius-md`) with `--blue-tint` background and `--border-accent` border.
- **Color:** inherit `currentColor`; accent tiles use `--accent`.
- **Geometric glyphs** (`⬡ ◈ ◎ ◇ ⬢`) are acceptable as lightweight section/step markers.
- **No emoji** in product UI.

```css
.icon-tile {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  background: var(--blue-tint); border: 1px solid var(--border-accent);
  display: grid; place-items: center; color: var(--accent);
}
```

---

## 13. Components

Every component lists **anatomy → states → variants → a11y**. All states use tokens only.

### 13.1 Buttons

**Variants:** `primary` (accent fill), `secondary` (hairline), `ghost` (accent border, enterprise), `danger` (bad).
**Sizes:** sm `padding: 8px 16px / 13px`, md `14px 32px / 14px` (default), lg `16px 40px / 15px`.
**States:** default · hover (`-1px` lift + glow) · active (`translateY(0)`, `--accent-active`) · focus-visible (ring) · disabled (`opacity:.45; pointer-events:none`) · loading (spinner, label dimmed, width locked).

```css
.btn-primary {
  font: var(--fw-medium) var(--fs-sm)/1 var(--font-sans);
  padding: 14px 32px; letter-spacing: .01em;
  background: var(--accent); color: var(--text-on-accent);
  border: none; border-radius: var(--radius-btn); cursor: pointer;
  transition: all var(--dur-base) var(--ease-standard);
}
.btn-primary:hover  { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 8px calc(30px*var(--glow)) var(--blue-glow); }
.btn-primary:active { background: var(--accent-active); transform: translateY(0); }
.btn-primary:disabled { opacity:.45; pointer-events:none; box-shadow:none; transform:none; }

.btn-secondary {
  padding: 14px 32px; background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border); border-radius: var(--radius-btn);
  transition: all var(--dur-fast);
}
.btn-secondary:hover { color: var(--text-primary); border-color: var(--border-strong); }

.btn-ghost {
  padding: 13px 28px; background: transparent; color: var(--text-primary);
  border: 1px solid var(--border-accent); border-radius: var(--radius-btn);
}
.btn-ghost:hover { background: var(--blue-tint); border-color: var(--accent); }

.btn-danger { background: var(--bad); color: #fff; }
```

**a11y:** real `<button>`; `aria-busy="true"` while loading; disabled buttons keep ≥4.5:1 label contrast where possible or add a tooltip explaining why.

### 13.2 Inputs & form fields

**Fields:** text, email, number, textarea, select. **Padding** `12px 16px`, `--fs-sm`, `--bg-inset` background, `--border`.
**States:** default · hover (`--border-strong`) · focus (`--accent` border + `--focus-ring`) · filled · error (`--bad` border + `--bad` helper) · success (`--green`) · disabled (`opacity:.5`).

```css
.field {
  width: 100%; padding: 12px 16px; font: var(--fw-regular) var(--fs-sm) var(--font-sans);
  background: var(--bg-inset); color: var(--text-primary);
  border: 1px solid var(--border); border-radius: var(--radius-btn);
  outline: none; transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
}
.field::placeholder { color: var(--text-tertiary); }
.field:hover { border-color: var(--border-strong); }
.field:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
.field[aria-invalid="true"] { border-color: var(--bad); }
.field-label { font: var(--fw-regular) var(--fs-label) var(--font-mono); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-tertiary); }
.field-help { font-size: var(--fs-xs); color: var(--text-secondary); }
.field-help.error { color: var(--bad); }
```

**Checkbox / radio / toggle:** 18px control, `--radius-xs` (checkbox) / pill (radio, toggle), `--accent` when checked, `--focus-ring` on focus. Toggle track 36×20px.
**a11y:** every field has a `<label for>`; errors use `aria-invalid` + `aria-describedby` pointing at the helper.

### 13.3 Badges / tags

| Variant | Background | Text | Border |
|---|---|---|---|
| `.ok` | `--green-dim` | `--green` | green @ 22% |
| `.warn` | `--warn-dim` | `--warn` | warn @ 28% |
| `.bad` | `--bad-dim` | `--bad` | bad @ 28% |
| `.accent` | `--blue-glow` | `--accent` | `--border-accent` |
| `.neutral` | `--bg-3` | `--text-secondary` | `--border` |

```css
.badge {
  font: var(--fw-regular) var(--fs-label) var(--font-mono);
  padding: 5px 11px; border-radius: var(--radius-btn);
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
}
.badge.ok { background: var(--green-dim); color: var(--green); border: 1px solid color-mix(in srgb, var(--green) 22%, transparent); }
```

Always include a glyph (`✓ ↑ ! ●`) so status isn't color-only.

### 13.4 Card

```css
.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: var(--s-8);
  transition: border-color var(--dur-base), transform var(--dur-base), box-shadow var(--dur-base);
}
.card:hover { border-color: var(--border-accent); transform: translateY(-3px); box-shadow: var(--shadow-card); }
.card--flat:hover { transform: none; box-shadow: none; } /* in dense data views */
```

### 13.5 Navigation

Fixed, `--nav-h` (64px) tall, `backdrop-filter: blur(12px)`, 85% `--bg`, hairline bottom border that appears on scroll. Links `--fs-xs` `--text-secondary` → `--text-primary` on hover; active link gets `aria-current="page"` and accent color. One `.btn-primary` CTA at the right.

### 13.6 Tabs / segmented control

Pill container `--bg-2` + hairline; active segment fills `--accent` with `--text-on-accent`; `--dur-fast` transition; `role="tablist"` + `aria-selected`.

### 13.7 Accordion / FAQ

Hairline-separated rows; summary `--fs-lede`; a `＋`→`✕` chevron rotates 45° on open; `<details>/<summary>` for free keyboard support.

### 13.8 Tooltip / popover

`--bg-3` surface, `--border`, `--radius-md`, `--shadow-pop`, `--fs-xs`. 8px offset, 150ms fade. Never put essential-only info in a hover tooltip (touch users).

### 13.9 Modal / dialog

Scrim `rgba(0,0,0,.6)` at `--z-overlay`; panel `--bg-card`, `--radius-lg`, `--shadow-pop`, max-width 520px, at `--z-modal`. Trap focus, `Esc` closes, restore focus on close, `role="dialog"` + `aria-modal="true"` + labelled title.

### 13.10 Toast / banner

Toast at `--z-toast`, `--bg-3` + left accent/semantic bar, auto-dismiss 5s (pausable), `role="status"` (info) / `role="alert"` (error). Inline banner spans content width with a semantic tint background.

### 13.11 Table / data grid

Header row `--bg-2`, mono `--fs-micro` uppercase `--text-tertiary` labels; rows separated by `--border`; numbers right-aligned + tabular; row hover `--bg-3`. Avoid heavy gridlines — hairlines only.

### 13.12 Quality score card (signature)

**Anatomy:** browser-chrome header (3 status dots + mono URL) → hairline grid of metric cells (mono uppercase label, large tabular value colored by health, thin fill bar) → footer (meta + status badge). Values count up; bars animate to width on reveal.

```css
.metric-value.good { color: var(--green); }
.metric-value.warn { color: var(--warn); }
.metric-bar-fill { height: 3px; background: var(--accent); transition: width var(--dur-bar) var(--ease-standard); }
```

---

## 14. Data visualization

- **Palette:** sequence values along the blue ramp (`--blue-300 → --blue-700`); reserve `--green/--warn/--bad` for thresholded status, not categories.
- **Bars & sparklines:** 3–4px height, `--radius-pill` ends, `--border` track, animate width with `--ease-standard`.
- **Gridlines:** hairline `--border`, no heavy axes; label in mono `--fs-micro`.
- **Always tabular figures**; show units in `--text-tertiary`.
- **Color is never the only encoding** — add labels/markers for accessibility.

---

## 15. Interaction patterns

Optional, taste-forward layers. Carry what suits the surface; all degrade gracefully and respect reduced motion.

| Pattern | What it does | Suggested scope |
|---|---|---|
| WebGL hero | Three.js point/line field tinted by `--accent`, mouse-parallax | Marketing |
| Cursor glow | 520px radial accent glow trailing the pointer | Marketing |
| Card spotlight | Radial sheen following the cursor (`--mx/--my`) | Marketing + app cards |
| 3D tilt | ±6° perspective tilt, springs back | Marketing hero card |
| Magnetic buttons | CTA eases toward cursor (0.35 strength) | Marketing |
| Scroll progress | 2px accent bar, `scaleX` by scroll | Both |
| Film grain | Fixed SVG-noise overlay ~4.5% | Marketing |

> **Restraint scales with surface.** A workspace keeps tokens, type and hairlines but drops ambient motion.

---

## 16. Voice & content

- **Confident, technical, plain.** "Your model is only as good as your data." Short clauses, active voice.
- **Numbers are proof.** Lead with the metric ("+9 F1 points overnight"), not the adjective.
- **Mono for the machine, sans for the human.** Labels, file names, metrics, code → mono. Narrative → sans.
- **No hype words** ("revolutionary", "magical"). State what it does.
- **Sentence case** for UI; UPPERCASE only for mono micro-labels.

---

## 17. Implementation

### Files

| File | Purpose |
|---|---|
| `datrix-tokens.css` | All tokens + base reset + focus ring + reduced-motion. Import first. |
| `Datrix Design System.html` | Live, themeable reference (toggle, swatches, demos). |
| `Datrix Design System.md` | This document. |

### Quick start

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>document.documentElement.dataset.theme = localStorage.getItem('datrix-theme') || 'dark';</script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="datrix-tokens.css">
</head>
<body>
  <!-- app -->
</body>
</html>
```

### Mapping to other stacks

**Tailwind** — drop the tokens into `theme.extend`:

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      accent: 'var(--accent)',
      bg: 'var(--bg)', 'bg-2': 'var(--bg-2)', card: 'var(--bg-card)',
      ink: 'var(--text-primary)', muted: 'var(--text-secondary)',
      ok: 'var(--green)', warn: 'var(--warn)', bad: 'var(--bad)',
    },
    borderRadius: { btn: 'var(--radius-btn)', card: 'var(--radius-card)' },
    fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
    boxShadow: { card: 'var(--shadow-card)' },
  },
}
```

**React (CSS vars as props)** — components read tokens via class names; theme lives on `<html data-theme>`. No JS color logic in components.

### Don'ts

- ❌ Hard-coded hex in components — reference tokens.
- ❌ `transition` on a `var()`-driven color.
- ❌ Themed background on `<body>` instead of `<html>`.
- ❌ `outline: none` without a visible replacement.
- ❌ New z-index numbers outside the scale.

---

## 18. Quality checklist

Before shipping a screen:

- [ ] Background set on `<html>`; both themes verified by toggling.
- [ ] All colors reference tokens — zero raw hex in components.
- [ ] Body text uses `--text-primary`/`--text-secondary` (never `--text-tertiary`).
- [ ] Every interactive element has a visible `:focus-visible` ring.
- [ ] Touch targets ≥ 44×44px.
- [ ] Status conveyed by icon/label, not color alone.
- [ ] Numbers use tabular figures.
- [ ] Motion gated behind `prefers-reduced-motion`; content visible without JS.
- [ ] Z-index values come from the scale.
- [ ] Layout holds at sm / md / lg / xl.
- [ ] Forms: labelled fields, `aria-invalid` + described errors.

---

## 19. Changelog

| Version | Date | Notes |
|---|---|---|
| **1.0** | 2026 | Initial system. Dark (source of truth) + derived light theme, full token set, component specs, a11y contrast audit, implementation guide. |

---

*Datrix Design System v1.0 — keep the blue, keep the hairlines, keep it quiet.*
