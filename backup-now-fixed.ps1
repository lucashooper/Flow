# Complete Flow Notes Backup - PowerShell
# Run this script to backup everything (database + images)

# Navigate to project directory
$projectDir = "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"
Set-Location $projectDir

# Create backup directory with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backups\$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host ""
Write-Host "🔄 Starting complete backup..." -ForegroundColor Cyan
Write-Host "📁 Backup location: $backupDir" -ForegroundColor Gray
Write-Host ""

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
Write-Host ""
Write-Host "📸 Step 2/2: Downloading images..." -ForegroundColor Green
Write-Host "   (This may take a few minutes depending on storage size)" -ForegroundColor Gray
Write-Host ""

try {
    node backup-images.js "$backupDir\images"
    Write-Host ""
    Write-Host "   ✅ Image backup complete" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Image backup failed: $_" -ForegroundColor Red
    Write-Host "   Make sure you have Node.js installed and .env configured" -ForegroundColor Yellow
}

# 3. Create README (using Out-File to avoid parse errors)
$readmeContent = "# Flow Notes Backup`n"
$readmeContent += "Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n"
$readmeContent += "## Contents`n"
$readmeContent += "* database.sql: Complete PostgreSQL dump`n"
$readmeContent += "* images/: All images from Supabase Storage`n"
$readmeContent += "* images/manifest.json: Image metadata`n`n"
$readmeContent += "## Restore Instructions`n`n"
$readmeContent += "See BACKUP_GUIDE.md in project root for full instructions.`n`n"
$readmeContent += "## Quick Stats`n"

# Add file sizes if they exist
if (Test-Path "$backupDir\database.sql") {
    $dbSize = (Get-Item "$backupDir\database.sql").Length / 1MB
    $readmeContent += "* Database: $([math]::Round($dbSize, 2)) MB`n"
}

if (Test-Path "$backupDir\images\manifest.json") {
    $manifest = Get-Content "$backupDir\images\manifest.json" | ConvertFrom-Json
    $readmeContent += "* Images: $($manifest.downloaded) files downloaded`n"
}

$readmeContent | Out-File -FilePath "$backupDir\README.txt" -Encoding UTF8

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ BACKUP COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Location: $backupDir" -ForegroundColor White

if (Test-Path "$backupDir\database.sql") {
    $dbSize = (Get-Item "$backupDir\database.sql").Length / 1MB
    Write-Host "📊 Database: $([math]::Round($dbSize, 2)) MB" -ForegroundColor Gray
}

if (Test-Path "$backupDir\images") {
    $imageCount = (Get-ChildItem "$backupDir\images" -File).Count
    Write-Host "📸 Images: $imageCount files" -ForegroundColor Gray
}

Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Copy this backup to external drive or cloud storage" -ForegroundColor Gray
Write-Host "   2. See BACKUP_GUIDE.md for restore instructions" -ForegroundColor Gray
Write-Host ""

# Open backup directory
Start-Process explorer.exe $backupDir
