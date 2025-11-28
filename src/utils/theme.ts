/**
 * CS Trading Hub - Elmo Theme System
 * 
 * This theme system uses Elmo naming conventions for consistency
 * with Figma exports while maintaining CS2 gaming aesthetic.
 */

// Color Scheme - Elmo Structure
export const colorScheme = {
  // Primary Colors
  primary: 'var(--elmo-primary)',
  primaryBright: 'var(--elmo-primary-bright)',
  primaryDim: 'var(--elmo-primary-dim)',
  onPrimary: 'var(--elmo-on-primary)',
  
  // Secondary Colors
  secondary: 'var(--elmo-secondary)',
  secondaryBright: 'var(--elmo-secondary-bright)',
  secondaryDim: 'var(--elmo-secondary-dim)',
  onSecondary: 'var(--elmo-on-secondary)',
  
  // Tertiary Colors
  tertiary: 'var(--elmo-tertiary)',
  onTertiary: 'var(--elmo-on-tertiary)',
  
  // Background Colors
  background: 'var(--elmo-background)',
  onBackground: 'var(--elmo-on-background)',
  
  // Surface Colors
  surface: 'var(--elmo-surface)',
  surfaceVariant: 'var(--elmo-surface-variant)',
  surfaceDialog: 'var(--elmo-surface-dialog)',
  onSurface: 'var(--elmo-on-surface)',
  onSurfaceVariant: 'var(--elmo-on-surface-variant)',
  
  // Semantic Colors
  error: 'var(--elmo-error)',
  onError: 'var(--elmo-on-error)',
  success: 'var(--elmo-success)',
  onSuccess: 'var(--elmo-on-success)',
  warning: 'var(--elmo-warning)',
  onWarning: 'var(--elmo-on-warning)',
  
  // Utility Colors
  outline: 'var(--elmo-outline)',
  outlineVariant: 'var(--elmo-outline-variant)',
  scrim: 'var(--elmo-scrim)',
  
  // CS2 Rarity Colors (special case)
  rarityConsumer: 'var(--elmo-rarity-consumer)',
  rarityIndustrial: 'var(--elmo-rarity-industrial)',
  rarityMilspec: 'var(--elmo-rarity-milspec)',
  rarityRestricted: 'var(--elmo-rarity-restricted)',
  rarityClassified: 'var(--elmo-rarity-classified)',
  rarityCovert: 'var(--elmo-rarity-covert)',
  rarityGold: 'var(--elmo-rarity-gold)',
} as const;

// Gradient Brushes - Elmo Structure
export const gradients = {
  backgroundGradient: 'linear-gradient(135deg, var(--elmo-background) 0%, var(--elmo-surface) 100%)',
  surfaceGradient: 'linear-gradient(180deg, var(--elmo-surface) 0%, var(--elmo-background) 100%)',
  surfaceDialogGradient: 'linear-gradient(135deg, var(--elmo-surface-dialog) 0%, var(--elmo-surface) 100%)',
  primaryGradient: 'linear-gradient(90deg, var(--elmo-primary) 0%, var(--elmo-primary-bright) 100%)',
  secondaryGradient: 'linear-gradient(45deg, var(--elmo-secondary) 0%, var(--elmo-primary) 100%)',
} as const;

// Typography - Elmo Structure
export const typography = {
  // Display styles (Hero text, splash screens)
  displaySmall: 'var(--elmo-typography-display-small)',
  displaySmallEmphasized: 'var(--elmo-typography-display-small-emphasized)',
  displayMedium: 'var(--elmo-typography-display-medium)',
  displayMediumEmphasized: 'var(--elmo-typography-display-medium-emphasized)',
  displayLarge: 'var(--elmo-typography-display-large)',
  displayLargeEmphasized: 'var(--elmo-typography-display-large-emphasized)',
  
  // Headline styles (Section titles, page headers)
  headlineSmall: 'var(--elmo-typography-headline-small)',
  headlineSmallEmphasized: 'var(--elmo-typography-headline-small-emphasized)',
  headlineMedium: 'var(--elmo-typography-headline-medium)',
  headlineMediumEmphasized: 'var(--elmo-typography-headline-medium-emphasized)',
  headlineLarge: 'var(--elmo-typography-headline-large)',
  headlineLargeEmphasized: 'var(--elmo-typography-headline-large-emphasized)',
  
  // Title styles (Card headers, list section headers)
  titleSmall: 'var(--elmo-typography-title-small)',
  titleSmallEmphasized: 'var(--elmo-typography-title-small-emphasized)',
  titleMedium: 'var(--elmo-typography-title-medium)',
  titleMediumEmphasized: 'var(--elmo-typography-title-medium-emphasized)',
  titleLarge: 'var(--elmo-typography-title-large)',
  titleLargeEmphasized: 'var(--elmo-typography-title-large-emphasized)',
  
  // Label styles (Buttons, tabs, form labels)
  labelSmall: 'var(--elmo-typography-label-small)',
  labelSmallEmphasized: 'var(--elmo-typography-label-small-emphasized)',
  labelMedium: 'var(--elmo-typography-label-medium)',
  labelMediumEmphasized: 'var(--elmo-typography-label-medium-emphasized)',
  labelLarge: 'var(--elmo-typography-label-large)',
  labelLargeEmphasized: 'var(--elmo-typography-label-large-emphasized)',
  
  // Body styles (Content text, descriptions)
  bodySmall: 'var(--elmo-typography-body-small)',
  bodySmallEmphasized: 'var(--elmo-typography-body-small-emphasized)',
  bodyMedium: 'var(--elmo-typography-body-medium)',
  bodyMediumEmphasized: 'var(--elmo-typography-body-medium-emphasized)',
  bodyLarge: 'var(--elmo-typography-body-large)',
  bodyLargeEmphasized: 'var(--elmo-typography-body-large-emphasized)',
} as const;

// Spacing - Elmo Structure (8dp grid)
export const spacing = {
  micro: '0.25rem',    // 4px
  xs: '0.5rem',        // 8px
  sm: '1rem',          // 16px
  md: '1.5rem',        // 24px
  lg: '2rem',          // 32px
  xl: '2.5rem',        // 40px
  xxl: '3rem',         // 48px
  xxxl: '4rem',        // 64px
  massive: '5rem',     // 80px
} as const;

// Elevation - Elmo Structure
export const elevation = {
  level0: '0',
  level1: '0 1px 2px rgba(0,0,0,0.3)',
  level2: '0 2px 4px rgba(0,0,0,0.3)',
  level3: '0 4px 6px rgba(0,0,0,0.4)',
  level6: '0 6px 10px rgba(0,0,0,0.4)',
  level8: '0 10px 15px rgba(0,0,0,0.5)',
  level12: '0 12px 20px rgba(0,0,0,0.5)',
  level16: '0 20px 25px rgba(0,0,0,0.6)',
} as const;

// Corner Radius - Elmo Structure
export const cornerRadius = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  xxl: '2rem',      // 32px
  full: '9999px',   // Fully rounded
} as const;

// Animation Durations - Elmo Structure
export const duration = {
  instant: 50,
  quick: 100,
  short: 200,
  medium: 300,
  long: 400,
  extraLong: 500,
} as const;

// Complete Theme Export
export const ElmoTheme = {
  colorScheme,
  gradients,
  typography,
  spacing,
  elevation,
  cornerRadius,
  duration,
} as const;

// Type exports for TypeScript
export type ColorScheme = typeof colorScheme;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
