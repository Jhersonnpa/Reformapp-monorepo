/** Design tokens — misma marca que legacy (primary #0F2B48 / accent #FF5722). */
export const colors = {
  primary: "#0F2B48",
  primaryLight: "#F3F7FB",
  primarySoft: "#E3F0FF",
  accent: "#D9480F",
  text: "#1F2937",
  muted: "#4B5563",
  border: "#D1D5DB",
  error: "#B91C1C",
  errorSoft: "#FDECEC",
  success: "#15803D",
  successSoft: "#E5F6EC",
  warning: "#B45309",
  warningSoft: "#FEF3E2",
  background: "#F3F7FB",
  card: "#FFFFFF",
  white: "#FFFFFF",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Escala tipográfica (iOS-unidades, sin dependencias). */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 16,
  lg: 18,
  xl: 22,
  hero: 24,
} as const;

/** Sombra sutil de tarjeta (iOS + elevación Android). */
export const shadow = {
  card: {
    shadowColor: "#0F2B48",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
