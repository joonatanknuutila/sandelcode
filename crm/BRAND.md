# HMD Secure — Brand reference (for this CRM)

Brand guide derived from the **real HMD Secure site** (hmdsecure.com). The CRM is
themed to look like HMD Secure's own internal tool. Trademarked logo files are **not**
bundled — we render a typographic lockup in HMD Secure's colours instead.

Full design rationale + token mapping: `../docs/brand-hmd-secure.md`.

## Identity in one line
HMD Secure (secured Android devices + services for government/enterprise) presents a
**dark, high-contrast, security-grade** look: anthracite/black chrome, an off-white
content canvas, and a single sharp **electric-lime** accent. Typeface: **Inter**.

## Colour palette (from hmdsecure.com)

| Token | Hex | Role |
|-------|-----|------|
| Lime | `#e4ff00` | Signature accent — active nav, focus, highlights, CTA fills |
| Anthracite | `#242426` | App chrome / sidebar, ink (body text), primary buttons |
| Black | `#0a0a0a` | Hover / emphasis |
| Dirty white | `#fafafa` | Background canvas |
| Surface | `#ffffff` | Cards / surfaces |
| Low gray | `#5e5e5e` | Muted / secondary text |
| Border | `#e6e6e6` | Hairlines |

Semantic (kept for status): success `#16a34a`, warning `#d97706`, danger `#dc2626`.

### ⚠️ Lime is a *light* colour
`#e4ff00` is near-fluorescent. Use it **only** as a fill/accent with **black/anthracite
text on top** (active nav pill, badges, the logo tile, progress fills, focus rings).
**Never** use lime as text on white, and never put white text on lime. For primary
buttons/links on a light background use **anthracite** (white text); for hover use black.

## Token names are legacy aliases
To avoid churning ~60 call sites, the existing Tailwind/CSS names are kept but repointed:
`hmd-teal` → lime, `hmd-teal-600` → anthracite, `hmd-teal-700` → black, `hmd-orange`
→ lime, `hmd-charcoal` → anthracite. New code should read these as HMD Secure roles,
not literal colours. Tokens: `lib/brand.ts` (TS) + `app/globals.css` (CSS vars / `@theme`).

## Typography
**Inter** (via `next/font/google` in `app/layout.tsx`, exposed as `--font-inter` →
`--font-sans`). Headings: semibold, tight tracking. Body: regular. No serifs.

## Logo
`components/Logo.tsx` — lime rounded tile with an anthracite "H", then "HMD" (strong) +
"Secure" (lighter, the product line). Typographic only; no trademarked assets.

## Design principles
1. **Dark chrome, light content.** Anthracite sidebar / app chrome; bright, scannable
   off-white + white content area.
2. **Lime is the single sharp accent.** Used sparingly, always black-on-lime.
3. **Security-grade restraint.** Government/enterprise buyers — precise, high-contrast,
   no decorative colour. Strong type hierarchy, generous whitespace.
