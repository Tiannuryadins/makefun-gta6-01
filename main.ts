// Solmar Bay for make.fun gta6-01 ("Make GTA 6") — the entry program.
// Node 22, standard library only. It takes the game in this repository
// (game/, plain static files a desktop browser plays offline, plus the
// screenshots/ the maker captured from the game itself) and hands it over:
// copy both trees beside this file into the output directory and write
// dossier.json there with the kit's vendored library, buildDossier.
//
// The grader runs this twice and requires byte-identical output, so the
// program does nothing time- or environment-dependent: same inputs, same
// bytes out. Caps mirror the gate's limits (reference/gate.json): at most
// 4 screenshots of 256 KiB, at most 993 game files / 48 MiB, paths under
// 1000 bytes, dossier text capped at 163,840 bytes. A repository with
// fewer than 3 or more than 4 screenshots is refused outright, since the
// gate would refuse it too.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)
// Serve the game locally with `node serve.ts` → http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate wants 3 or 4 screenshots, no more, no fewer. Refuse early with
// a plain error instead of writing an entry the scorer would reject.
const shotsDir = join(repoRoot, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => !name.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(
    `screenshots/ must hold 3 or 4 images, found ${shots.length}`,
  );
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
