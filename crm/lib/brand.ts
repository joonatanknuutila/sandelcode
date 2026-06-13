// HMD brand tokens in code form. Mirrors the CSS variables in app/globals.css
// and the documentation in BRAND.md. Import these when you need a brand colour
// in TS (e.g. charts) rather than a Tailwind class.
//
// Source: hmd.com + public brand references. HMD is a typographic-wordmark
// brand: teal primary, orange accent, gray secondary.

export const brand = {
  teal: "#47d7ac", // HMD primary (fills, accents, active-on-dark)
  teal600: "#1f9e7a", // derived — interactive elements on white
  teal700: "#177a5f", // derived — hover / emphasis
  orange: "#ff7f41", // HMD accent — use sparingly
  gray: "#788890", // HMD secondary
  charcoal: "#161d23", // derived — app chrome / sidebar
  charcoalSoft: "#1f2830",

  background: "#f5f7f7",
  surface: "#ffffff",
  border: "#e3e8e8",
  ink: "#0f1719",
  muted: "#5b6a72",

  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
} as const;

export type BrandColor = keyof typeof brand;
