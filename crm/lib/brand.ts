// HMD brand tokens in code form. Mirrors the CSS variables in app/globals.css
// and the documentation in BRAND.md. Import these when you need a brand colour
// in TS (e.g. charts) rather than a Tailwind class.
//
// Source: hmdsecure.com. HMD Secure brand: anthracite/black chrome + electric-
// lime accent on off-white, Inter type. Token KEYS (teal/orange/charcoal) are
// legacy aliases kept so call sites don't churn — they hold HMD Secure roles now.
// NOTE: lime (#e4ff00) is light — use with BLACK text only, never white-on-lime.

export const brand = {
  teal: "#e4ff00", // ACCENT (lime) — fills/highlights/active, black text on top
  teal600: "#242426", // primary interactive on white (white text) — anthracite
  teal700: "#0a0a0a", // hover / emphasis — black
  orange: "#e4ff00", // folded into the single lime accent
  gray: "#5e5e5e", // secondary / muted — low-gray
  charcoal: "#242426", // app chrome / sidebar — anthracite
  charcoalSoft: "#2e2e31",

  background: "#fafafa", // dirty-white
  surface: "#ffffff",
  border: "#e6e6e6",
  ink: "#242426", // anthracite
  muted: "#5e5e5e", // low-gray

  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
} as const;

export type BrandColor = keyof typeof brand;
