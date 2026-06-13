# HMD Secure — brand for the CRM (`crm/`)

Derived from the **real HMD Secure site** (hmdsecure.com), not the consumer hmd.com
brand. Replaces the earlier teal/orange palette. The goal (a hackathon differentiator):
make the CRM look like HMD Secure's own internal tool.

## Source palette (from hmdsecure.com CSS variables)

| Their token | Hex | Character |
|---|---|---|
| `--color-lime` | `#e4ff00` | Electric lime — signature accent |
| `--color-antracite` | `#242426` | Anthracite, near-black dark surface |
| `--color-black` | `#000000` | |
| `--color-dirty-white` | `#fafafa` | Off-white background |
| `--color-low-gray` | `#5e5e5e` | Muted text |
| `--color-disabled` | `#433e40` | Disabled |
| Font | **Inter** | Clean grotesque sans |

## Strategy: remap tokens in place

Keep the existing CSS-variable / Tailwind names (`hmd-teal`, `hmd-charcoal`, …) and
repoint them, so the ~11 component files (~60 refs) don't change. Names are now legacy
aliases for HMD Secure roles.

**Key constraint:** lime `#e4ff00` is a *light* colour — usable as a fill/accent with
**black text only**, never for white-text buttons or body copy.

| Existing token | New value | Role |
|---|---|---|
| `hmd-teal` | `#e4ff00` lime | Accent: active nav, focus rings, highlights, CTA fills (black text), chart pop |
| `hmd-teal-600` | `#242426` anthracite | Primary buttons/links on white (white text) |
| `hmd-teal-700` | `#0a0a0a` black | Hover / emphasis |
| `hmd-orange` | `#e4ff00` lime | Folds into the single brand pop (warnings use `--warning`) |
| `hmd-gray` | `#5e5e5e` low-gray | Muted text |
| `hmd-charcoal` | `#242426` anthracite | Sidebar / app chrome |
| `hmd-charcoal-soft` | `#2e2e31` | Chrome surfaces |
| `--background` | `#fafafa` dirty-white | |
| `--surface` | `#ffffff` | |
| `--foreground` | `#242426` anthracite | Ink |
| success / warning / danger | unchanged | Status still needs red/amber/green |

## Files changed
- `crm/app/globals.css` — CSS vars + `@theme` remap + `--font-sans` → Inter.
- `crm/lib/brand.ts` — mirror the new token values.
- `crm/app/layout.tsx` — Geist → Inter via `next/font/google`.
- `crm/components/Logo.tsx` — anthracite "HMD" + lime "Secure" accent (typographic only).
- `crm/BRAND.md` — rewrite to document the HMD Secure brand.
- Quick pass over the 11 component files to fix any white-text-on-lime after remapping.

## Principles
1. **Dark chrome, light content** — anthracite sidebar, off-white/white content.
2. **Lime is the single sharp accent** — used sparingly, always black-on-lime.
3. **High-contrast, security-grade restraint** — no decorative colour; Inter throughout.

> Status: design approved 2026-06-13. Implementation pending.
