import type { CSSProperties } from 'react';

const paths = {
  mine: 'M3 21l6-6m-3-9 12 12M4 8l4-4c4-2 8-1 12 3l-7-1-7 7z',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75',
  research: 'M9 3h6m-5 0v7l-6 9a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-9V3M8 15h8',
  events: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 11 2 2 4-4',
  lift: 'M9 3 5 7m0 0 4 4M5 7v14M15 21l4-4m0 0-4-4m4 4V3',
  hub: 'M3 8h11v11H3V8Zm11 4h4l3 4v3h-7M7 19v2m10-2v2M3 4h8',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  back: 'm15 18-6-6 6-6',
  up: 'm5 12 7-7 7 7M12 5v15',
  play: 'm8 5 11 7-11 7V5Z',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 17v-5m0-5v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  diamond: 'm12 2 9 10-9 10-9-10 9-10Z',
  lock: 'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4',
  trophy: 'M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v5m-4 2h8',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name]} /></svg>;
}
