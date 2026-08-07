# Complete Flow Notes Backup - PowerShell
# Run this script to backup everything (database + images)

# Navigate to project directory
$projectDir = "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"
Set-Location $projectDir

# Create backup directory with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backups\$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host "`n🔄 Starting complete backup..." -ForegroundColor Cyan
Write-Host "📁 Backup location: $backupDir`n" -ForegroundColor Gray

# 1. Backup database
Write-Host "📊 Step 1/2: Backing up database..." -ForegroundColor Green
try {
    supabase db dump -f "$backupDir\database.sql"
    Write-Host "   ✅ Database backup complete" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Database backup failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Backup images
Write-Host "`n📸 Step 2/2: Downloading images..." -ForegroundColor Green
Write-Host "   (This may take a few minutes depending on storage size)" -ForegroundColor Gray

try {
    node backup-images.js "$backupDir\images"
    Write-Host "   ✅ Image backup complete" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Image backup failed: $_" -ForegroundColor Red
    Write-Host "   Make sure you have Node.js installed and .env configured" -ForegroundColor Yellow
}

# 3. Create README
$readme = @"
# Flow Notes Backup
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Contents
- database.sql: Complete PostgreSQL dump (notes, folders, users, policies)
- images/: All images from Supabase Storage
- images/manifest.json: Image metadata

## Restore Instructions

### To New Supabase Project:

1. Create new Supabase project at https://app.supabase.com

2. Restore database:
   ``````bash
   supabase db push --db-url "postgresql://postgres:PASSWORD@HOST:5432/postgres" --file database.sql
   ``````

3. Create storage bucket (in SQL Editor):
   ``````sql
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('note-images', 'note-images', true);
   
   -- Add policies
   CREATE POLICY "Public read" ON storage.objects
     FOR SELECT USING (bucket_id = 'note-images');
   
   CREATE POLICY "Auth upload" ON storage.objects
     FOR INSERT WITH CHECK (
       bucket_id = 'note-images' AND auth.role() = 'authenticated'
     );
   ``````

4. Upload images:
   - Go to Storage → note-images in Supabase dashboard
   - Create "images" folder
   - Upload all files from images/ folder

5. Update .env with new project credentials

## Storage Info
- Total images: See images/manifest.json
- Database size: $(if (Test-Path "$backupDir\database.sql") { "{0:N2} MB" -f ((Get-Item "$backupDir\database.sql").Length / 1MB) } else { "N/A" })
"@

$readme | Out-File -FilePath "$backupDir\README.md" -Encoding UTF8

# Summary
Write-Host "`n" -NoNewline
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ BACKUP COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Location: $backupDir" -ForegroundColor White
Write-Host "📊 Database: database.sql" -ForegroundColor Gray
Write-Host "📸 Images: images/" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Copy this backup to external drive or cloud storage" -ForegroundColor Gray
Write-Host "   2. Test restore in a new Supabase project (see README.md)" -ForegroundColor Gray
Write-Host "   3. Keep backups regularly (weekly recommended)" -ForegroundColor Gray
Write-Host ""

# Open backup directory
Invoke-Item $backupDir
