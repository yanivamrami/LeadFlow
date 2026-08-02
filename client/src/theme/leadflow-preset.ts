import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * LeadFlow — PrimeNG 20 preset.
 * World: שלט שוק / the market sign — ink on poster stock, one fluorescent field for
 * today, one red for commit. Zero radius, no shadows, heavy rules.
 * Mirrors client/src/theme/tokens.css and docs/DESIGN-SYSTEM.md — change all three together.
 *
 * providePrimeNG({ theme: { preset: LeadFlowPreset,
 *   options: { darkModeSelector: '[data-theme="dark"]' } } })
 */
// The preset uses project-specific primitive ramps (red/paper) and extra component
// tokens that @primeuix/themes' compile-time token map doesn't enumerate; the theme
// engine resolves them dynamically at runtime, so the literal is widened here.
export const LeadFlowPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0',
    },
    // commit red — primary action, Won, cleared marks
    red: {
      50: '#fdf0ee', 100: '#fbdcd9', 200: '#f5b3ac', 300: '#ee847a',
      400: '#e04b3e', 500: '#cc1b12', 600: '#b3150e', 700: '#8f110b',
      800: '#6b0d08', 900: '#470906', 950: '#2c0604',
    },
    // paper ramp — poster stock through to ink; carries pipeline progression
    paper: {
      50: '#fbf7ee', 100: '#f7f1e4', 200: '#efe7d4', 300: '#e8dcc0',
      400: '#c9b98f', 500: '#a2957a', 600: '#6b6358', 700: '#4a453d',
      800: '#2e2a25', 900: '#221f1b', 950: '#14110f',
    },
  },

  semantic: {
    primary: {
      50: '{red.50}', 100: '{red.100}', 200: '{red.200}',
      300: '{red.300}', 400: '{red.400}', 500: '{red.500}',
      600: '{red.600}', 700: '{red.700}', 800: '{red.800}',
      900: '{red.900}', 950: '{red.950}',
    },
    borderRadius: { none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
    focusRing: {
      width: '3px',
      style: 'solid',
      color: '{primary.color}',
      offset: '2px',
      shadow: 'none',
    },
    formField: {
      paddingX: '12px',
      paddingY: '11px',
      borderRadius: '0',
      focusRing: { width: '3px', style: 'solid', color: '{primary.color}', offset: '0' },
    },
    transitionDuration: '120ms',

    colorScheme: {
      light: {
        surface: {
          0: '#ffffff', 50: '#fbf7ee', 100: '#f7f1e4', 200: '#efe7d4',
          300: '#e8dcc0', 400: '#c9b98f', 500: '#a2957a', 600: '#6b6358',
          700: '#4a453d', 800: '#2e2a25', 900: '#221f1b', 950: '#14110f',
        },
        primary: {
          color: '#cc1b12',
          contrastColor: '#ffffff',
          hoverColor: '{red.600}',
          activeColor: '{red.700}',
        },
        content: { background: '#efe7d4', borderColor: '#14110f' },
        text: { color: '#14110f', mutedColor: '#6b6358' },
        formField: {
          background: '#efe7d4',
          borderColor: '#14110f',
          hoverBorderColor: '#14110f',
          focusBorderColor: '#cc1b12',
          color: '#14110f',
          placeholderColor: '#6b6358',
        },
      },
      dark: {
        surface: {
          0: '#171512', 50: '#171512', 100: '#221f1b', 200: '#2e2a25',
          300: '#3a342a', 400: '#554c39', 500: '#6b6358', 600: '#a2957a',
          700: '#c9b98f', 800: '#e8dcc0', 900: '#efe7d4', 950: '#f7f1e4',
        },
        primary: {
          color: '#ff6a4d',              // #cc1b12 drops to 3.3:1 on the dark ground
          contrastColor: '#171512',
          hoverColor: '{red.300}',
          activeColor: '{red.200}',
        },
        content: { background: '#221f1b', borderColor: 'rgba(247,241,228,0.75)' },
        text: { color: '#f7f1e4', mutedColor: 'rgba(247,241,228,0.66)' },
        formField: {
          background: '#221f1b',
          borderColor: 'rgba(247,241,228,0.75)',
          hoverBorderColor: '#f7f1e4',
          focusBorderColor: '#ff6a4d',
          color: '#f7f1e4',
          placeholderColor: 'rgba(247,241,228,0.5)',
        },
      },
    },
  },

  components: {
    button: {
      root: {
        borderRadius: '0',
        borderWidth: '2px',
        paddingX: '18px',
        paddingY: '12px',
        // 44px minimum touch target, both densities
        sm: { paddingX: '14px', paddingY: '10px' },
        label: { fontWeight: '600' },
        focusRing: { width: '3px', offset: '2px' },
      },
    },
    tag: { root: { borderRadius: '0', fontSize: '13px', padding: '2px 9px' } },
    card: { root: { borderRadius: '0', shadow: 'none' } },
    dialog: { root: { borderRadius: '0', shadow: 'none', borderWidth: '3px' } },
    drawer: { root: { borderRadius: '0', shadow: 'none', borderWidth: '3px' } },
    toast: { root: { borderRadius: '0', borderWidth: '0 0 0 4px', shadow: 'none' } },
    inputtext: { root: { borderRadius: '0', borderWidth: '2px' } },
    selectbutton: { root: { borderRadius: '0' } },
    menu: { root: { borderRadius: '0', borderWidth: '2px', shadow: 'none' } },
    datatable: {
      headerCell: { borderColor: '#14110f' },
      bodyCell: { borderColor: 'rgba(20,17,15,0.22)' },
    },
    tooltip: { root: { borderRadius: '0' } },
  },
} as never);

/**
 * Pipeline stage presentation. Colour never carries meaning alone — the Hebrew label
 * always ships with it, and the ramp reads in greyscale: paper → tan → deep tan → ink → red,
 * with Lost hatched rather than tinted.
 */
export const LEAD_STATUS_STYLE = {
  new:           { order: 1, bg: 'transparent',  fg: '#14110f', border: '#14110f' },
  contacted:     { order: 2, bg: '#e8dcc0',      fg: '#14110f', border: '#14110f' },
  qualified:     { order: 3, bg: '#c9b98f',      fg: '#14110f', border: '#14110f' },
  proposal_sent: { order: 4, bg: '#14110f',      fg: '#f7f1e4', border: '#14110f' },
  won:           { order: 5, bg: '#cc1b12',      fg: '#ffffff', border: '#cc1b12' },
  lost:          { order: 6, bg: 'hatch',        fg: '#6b6358', border: '#6b6358' },
} as const;

/** Chart.js palette — the paper ramp for pipeline stages, red for outcomes. */
export const CHART_PALETTE = ['#f7f1e4', '#e8dcc0', '#c9b98f', '#14110f', '#cc1b12', '#a2957a'];
