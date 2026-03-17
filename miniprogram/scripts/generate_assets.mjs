import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(process.cwd(), 'miniprogram');
const iconDir = path.join(rootDir, 'assets/icons');
const avatarDir = path.join(rootDir, 'assets/avatars');
const illustrationDir = path.join(rootDir, 'assets/illustrations');
const iconMapFile = path.join(rootDir, 'components/icon/asset-map.js');

const toneColors = {
  dark: '#2D3436',
  green: '#67B88B',
  white: '#FFFFFF',
  blue: '#5B8DEF',
  purple: '#8B6DFF',
  red: '#E15B64',
};

const iconDefs = {
  'message-circle': ['<path d="M21 11.5C21 16.194 16.97 20 12 20c-1.224 0-2.39-.223-3.45-.628L4 21l1.78-4.16C5.283 15.45 5 14.009 5 12.5 5 7.806 9.03 4 14 4s7 3.806 7 7.5Z"/>', '<path d="M9 11h6"/>', '<path d="M9 14h4"/>'],
  'layout-dashboard': ['<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>', '<rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5"/>', '<rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/>', '<rect x="3.5" y="12.5" width="7" height="8" rx="1.5"/>'],
  'search': ['<circle cx="11" cy="11" r="6.5"/>', '<path d="m16 16 4.5 4.5"/>'],
  'user': ['<path d="M20 20c0-3.314-3.582-6-8-6s-8 2.686-8 6"/>', '<circle cx="12" cy="8" r="4"/>'],
  'plus': ['<path d="M12 5v14"/>', '<path d="M5 12h14"/>'],
  'chevron-left': ['<path d="m14.5 6-6 6 6 6"/>'],
  'chevron-right': ['<path d="m9.5 6 6 6-6 6"/>'],
  'more-horizontal': ['<circle cx="6" cy="12" r="1.4"/>', '<circle cx="12" cy="12" r="1.4"/>', '<circle cx="18" cy="12" r="1.4"/>'],
  'smile': ['<circle cx="12" cy="12" r="8.5"/>', '<path d="M9 14.5c.8 1.1 1.9 1.5 3 1.5s2.2-.4 3-1.5"/>', '<circle cx="9.2" cy="10.1" r="1"/>', '<circle cx="14.8" cy="10.1" r="1"/>'],
  'mic': ['<path d="M12 3.5a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0v-4a3 3 0 0 1 3-3Z"/>', '<path d="M6 10.5a6 6 0 0 0 12 0"/>', '<path d="M12 17v3.5"/>'],
  'send': ['<path d="M4 20 20 12 4 4l3 8-3 8Z"/>'],
  'code': ['<path d="m9 7-5 5 5 5"/>', '<path d="m15 7 5 5-5 5"/>'],
  'file-text': ['<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9Z"/>', '<path d="M14 3.5V9h5.5"/>', '<path d="M8 13h8"/>', '<path d="M8 16.5h6"/>'],
  'zap': ['<path d="M13 2.5 5 13h5l-1 8.5L19 11h-5l-1-8.5Z"/>'],
  'smile-plus': ['<circle cx="10.5" cy="11" r="6.5"/>', '<path d="M8.2 13.2c.8 1 1.7 1.3 2.8 1.3 1 0 2-.4 2.8-1.3"/>', '<circle cx="8.4" cy="9.7" r=".9"/>', '<circle cx="12.6" cy="9.7" r=".9"/>', '<path d="M18 7v6"/>', '<path d="M15 10h6"/>'],
  'activity': ['<path d="M3.5 12h4l2-5 4 10 2-5h5"/>'],
  'cpu': ['<rect x="7" y="7" width="10" height="10" rx="2"/>', '<path d="M9.5 1.5v3"/>', '<path d="M14.5 1.5v3"/>', '<path d="M9.5 19.5v3"/>', '<path d="M14.5 19.5v3"/>', '<path d="M1.5 9.5h3"/>', '<path d="M1.5 14.5h3"/>', '<path d="M19.5 9.5h3"/>', '<path d="M19.5 14.5h3"/>'],
  'database': ['<ellipse cx="12" cy="6" rx="6.5" ry="3"/>', '<path d="M5.5 6v5c0 1.65 2.91 3 6.5 3s6.5-1.35 6.5-3V6"/>', '<path d="M5.5 11v5c0 1.65 2.91 3 6.5 3s6.5-1.35 6.5-3v-5"/>'],
  'server': ['<rect x="4.5" y="4.5" width="15" height="6" rx="2"/>', '<rect x="4.5" y="13.5" width="15" height="6" rx="2"/>', '<path d="M8 7.5h.01"/>', '<path d="M8 16.5h.01"/>'],
  'clock': ['<circle cx="12" cy="12" r="8.5"/>', '<path d="M12 7.5v5l3 2"/>'],
  'arrow-right': ['<path d="M5 12h14"/>', '<path d="m13 6 6 6-6 6"/>'],
  'github': ['<path d="M9 18.5c-4 1.2-4-2-5.5-2.5"/>', '<path d="M20.5 16v-3a5.2 5.2 0 0 0-1.4-3.5c.2-.6.6-2.4-.2-4-.1-.2-.2-.2-.3-.2-.5 0-1.7.2-3.6 1.5a12 12 0 0 0-6 0C7.1 5.5 5.9 5.3 5.4 5.3c-.1 0-.2 0-.3.2-.8 1.6-.4 3.4-.2 4A5.2 5.2 0 0 0 3.5 13v3a5 5 0 0 0 5 5h7a5 5 0 0 0 5-5Z"/>'],
  'mail': ['<rect x="4" y="5.5" width="16" height="13" rx="2"/>', '<path d="m5.5 7 6.5 5 6.5-5"/>'],
  'settings': ['<circle cx="12" cy="12" r="3"/>', '<path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 1.64V21a2 2 0 1 1-4 0v-.08A1.8 1.8 0 0 0 9 19.4a1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15c0-.4-.13-.79-.38-1.1A1.8 1.8 0 0 0 3 13H3a2 2 0 1 1 0-4h.08A1.8 1.8 0 0 0 4.6 9c.1-.39.1-.81 0-1.2a1.8 1.8 0 0 0-.41-.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 9 4.6c.4 0 .79-.13 1.1-.38A1.8 1.8 0 0 0 11 3V3a2 2 0 1 1 4 0v.08A1.8 1.8 0 0 0 15 4.6c.39.1.81.1 1.2 0 .3-.08.56-.22.77-.41l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.4 9c0 .4.13.79.38 1.1.28.34.7.55 1.18.55H21a2 2 0 1 1 0 4h-.08c-.48 0-.9.21-1.18.55-.25.31-.38.7-.38 1.1Z"/>'],
  'moon': ['<path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6.5 6.5 0 1 0 20 14.5Z"/>'],
  'hard-drive': ['<rect x="4" y="6" width="16" height="12" rx="2"/>', '<path d="M8 16h.01"/>', '<path d="M12 16h.01"/>'],
  'credit-card': ['<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/>', '<path d="M3.5 10.5h17"/>', '<path d="M8 15.5h4"/>'],
  'bell': ['<path d="M6.5 16.5h11l-1.3-2.1a3.4 3.4 0 0 1-.5-1.8V10a3.7 3.7 0 1 0-7.4 0v2.6c0 .64-.18 1.28-.5 1.82Z"/>', '<path d="M9.5 18.5a2.5 2.5 0 0 0 5 0"/>'],
  'smartphone': ['<rect x="7.5" y="2.5" width="9" height="19" rx="2"/>', '<path d="M11 18h2"/>'],
  'log-out': ['<path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/>', '<path d="M14 16l4-4-4-4"/>', '<path d="M18 12H9"/>'],
  'save': ['<path d="M5 4.5h11l3 3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19Z"/>', '<path d="M8 4.5v5h7v-5"/>', '<path d="M8 20.5v-6h8v6"/>'],
  'sliders': ['<path d="M4 7h8"/>', '<path d="M16 7h4"/>', '<circle cx="14" cy="7" r="2"/>', '<path d="M4 17h4"/>', '<path d="M12 17h8"/>', '<circle cx="10" cy="17" r="2"/>'],
  'command': ['<path d="M8 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm13-7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"/>', '<path d="M8 8.5h8v7H8Z"/>'],
  'message-square': ['<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H10l-4 3v-3H6.5A2.5 2.5 0 0 1 4 14.5Z"/>'],
};

const usageManifest = {
  'message-circle': ['dark', 'green'],
  'layout-dashboard': ['dark', 'green'],
  'search': ['dark', 'green'],
  'user': ['dark', 'green'],
  'plus': ['green'],
  'chevron-left': ['dark'],
  'chevron-right': ['dark'],
  'more-horizontal': ['dark'],
  'smile': ['dark', 'green'],
  'mic': ['dark'],
  'send': ['white'],
  'code': ['green'],
  'file-text': ['dark', 'green', 'blue'],
  'zap': ['green'],
  'smile-plus': ['dark'],
  'activity': ['green'],
  'cpu': ['green'],
  'database': ['green'],
  'server': ['green'],
  'clock': ['dark'],
  'arrow-right': ['white', 'dark'],
  'github': ['dark'],
  'mail': ['dark'],
  'settings': ['dark'],
  'moon': ['dark'],
  'hard-drive': ['dark'],
  'credit-card': ['white'],
  'bell': ['dark'],
  'smartphone': ['dark'],
  'log-out': ['red'],
  'save': ['white'],
  'sliders': ['dark'],
  'command': ['purple'],
  'message-square': ['green'],
};

const avatars = [
  { name: 'alex', label: 'A', start: '#67B88B', end: '#4A9A70' },
  { name: 'sarah', label: 'S', start: '#7BB7FF', end: '#5B8DEF' },
  { name: 'marcus', label: 'M', start: '#FFB76B', end: '#F59E0B' },
  { name: 'claude', label: 'C', start: '#78D1C0', end: '#48A892' },
  { name: 'alpha', label: 'PA', start: '#A08CFF', end: '#7B68EE' },
  { name: 'gpt', label: 'G', start: '#4DA7FF', end: '#2578D7' },
  { name: 'ui', label: 'UI', start: '#FF9F9F', end: '#E15B64' },
];

function iconSvg(parts, stroke) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">\n${parts.join('\n')}\n</svg>\n`;
}

function avatarSvg(label, start, end) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n  <defs>\n    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" stop-color="${start}"/>\n      <stop offset="100%" stop-color="${end}"/>\n    </linearGradient>\n  </defs>\n  <rect width="200" height="200" rx="100" fill="url(#bg)"/>\n  <circle cx="100" cy="82" r="34" fill="rgba(255,255,255,0.18)"/>\n  <path d="M46 166c8-28 30-44 54-44s46 16 54 44" fill="rgba(255,255,255,0.18)"/>\n  <text x="100" y="116" font-size="54" font-family="SF Pro Display, PingFang SC, sans-serif" fill="#FFFFFF" text-anchor="middle" font-weight="700">${label}</text>\n</svg>\n`;
}

function onboardingHeroSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560">\n  <defs>\n    <linearGradient id="a" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" stop-color="#E8F7EF"/>\n      <stop offset="100%" stop-color="#D5EEE3"/>\n    </linearGradient>\n    <linearGradient id="b" x1="10%" y1="10%" x2="100%" y2="90%">\n      <stop offset="0%" stop-color="#67B88B"/>\n      <stop offset="100%" stop-color="#4A9A70"/>\n    </linearGradient>\n    <linearGradient id="c" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" stop-color="#8FD9B0"/>\n      <stop offset="100%" stop-color="#66A989"/>\n    </linearGradient>\n  </defs>\n  <rect width="560" height="560" rx="88" fill="url(#a)"/>\n  <circle cx="160" cy="164" r="120" fill="rgba(255,255,255,0.55)"/>\n  <circle cx="406" cy="164" r="84" fill="rgba(255,255,255,0.38)"/>\n  <rect x="128" y="124" width="306" height="240" rx="48" fill="url(#b)" opacity="0.96"/>\n  <rect x="164" y="160" width="234" height="36" rx="18" fill="rgba(255,255,255,0.18)"/>\n  <rect x="164" y="220" width="170" height="28" rx="14" fill="rgba(255,255,255,0.18)"/>\n  <rect x="164" y="270" width="204" height="28" rx="14" fill="rgba(255,255,255,0.18)"/>\n  <path d="M252 90c14 26 20 49 20 70" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" opacity="0.64"/>\n  <path d="M310 102c-10 22-14 40-14 58" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" opacity="0.48"/>\n  <circle cx="420" cy="402" r="70" fill="url(#c)"/>\n  <circle cx="152" cy="410" r="54" fill="rgba(255,255,255,0.42)"/>\n  <rect x="122" y="386" width="262" height="74" rx="37" fill="rgba(255,255,255,0.72)"/>\n  <text x="153" y="432" font-size="40" font-family="SF Pro Display, PingFang SC, sans-serif" fill="#2D3436" font-weight="700">OpenClaw</text>\n  <circle cx="430" cy="402" r="30" fill="rgba(255,255,255,0.82)"/>\n  <path d="M430 384v36M439 389h-18" stroke="#4A9A70" stroke-width="10" stroke-linecap="round"/>\n</svg>\n`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf8');
}

async function generateIcons() {
  const map = {};

  for (const [name, tones] of Object.entries(usageManifest)) {
    const parts = iconDefs[name];
    for (const tone of tones) {
      const fileName = `${name}-${tone}.svg`;
      await writeFile(path.join(iconDir, fileName), iconSvg(parts, toneColors[tone]));
      map[`${name}:${tone}`] = `/assets/icons/${fileName}`;
    }
  }

  const assetMap = `module.exports = ${JSON.stringify(map, null, 2)};\n`;
  await writeFile(iconMapFile, assetMap);
}

async function generateAvatars() {
  for (const avatar of avatars) {
    await writeFile(
      path.join(avatarDir, `${avatar.name}.svg`),
      avatarSvg(avatar.label, avatar.start, avatar.end),
    );
  }
}

async function generateIllustrations() {
  await writeFile(path.join(illustrationDir, 'onboarding-hero.svg'), onboardingHeroSvg());
}

await ensureDir(iconDir);
await ensureDir(avatarDir);
await ensureDir(illustrationDir);
await ensureDir(path.dirname(iconMapFile));

await generateIcons();
await generateAvatars();
await generateIllustrations();

console.log('OpenClaw miniprogram SVG assets generated.');
