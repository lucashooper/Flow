/**
 * Download all images from Supabase Storage
 * Usage: node backup-images.js [output-dir]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load from .env
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OUTPUT_DIR = process.argv[2] || './backups/images';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

async function listAllImages() {
  const url = `${SUPABASE_URL}/storage/v1/object/list/note-images`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const files = JSON.parse(data);
          resolve(files);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadImage(filepath, outputPath) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/note-images/${filepath}`;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🔄 Fetching image list from Supabase...');
  
  const files = await listAllImages();
  console.log(`📸 Found ${files.length} images`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let downloaded = 0;
  let errors = 0;

  for (const file of files) {
    if (file.name.endsWith('/')) continue; // Skip folders
    
    const outputPath = path.join(OUTPUT_DIR, file.name.replace(/\//g, '_'));
    
    try {
      process.stdout.write(`\r⬇️  Downloading: ${file.name} (${downloaded + 1}/${files.length})`);
      await downloadImage(file.name, outputPath);
      downloaded++;
    } catch (err) {
      errors++;
      console.error(`\n❌ Failed: ${file.name}`, err.message);
    }
  }

  console.log(`\n\n✅ Download complete!`);
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Location: ${OUTPUT_DIR}`);

  // Create manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    total: files.length,
    downloaded,
    errors,
    files: files.map(f => ({
      name: f.name,
      size: f.metadata?.size,
      created: f.created_at,
      updated: f.updated_at
    }))
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n📋 Manifest saved: ${path.join(OUTPUT_DIR, 'manifest.json')}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
