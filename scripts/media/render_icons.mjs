// Renders the "G bolt" brand mark (a bold G whose crossbar is a lightning bolt) to every
// icon asset Expo needs, via headless Edge. Output: scripts/media/out/icons; copy into assets/.
//
// Usage: node scripts/media/render_icons.mjs [--install]   (--install copies into assets/)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const OUT = path.join(DIR, 'out', 'icons');
const ASSETS = path.join(DIR, '..', '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const INK = '#FFFFFF';
const BOLT = '#FF9F0A';
const BG = '#0A0A0B'; // matches app.json splash/adaptive background

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [512 + r * Math.cos(rad(deg)), 512 + r * Math.sin(rad(deg))];

/** Mark drawn on a 1024 canvas, centered; outer diameter ~572px at scale 1. */
function mark({ ink = INK, bolt = BOLT, scale = 1 } = {}) {
  const r = 230;
  const [sx, sy] = pt(r, -40);
  const [ex, ey] = pt(r, 20);
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M ${sx} ${sy} A ${r} ${r} 0 1 0 ${ex} ${ey}" fill="none" stroke="${ink}" stroke-width="112" stroke-linecap="round"/>
    <polygon points="740,470 600,470 660,380 480,540 610,540 540,640" fill="${bolt}" stroke="${bolt}" stroke-width="10" stroke-linejoin="round"/>
  </g>`;
}

const VARIANTS = {
  // iOS / store icon: full-bleed square, the OS applies the mask.
  icon: { size: 1024, body: `<rect width="1024" height="1024" fill="${BG}"/>${mark({ scale: 1.08 })}` },
  'android-icon-background': { size: 1024, body: `<rect width="1024" height="1024" fill="${BG}"/>` },
  // Adaptive foreground: ~60% of the visible 72dp area, well inside the 66dp safe circle.
  'android-icon-foreground': { size: 1024, body: mark({ scale: 0.72 }) },
  // Themed icons (Android 13+): one flat color, the launcher tints it.
  'android-icon-monochrome': { size: 1024, body: mark({ ink: '#FFFFFF', bolt: '#FFFFFF', scale: 0.72 }) },
  'splash-icon': { size: 1024, body: mark({ scale: 0.9 }) },
  // Small tile next to the "GymBro" wordmark on the welcome screen.
  'brand-mark': { size: 256, body: `<rect x="32" y="32" width="960" height="960" rx="230" fill="${BG}"/>${mark({ scale: 1.2 })}` },
  // Android status bar: white silhouette on transparent (the system tints it).
  'notification-icon': { size: 96, body: mark({ ink: '#FFFFFF', bolt: '#FFFFFF', scale: 1.5 }) },
};

for (const [name, { size, body }] of Object.entries(VARIANTS)) {
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg></body></html>`;
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, html);
  const png = path.join(OUT, `${name}.png`);
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${size},${size}`, `--screenshot=${png}`, `file:///${file.split(path.sep).join('/')}`], { stdio: 'ignore' });
  if (process.argv.includes('--install')) fs.copyFileSync(png, path.join(ASSETS, `${name}.png`));
  console.log('rendered', name, size);
}
