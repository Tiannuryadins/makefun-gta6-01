// Dev tool: capture the four screenshots in shots.json from the game
// itself, using headless Chromium (playwright-core + Chrome for Testing).
// Serves game/ over a local static server, opens each staged scene,
// waits for window.__shotReady, and saves a 1280x720 JPEG (quality 82)
// into screenshots/. Prints ALL_SHOTS_OK when every shot landed.
//
// Usage: node capture-shots.cjs
// (Reads shots.json from beside this file; serves game/ on port 8901.)

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/home/hatch/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core');

const ROOT = __dirname;
const GAME_DIR = path.join(ROOT, 'game');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const SHOTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
const PORT = 8901;
const CHROME = '/home/hatch/cft-dl/chrome-linux64/chrome';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const file = path.join(GAME_DIR, rel);
      if (!file.startsWith(GAME_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--force-color-profile=srgb'],
  });
  let ok = true;
  try {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (err) => {
        console.error(`[${shot.name}] page error:`, String(err));
        ok = false;
      });
      await page.goto(`http://localhost:${PORT}/index.html${shot.query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
      const out = path.join(SHOTS_DIR, `${shot.name}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
      const size = fs.statSync(out).size;
      console.log(`${shot.name}.jpg  ${size} bytes`);
      if (size > 262144) {
        console.error(`[${shot.name}] over the 256 KiB cap`);
        ok = false;
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(ok ? 'ALL_SHOTS_OK' : 'SHOTS_FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
