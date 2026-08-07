#!/bin/bash
# Complete Flow Notes Backup Script
# Backs up database + storage images

set -e  # Exit on error

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting complete backup..."

# 1. Database backup (pg_dump via Supabase CLI)
echo "📊 Backing up database..."
supabase db dump -f "$BACKUP_DIR/database.sql"

# 2. List all storage buckets
echo "🪣 Listing storage buckets..."
supabase storage list > "$BACKUP_DIR/buckets.txt"

# 3. Download all images from note-images bucket
echo "📸 Downloading images..."
mkdir -p "$BACKUP_DIR/note-images"

# Get list of all files in note-images bucket
supabase storage ls note-images > "$BACKUP_DIR/image-list.txt"

# Download each image (this will take a while)
# Note: Supabase CLI doesn't have bulk download, need to use API
echo "⚠️  Image download requires manual step - see backup-images.js"

# 4. Export metadata
echo "📋 Creating backup manifest..."
cat > "$BACKUP_DIR/MANIFEST.md" <<EOF
# Flow Notes Backup
Created: $(date)

## Contents
- database.sql: Full PostgreSQL dump (notes, folders, users, RLS policies)
- buckets.txt: List of storage buckets
- image-list.txt: List of all images in note-images bucket
- note-images/: Downloaded images (if backup-images.js was run)

## Restore Instructions
1. Create new Supabase project
2. Run: supabase db push --db-url "postgresql://..." < database.sql
3. Create note-images bucket in new project
4. Upload images: supabase storage cp note-images/* note-images/

## Image Download
Run: node backup-images.js
(Downloads all images from Supabase Storage)
EOF

echo "✅ Backup complete: $BACKUP_DIR"
echo ""
echo "⚠️  To download images, run:"
echo "node backup-images.js $BACKUP_DIR"
