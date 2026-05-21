import { build } from 'esbuild';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const srcScriptsDir = path.join(srcDir, 'scripts');
const distScriptsDir = path.join(distDir, 'scripts');

const collectEntryPoints = (dirPath) => {
  const entryPoints = [];

  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        entryPoints.push(entryPath);
      }
    }
  };

  walk(dirPath);
  return entryPoints;
};

fs.rmSync(distDir, { recursive: true, force: true });

await build({
  entryPoints: collectEntryPoints(srcDir),
  outbase: srcDir,
  outdir: distDir,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  packages: 'external',
  sourcemap: false,
  bundle: false,
  logLevel: 'info',
});

if (fs.existsSync(srcScriptsDir)) {
  fs.mkdirSync(distScriptsDir, { recursive: true });

  for (const entry of fs.readdirSync(srcScriptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.py')) continue;

    fs.copyFileSync(
      path.join(srcScriptsDir, entry.name),
      path.join(distScriptsDir, entry.name)
    );
  }
}