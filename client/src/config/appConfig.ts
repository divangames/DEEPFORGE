export const APP_CONFIG = {
  gameName: 'DEEPFORGE: Idle Empire',
  saveSchemaVersion: 2,
  apiBaseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  mobileMinWidth: 360,
  targetFpsHigh: 60,
  targetFpsLow: 30,
  githubPagesBase: '/DEEPFORGE/',
} as const;
