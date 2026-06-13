# HMD Secure — Brand reference (for this CRM)

Local, working brand guide compiled from HMD's live site (hmd.com) and public
brand references (logotyp.us). HMD's official guidelines are partner-gated; this
captures the verifiable, public brand elements so the CRM looks like HMD's own
internal tool. Trademarked assets (the real wordmark/logo) are **not** bundled —
we render a typographic lockup in HMD's colours instead.

## Identity in one line
HMD = "Human Mobile Devices", the largest European phone maker (Finland).
A **typographic wordmark** brand — the lettering is the logo, no symbol/icon.
The product line we serve, **HMD Secure**, targets government & enterprise, so
the CRM leans on the calmer, more professional end of the palette.

## Colour palette

| Token            | Hex        | Role in HMD brand                  | Use in CRM |
|------------------|------------|------------------------------------|------------|
| HMD Teal         | `#47d7ac`  | Primary brand colour (wordmark)    | Brand accent, highlights, active nav, focus |
| Teal 600         | `#1f9e7a`  | Darker teal (derived for contrast) | Buttons, links, primary actions on white |
| Teal 700         | `#177a5f`  | Deeper teal (derived)              | Button hover, emphasis text |
| HMD Orange       | `#ff7f41`  | Accent ("enthusiasm, confidence")  | Sparingly: alerts, CTAs that need pop, warnings |
| HMD Gray         | `#788890`  | Secondary ("professionalism")      | Muted text, secondary UI |
| Charcoal         | `#161d23`  | Derived dark neutral               | Sidebar / app chrome (lets teal pop, reads "secure") |
| Charcoal soft    | `#1f2830`  | Derived                            | Sidebar surfaces, borders on dark |

Supporting neutrals (UI scaffolding, not HMD-specific): background `#f5f7f7`,
surface `#ffffff`, border `#e3e8e8`, ink `#0f1719`.

Semantic: success `#16a34a`, warning `#d97706`, danger `#dc2626`.

### Contrast note
HMD Teal `#47d7ac` is a *light* mint — great as a fill/accent, but too low-
contrast for text or small buttons on white. For interactive elements use
**Teal 600/700**; reserve `#47d7ac` for fills, the wordmark mark, active states
on dark, and large blocks.

## Typography
HMD's wordmark uses a refined, clean **sans-serif**. We don't have the licensed
face, so the CRM uses **Geist** (Next default) / system sans — a neutral,
modern grotesque that matches HMD's clarity-first character. Headings: semibold,
tight tracking. Body: regular. No serifs anywhere.

## Logo usage in this app
- We render `H` in a teal rounded tile + "HMD Secure" wordmark (`components/Logo.tsx`).
- "HMD" is solid/strong; "Secure" is lighter weight to read as the product line.
- Do **not** hotlink or embed HMD's trademarked logo files — colours + type only.

## Design principles for HMD Secure CRM
1. **Quiet confidence.** Government/enterprise buyers — restrained, precise,
   not playful. Teal as accent on a clean neutral canvas; orange only when
   something genuinely needs attention.
2. **Typographic-first**, matching HMD's wordmark identity. Strong type
   hierarchy, generous whitespace.
3. **Dark chrome, light content.** Charcoal sidebar (security/serious tone) with
   bright, scannable white content area.

Source: tokens live in `lib/brand.ts`; CSS variables in `app/globals.css`.
