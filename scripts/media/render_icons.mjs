// Renders the "G plate" brand mark (a weight plate shaped as the G of GymBro) to every
// icon asset Expo needs, via headless Edge. Output: scripts/media/out/icons; copy into assets/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1');
const OUT = path.join(DIR, 'out', 'icons');
fs.mkdirSync(OUT, { recursive: true });
const AMBER = '<linearGradient id="amber" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1024" y2="1024"><stop offset="0" stop-color="#FFB340"/><stop offset="1" stop-color="#FF7A00"/></linearGradient>';
const pt = (r, deg) => [512 + r * Math.cos((deg * Math.PI) / 180), 512 + r * Math.sin((deg * Math.PI) / 180)];
const INK = '#1A0F00';

// "G plate" brand mark: a weight plate shaped as the G of GymBro.
function mark(ink, hole, scale = 1) {
  const r = 240, w = 124, outer = r + w / 2, barH = 92;
  const [sx, sy] = pt(r, -40);
  const [ex, ey] = pt(r, 0);
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <path d="M ${sx} ${sy} A ${r} ${r} 0 1 0 ${ex} ${ey}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="butt"/>
    <circle cx="${sx}" cy="${sy}" r="${w / 2}" fill="${ink}"/>
    <rect x="566" y="${512 - barH}" width="${512 + outer - 566}" height="${barH}" fill="${ink}"/>
    <rect x="566" y="${512 - barH}" width="${barH * 0.9}" height="${barH}" rx="${barH / 2}" fill="${ink}"/>
    <circle cx="512" cy="512" r="74" fill="${ink}"/>
    ${hole ? `<circle cx="512" cy="512" r="28" fill="${hole}"/>` : ''}
  </g>`;
}
const tile = (scale) => `<rect x="${512 - 400 * scale}" y="${512 - 400 * scale}" width="${800 * scale}" height="${800 * scale}" rx="${200 * scale}" fill="url(#amber)"/>`;

const V = {
  icon: `<defs>${AMBER}</defs><rect width="1024" height="1024" fill="url(#amber)"/>${mark(INK, '#FF9A1F')}`,
  'android-icon-background': `<defs>${AMBER}</defs><rect width="1024" height="1024" fill="url(#amber)"/>`,
  // Adaptive foreground must sit inside the 66% safe circle.
  'android-icon-foreground': mark(INK, '#FF9A1F', 0.82),
  'android-icon-monochrome': `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><circle cx="512" cy="512" r="${28 * 0.82}" fill="black"/></mask><g mask="url(#m)">${mark('#FFFFFF', null, 0.82)}</g>`,
  'splash-icon': `<defs>${AMBER}</defs>${tile(1)}${mark(INK, '#FF9A1F', 0.68)}`,
  'brand-mark': `<defs>${AMBER}</defs>${tile(1.28)}${mark(INK, '#FF9A1F', 0.86)}`,
};
for (const [name, body] of Object.entries(V)) {
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg></body></html>`;
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, html);
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', '--window-size=1024,1024', `--screenshot=${path.join(OUT, `${name}.png`)}`, `file:///${file.split(path.sep).join('/')}`], { stdio: 'ignore' });
  console.log('rendered', name);
}
