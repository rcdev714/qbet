/** Breakpoints & chrome */
export const DESKTOP_BREAKPOINT = 900;
export const TABLET_BREAKPOINT = 768;

export const CONTENT_MAX_WIDTH = 720;
export const CONTENT_MAX_WIDTH_WIDE = 1120;

export const SIDEBAR_WIDTH_EXPANDED = 248;
export const SIDEBAR_WIDTH_COLLAPSED = 84;
export const MOBILE_TAB_BAR_HEIGHT = 84;
export const HEADER_HEIGHT = 56;
export const ADMIN_SIDEBAR_WIDTH = 220;

/** Horizontal page padding */
export const GUTTER_MOBILE = 16;
export const GUTTER_TABLET = 24;
export const GUTTER_DESKTOP = 32;

/** Vertical rhythm */
export const SECTION_GAP_SM = 12;
export const SECTION_GAP_MD = 20;
export const SECTION_GAP_LG = 32;
export const SCREEN_PADDING_TOP = 16;
export const SCREEN_PADDING_BOTTOM = 24;

export type ContentMaxWidth = "narrow" | "wide" | "full";

export function resolveContentMaxWidth(mode: ContentMaxWidth): number | undefined {
  switch (mode) {
    case "narrow":
      return CONTENT_MAX_WIDTH;
    case "wide":
      return CONTENT_MAX_WIDTH_WIDE;
    case "full":
      return undefined;
  }
}

export function resolveGutter(width: number): number {
  if (width >= DESKTOP_BREAKPOINT) return GUTTER_DESKTOP;
  if (width >= TABLET_BREAKPOINT) return GUTTER_TABLET;
  return GUTTER_MOBILE;
}
