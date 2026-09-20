export type IconName = 'folder' | 'learn' | 'help' | 'file' | 'target' | 'book' | 'upload' | 'edit' | 'arrow' | 'back' | 'plus' | 'close' | 'clock' | 'user' | 'sun' | 'moon' | 'refresh' | 'fit' | 'tree' | 'check' | 'download' | 'trash';
const paths: Record<IconName, string> = {
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  folder: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7h18',
  learn: 'M2 8l10-5 10 5-10 5L2 8m4 2v7c4 3 8 3 12 0v-7m4-2v9',
  help: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  file: 'M14 2H5v20h14V7l-5-5v5h5M8 11h8M8 15h8M8 18h5',
  target: 'M20 11a8 8 0 1 1-7-7m3 7a4 4 0 1 1-5-3m1 4 9-9m-5 0h5v5',
  book: 'M12 5v16m0-16C9 2 4 2 2 4v16c3-2 7-2 10 1 3-3 7-3 10-1V4c-2-2-7-2-10 1',
  upload: 'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6',
  edit: 'm15 4 5 5M4 16 16 4a2 2 0 0 1 4 4L8 20l-5 1 1-5',
  arrow: 'M3 12h18m-7-7 7 7-7 7', back: 'M21 12H3m7-7-7 7 7 7',
  plus: 'M12 3v18M3 12h18', close: 'm6 6 12 12M6 18 18 6',
  clock: 'M12 6v6l4 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  user: 'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M5 21v-2a7 7 0 0 1 14 0v2',
  sun: 'M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10',
  refresh: 'M3 10a9 9 0 0 1 16-5l2 2m0-5v5h-5M21 14A9 9 0 0 1 5 19l-2-2m0 5v-5h5',
  fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6',
  tree: 'M12 8v4m0 0-7 4m7-4 7 4M9 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0M2 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0m14 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  check: 'm5 12 4 4L19 6', download: 'M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4',
};

export function Icon({name, size = 22}: {name: IconName; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Brand({onClick}: {onClick?(): void}) {
  return <button className="brand" onClick={onClick} type="button" aria-label="ResViz home">Res<span>Viz</span></button>;
}
