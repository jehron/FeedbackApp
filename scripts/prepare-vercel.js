import { cpSync, mkdirSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUTPUT_DIR = join(ROOT, '.vercel', 'output');
const STATIC_DIR = join(OUTPUT_DIR, 'static');
const FUNCTIONS_DIR = join(OUTPUT_DIR, 'functions');

// Clean output directory
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}

// Create output directories
mkdirSync(STATIC_DIR, { recursive: true });
mkdirSync(FUNCTIONS_DIR, { recursive: true });

// Copy static files from dist (root level) to .vercel/output/static
console.log('Copying static files from dist to .vercel/output/static...');
const distDir = join(ROOT, 'dist');
if (existsSync(distDir)) {
  cpSync(distDir, STATIC_DIR, { recursive: true });
  console.log('  Static files copied successfully');
} else {
  console.error('ERROR: dist folder not found at', distDir);
  process.exit(1);
}

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
      if (existsSync(storageFile)) {
        cpSync(storageFile, join(funcDir, '_storage.js'));
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
console.log('Creating .vercel/output/config.json...');
writeFileSync(join(OUTPUT_DIR, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    // Handle API routes first
    { src: '/api/(.*)', dest: '/api/$1' },
    // Serve static files
    { handle: 'filesystem' },
    // SPA fallback for all other routes
    { src: '/(.*)', dest: '/index.html' }
  ]
}, null, 2));

console.log('Build output prepared successfully!');
console.log(`Output directory: ${OUTPUT_DIR}`);
