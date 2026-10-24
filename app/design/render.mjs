// Renders the SVGs in design/ to the PNGs @capacitor/assets needs in assets/.
// needs Playwright: npx -y playwright@1 install chromium, then node design/render.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const fonts = '<link href="https://fonts.googleapis.com/css2?family=Gentium+Plus:wght@700&display=block" rel="stylesheet">';
const b = await chromium.launch();
async function shot(svg, out, size, bg = 'transparent', pad = 0) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  const inner = readFileSync(new URL(svg, import.meta.url), 'utf8');
  await p.setContent(`<html><head>${fonts}</head><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({ path: new URL(out, import.meta.url).pathname, omitBackground: bg === 'transparent' });
  await p.close();
}
await shot('icon.svg', '../assets/icon-only.png', 1024, '#1f3b5c');
await shot('fg.svg', '../assets/icon-foreground.png', 1024);
await shot('icon.svg', '../assets/splash.png', 2732, '#1f3b5c', 1066);
await shot('icon.svg', '../assets/splash-dark.png', 2732, '#1f3b5c', 1066);
await shot('icon.svg', '../site-icon-1024.png', 1024, '#1f3b5c');
await b.close();
