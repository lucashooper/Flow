//! Where a new vault goes by default, and iCloud Drive support on iPhone.
//!
//! On iPhone the vault lives in Flow's iCloud Drive folder
//! (iCloud Drive → Flow Notes → Flow Vault), which iCloud syncs to your
//! computers: on Windows it appears under iCloud Drive via the iCloud app, and
//! the desktop app opens that folder as the same vault.

use serde::Serialize;

#[derive(Serialize)]
pub struct VaultLocation {
    /// Full path for the vault folder.
    path: String,
    /// True when the folder is in iCloud Drive (synced to other devices).
    icloud: bool,
}

#[cfg(target_os = "ios")]
#[allow(unused_unsafe)]
fn icloud_documents() -> Option<std::path::PathBuf> {
    use objc2_foundation::NSFileManager;
    // Must not run on the main thread (it can block while iCloud sets up).
    let manager = unsafe { NSFileManager::defaultManager() };
    let url = unsafe { manager.URLForUbiquityContainerIdentifier(None) }?;
    let path = unsafe { url.path() }?;
    Some(std::path::PathBuf::from(path.to_string()).join("Documents"))
}

/// The suggested folder for a new vault on this device.
/// iPhone: iCloud Drive if it's signed in, otherwise the app's own Documents.
/// Desktop: `None` (the desktop app asks the user to pick a folder).
#[tauri::command]
pub async fn vault_default_location() -> Result<Option<VaultLocation>, String> {
    #[cfg(target_os = "ios")]
    {
        let result = tauri::async_runtime::spawn_blocking(|| {
            if let Some(docs) = icloud_documents() {
                let path = docs.join("Flow Vault");
                let _ = std::fs::create_dir_all(&path);
                return VaultLocation { path: path.to_string_lossy().to_string(), icloud: true };
            }
            let home = std::env::var("HOME").unwrap_or_default();
            let path = std::path::PathBuf::from(home).join("Documents").join("Flow Vault");
            let _ = std::fs::create_dir_all(&path);
            VaultLocation { path: path.to_string_lossy().to_string(), icloud: false }
        })
        .await
        .map_err(|e| e.to_string())?;
        return Ok(Some(result));
    }
    #[cfg(not(target_os = "ios"))]
    Ok(None)
}

/// iCloud keeps files it hasn't downloaded yet as hidden `.Name.json.icloud`
/// placeholders. Ask iOS to download every one inside `root` so the vault is
/// complete. Returns how many were requested (0 everywhere but iPhone).
#[tauri::command]
pub async fn vault_icloud_download(root: String) -> Result<usize, String> {
    #[cfg(target_os = "ios")]
    {
        return tauri::async_runtime::spawn_blocking(move || {
            use objc2_foundation::{NSFileManager, NSString, NSURL};
            let mut count = 0;
            let mut stack = vec![std::path::PathBuf::from(&root)];
            while let Some(dir) = stack.pop() {
                let Ok(entries) = std::fs::read_dir(&dir) else { continue };
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                    } else if name.starts_with('.') && name.ends_with(".icloud") {
                        let real = dir.join(&name[1..name.len() - ".icloud".len()]);
                        #[allow(unused_unsafe)]
                        unsafe {
                            let url = NSURL::fileURLWithPath(&NSString::from_str(&real.to_string_lossy()));
                            let _ = NSFileManager::defaultManager().startDownloadingUbiquitousItemAtURL_error(&url);
                        }
                        count += 1;
                    }
                }
            }
            count
        })
        .await
        .map_err(|e| e.to_string());
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = root;
        Ok(0)
    }
}
