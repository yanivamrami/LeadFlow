import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

/**
 * LeadFlow — PrimeNG 20 preset.
 * Modernist base: mono red on a light ground, zero radius, strong rules.
 * Mirrors client/src/theme/tokens.css and docs/DESIGN-SYSTEM.md — change both together.
 *
 * providePrimeNG({ theme: { preset: LeadFlowPreset,
 *   options: { darkModeSelector: '[data-theme="dark"]' } } })
 */
export const LeadFlowPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0',
    },
    // accent ramp — the single colour role in the system
    accent: {
      50: '#fff2ef', 100: '#fff2ef', 200: '#ffe0d9', 300: '#ffc4b8',
      400: '#ff9783', 500: '#ff563c', 600: '#dd2b0f', 700: '#ae1800',
      800: '#7c1405', 900: '#4d170e', 950: '#4d170e',
    },
    // neutral ramp — carries pipeline progression
    ink: {
      50: '#f8f4f4', 100: '#f8f4f4', 200: '#eae7e7', 300: '#d7d3d3',
      400: '#bab6b6', 500: '#9b9797', 600: '#7d7979', 700: '#605d5d',
      800: '#444141', 900: '#2d2b2b', 950: '#201e1d',
    },
  },

  semantic: {
    primary: {
      50: '{accent.50}', 100: '{accent.100}', 200: '{accent.200}',
      300: '{accent.300}', 400: '{accent.400}', 500: '{accent.500}',
      600: '{accent.600}', 700: '{accent.700}', 800: '{accent.800}',
      900: '{accent.900}', 950: '{accent.950}',
    },
    borderRadius: { none: '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0' },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.color}',
      offset: '2px',
      shadow: 'none',
    },
    formField: {
      paddingX: '12px',
      paddingY: '10px',
      borderRadius: '0',
      focusRing: { width: '2px', style: 'solid', color: '{primary.color}', offset: '0' },
    },
    transitionDuration: '120ms',

    colorScheme: {
      light: {
        surface: {
          0: '#ffffff', 50: '#f8f4f4', 100: '#f3f2f2', 200: '#eae9e9',
          300: '#d7d3d3', 400: '#bab6b6', 500: '#9b9797', 600: '#7d7979',
          700: '#605d5d', 800: '#444141', 900: '#2d2b2b', 950: '#201e1d',
        },
        primary: {
          color: '#ec3013',
          contrastColor: '#f3f2f2',
          hoverColor: '{accent.600}',
          activeColor: '{accent.700}',
        },
        content: { background: '#eae9e9', borderColor: 'rgba(32,30,29,0.40)' },
        text: { color: '#201e1d', mutedColor: '#605d5d' },
        formField: {
          background: '#eae9e9',
          borderColor: 'rgba(32,30,29,0.40)',
          hoverBorderColor: 'rgba(32,30,29,0.60)',
          focusBorderColor: '#ec3013',
          color: '#201e1d',
          placeholderColor: '#9b9797',
        },
      },
      dark: {
        surface: {
          0: '#1a1918', 50: '#1a1918', 100: '#262423', 200: '#302d2c',
          300: '#3a3736', 400: '#4a4645', 500: '#605d5d', 600: '#7d7979',
          700: '#9b9797', 800: '#bab6b6', 900: '#d7d3d3', 950: '#f3f2f2',
        },
        primary: {
          color: '#ff563c',              // accent-500: #ec3013 drops below 3:1 on dark
          contrastColor: '#1a1918',
          hoverColor: '{accent.400}',
          activeColor: '{accent.300}',
        },
        content: { background: '#262423', borderColor: 'rgba(243,242,242,0.35)' },
        text: { color: '#f3f2f2', mutedColor: 'rgba(243,242,242,0.65)' },
        formField: {
          background: '#262423',
          borderColor: 'rgba(243,242,242,0.35)',
          hoverBorderColor: 'rgba(243,242,242,0.55)',
          focusBorderColor: '#ff563c',
          color: '#f3f2f2',
          placeholderColor: 'rgba(243,242,242,0.45)',
        },
      },
    },
  },

  components: {
    button: {
      root: {
        borderRadius: '0',
        paddingX: '18px',
        paddingY: '11px',
        // 44px minimum touch target, both densities
        sm: { paddingX: '14px', paddingY: '9px' },
        label: { fontWeight: '500' },
        focusRing: { width: '2px', offset: '2px' },
      },
    },
    tag: { root: { borderRadius: '0', fontSize: '12px', padding: '4px 10px' } },
    card: { root: { borderRadius: '0', shadow: 'none' } },
    dialog: { root: { borderRadius: '0' } },
    drawer: { root: { borderRadius: '0' } },
    toast: { root: { borderRadius: '0', borderWidth: '0 0 0 2px' } },
    inputtext: { root: { borderRadius: '0' } },
    selectbutton: { root: { borderRadius: '0' } },
    datatable: {
      headerCell: { borderColor: 'rgba(32,30,29,0.40)' },
      bodyCell: { borderColor: 'rgba(32,30,29,0.25)' },
    },
    tooltip: { root: { borderRadius: '0' } },
  },
});

/** Pipeline stage presentation. Colour never carries meaning alone — the label always ships with it. */
export const LEAD_STATUS_STYLE = {
  new:           { order: 1, rule: '2px',        ruleColor: '#9b9797', bg: '#eae7e7',     fg: '#605d5d' },
  contacted:     { order: 2, rule: '3px',        ruleColor: '#7d7979', bg: '#d7d3d3',     fg: '#444141' },
  qualified:     { order: 3, rule: '4px',        ruleColor: '#605d5d', bg: '#bab6b6',     fg: '#2d2b2b' },
  proposal_sent: { order: 4, rule: '5px',        ruleColor: '#444141', bg: '#7d7979',     fg: '#f8f4f4' },
  won:           { order: 5, rule: '6px',        ruleColor: '#ec3013', bg: '#ec3013',     fg: '#f3f2f2' },
  lost:          { order: 6, rule: '2px dashed', ruleColor: '#9b9797', bg: 'transparent', fg: '#605d5d', border: '#9b9797' },
} as const;

/** Chart.js palette — neutral ramp for the pipeline, accent for outcomes. */
export const CHART_PALETTE = ['#eae7e7', '#d7d3d3', '#bab6b6', '#7d7979', '#ec3013', '#9b9797'];
