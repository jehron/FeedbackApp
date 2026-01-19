import { cpSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUTPUT_DIR = join(ROOT, '.vercel', 'output');
const STATIC_DIR = join(OUTPUT_DIR, 'static');
const FUNCTIONS_DIR = join(OUTPUT_DIR, 'functions');

// Clean and create output directories
mkdirSync(STATIC_DIR, { recursive: true });
mkdirSync(FUNCTIONS_DIR, { recursive: true });

// Copy static files from client/dist to .vercel/output/static
console.log('Copying static files...');
cpSync(join(ROOT, 'client', 'dist'), STATIC_DIR, { recursive: true });

// Find all API files and create function bundles
console.log('Preparing API functions...');
const apiDir = join(ROOT, 'api');

function processApiDir(dir, basePath = '') {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processApiDir(fullPath, join(basePath, entry));
    } else if (entry.endsWith('.js') && !entry.startsWith('_')) {
      // Create function bundle
      const relativePath = join(basePath, entry);
      const funcName = relativePath.replace(/\.js$/, '').replace(/\\/g, '/');
      const funcDir = join(FUNCTIONS_DIR, 'api', `${funcName}.func`);

      mkdirSync(funcDir, { recursive: true });

      // Copy the function file as index.mjs
      cpSync(fullPath, join(funcDir, 'index.mjs'));

      // Copy any local dependencies (files starting with _)
      const localDir = dirname(fullPath);
      const localFiles = readdirSync(localDir).filter(f => f.startsWith('_') && f.endsWith('.js'));
      for (const localFile of localFiles) {
        cpSync(join(localDir, localFile), join(funcDir, localFile));
      }

      // Also copy the _storage.js from api root if needed
      const storageFile = join(apiDir, '_storage.js');
      try {
        cpSync(storageFile, join(funcDir, '_storage.js'));
      } catch (e) {
        // File might not exist or already copied
      }

      // Create .vc-config.json
      writeFileSync(join(funcDir, '.vc-config.json'), JSON.stringify({
        runtime: 'nodejs20.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        memory: 1024,
        maxDuration: 30
      }, null, 2));

      console.log(`  Created function: api/${funcName}`);
    }
  }
}

processApiDir(apiDir);

// Create config.json with routes
console.log('Creating config...');
writeFileSync(join(OUTPUT_DIR, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/((?!api/).*)', dest: '/index.html' }
  ]
}, null, 2));

console.log('Build output prepared successfully!');
