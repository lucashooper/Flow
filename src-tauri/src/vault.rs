//! Local vault file access for Flow Notes.
//!
//! The web app decides *what* to write (see src/lib/vault/store.ts); these
//! commands only read and write files, and every path is confined to the vault
//! folder the user picked — nothing outside it can be touched.

use std::borrow::Cow;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use base64::Engine;
use percent_encoding::percent_decode_str;
use serde::Serialize;
use tauri::http::{Request, Response, StatusCode};
use tauri::{Manager, Runtime, State, UriSchemeContext};

/// The vault folder currently open in this window.
#[derive(Default)]
pub struct VaultState(pub Mutex<Option<PathBuf>>);

const META_DIR: &str = ".flow";
const ATTACHMENTS_DIR: &str = "attachments";
/// OS clutter that shouldn't keep an otherwise empty folder alive.
const JUNK_FILES: [&str; 3] = [".DS_Store", "desktop.ini", "Thumbs.db"];

fn root(state: &State<'_, VaultState>) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .map_err(|_| "vault lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "No vault is open".to_string())
}

/// Join a vault-relative path onto the root, refusing anything that could
/// escape it (absolute paths, `..`, drive prefixes).
fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    let mut out = root.to_path_buf();
    let mut any = false;
    for c in rel_path.components() {
        match c {
            Component::Normal(part) => {
                out.push(part);
                any = true;
            }
            Component::CurDir => {}
            _ => return Err(format!("Invalid vault path: {rel}")),
        }
    }
    if !any {
        return Err(format!("Invalid vault path: {rel}"));
    }
    Ok(out)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Could not create folder: {e}"))?;
    }
    let tmp = path.with_extension("flow-tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("Could not write {}: {e}", path.display()))?;
        f.write_all(bytes).map_err(|e| format!("Could not write {}: {e}", path.display()))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Could not save {}: {e}", path.display())
    })
}

#[derive(Serialize)]
pub struct FolderInfo {
    exists: bool,
    is_vault: bool,
    is_empty: bool,
}

/// Look at a folder before opening it (used by the vault picker).
#[tauri::command]
pub fn vault_inspect(path: String) -> FolderInfo {
    let p = PathBuf::from(&path);
    let exists = p.is_dir();
    let is_vault = p.join(META_DIR).join("vault.json").is_file();
    let is_empty = !exists
        || fs::read_dir(&p)
            .map(|mut it| {
                it.all(|e| {
                    e.map(|e| JUNK_FILES.contains(&e.file_name().to_string_lossy().as_ref()))
                        .unwrap_or(true)
                })
            })
            .unwrap_or(true);
    FolderInfo { exists, is_vault, is_empty }
}

#[tauri::command]
pub fn vault_open(root: String, create: bool, state: State<'_, VaultState>) -> Result<(), String> {
    let path = PathBuf::from(&root);
    if !path.is_absolute() {
        return Err("The vault location must be a full folder path".into());
    }
    if !path.is_dir() {
        if create {
            fs::create_dir_all(&path).map_err(|e| format!("Could not create the vault folder: {e}"))?;
        } else {
            return Err(format!(
                "The vault folder can't be found at {root}. It may have been moved, renamed or be on a drive that isn't connected."
            ));
        }
    }
    *state.0.lock().map_err(|_| "vault lock poisoned")? = Some(path);
    Ok(())
}

#[tauri::command]
pub fn vault_read_text(path: String, state: State<'_, VaultState>) -> Result<Option<String>, String> {
    let full = resolve(&root(&state)?, &path)?;
    match fs::read_to_string(&full) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Could not read {}: {e}", full.display())),
    }
}

#[tauri::command]
pub fn vault_write_text(path: String, contents: String, state: State<'_, VaultState>) -> Result<(), String> {
    let full = resolve(&root(&state)?, &path)?;
    write_atomic(&full, contents.as_bytes())
}

#[tauri::command]
pub fn vault_write_bytes(path: String, base64: String, state: State<'_, VaultState>) -> Result<(), String> {
    let full = resolve(&root(&state)?, &path)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| format!("Bad file data: {e}"))?;
    write_atomic(&full, &bytes)
}

#[tauri::command]
pub fn vault_remove(path: String, state: State<'_, VaultState>) -> Result<(), String> {
    let full = resolve(&root(&state)?, &path)?;
    match fs::remove_file(&full) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Could not delete {}: {e}", full.display())),
    }
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn collect_notes(root: &Path, dir: &Path, depth: usize, out: &mut Vec<String>) {
    if depth > 64 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if is_hidden(&name) {
            continue;
        }
        let path = entry.path();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            if depth == 0 && name == ATTACHMENTS_DIR {
                continue;
            }
            collect_notes(root, &path, depth + 1, out);
        } else if ft.is_file() && name.to_lowercase().ends_with(".json") {
            if let Ok(rel) = path.strip_prefix(root) {
                let parts: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect();
                out.push(parts.join("/"));
            }
        }
    }
}

/// Every note file in the vault (all `.json` files outside hidden folders and attachments/).
#[tauri::command]
pub fn vault_list_note_files(state: State<'_, VaultState>) -> Result<Vec<String>, String> {
    let root = root(&state)?;
    let mut out = Vec::new();
    collect_notes(&root, &root, 0, &mut out);
    Ok(out)
}

/// Returns true if `dir` is empty after pruning.
fn prune(dir: &Path, depth: usize) -> bool {
    if depth > 64 {
        return false;
    }
    let Ok(entries) = fs::read_dir(dir) else { return false };
    let mut empty = true;
    let mut junk = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            let protected = is_hidden(&name) || (depth == 0 && name == ATTACHMENTS_DIR);
            if protected || !prune(&path, depth + 1) {
                empty = false;
            } else {
                let _ = fs::remove_dir(&path);
            }
        } else if JUNK_FILES.contains(&name.as_str()) {
            junk.push(path);
        } else {
            empty = false;
        }
    }
    if empty && depth > 0 {
        for j in junk {
            let _ = fs::remove_file(j);
        }
    }
    empty
}

/// Remove folders left empty after notes were moved, renamed or deleted.
#[tauri::command]
pub fn vault_prune_empty_dirs(state: State<'_, VaultState>) -> Result<(), String> {
    let root = root(&state)?;
    prune(&root, 0);
    Ok(())
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mov") => "video/quicktime",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn respond(status: StatusCode, mime: &str, body: Vec<u8>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-cache")
        .body(Cow::Owned(body))
        .unwrap()
}

/// Serves `flowvault://localhost/attachments/<file>` from the open vault so
/// images saved in the vault display inside notes.
pub fn protocol_handler<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let state = ctx.app_handle().state::<VaultState>();
    let Ok(root) = root(&state) else {
        return respond(StatusCode::NOT_FOUND, "text/plain", b"No vault open".to_vec());
    };
    let raw = request.uri().path().trim_start_matches('/');
    let rel = percent_decode_str(raw).decode_utf8_lossy().to_string();
    if !rel.starts_with(&format!("{ATTACHMENTS_DIR}/")) {
        return respond(StatusCode::FORBIDDEN, "text/plain", b"Forbidden".to_vec());
    }
    let Ok(full) = resolve(&root, &rel) else {
        return respond(StatusCode::FORBIDDEN, "text/plain", b"Forbidden".to_vec());
    };
    match fs::read(&full) {
        Ok(bytes) => respond(StatusCode::OK, mime_for(&full), bytes),
        Err(_) => respond(StatusCode::NOT_FOUND, "text/plain", b"Not found".to_vec()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_rejects_escapes() {
        let root = Path::new("/vault");
        assert!(resolve(root, "../etc/passwd").is_err());
        assert!(resolve(root, "a/../../b").is_err());
        assert!(resolve(root, "/etc/passwd").is_err());
        assert!(resolve(root, "").is_err());
        assert_eq!(resolve(root, "Work/Note.json").unwrap(), PathBuf::from("/vault/Work/Note.json"));
    }
}
