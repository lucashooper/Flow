//! Claude API access for the Learning features.
//!
//! The user's Anthropic API key lives only in the operating system's keychain
//! (Windows Credential Manager, macOS Keychain, Linux Secret Service), never
//! in the vault or in the web view. The web view's Anthropic SDK sends its
//! requests through `anthropic_fetch`, which adds the key here, in Rust, and
//! only ever talks to api.anthropic.com.

use std::time::Duration;

use serde::Serialize;

const KEYCHAIN_SERVICE: &str = "Flow Notes";
const KEYCHAIN_USER: &str = "anthropic-api-key";
const API_ORIGIN: &str = "https://api.anthropic.com/";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).map_err(|e| format!("Keychain unavailable: {e}"))
}

fn stored_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read the API key from the keychain: {e}")),
    }
}

/// Whether an API key is saved (the key itself is never returned).
#[tauri::command]
pub fn ai_key_status() -> Result<bool, String> {
    Ok(stored_key()?.is_some())
}

#[tauri::command]
pub fn ai_key_set(key: String) -> Result<(), String> {
    let key = key.trim();
    if !key.starts_with("sk-ant-") || key.len() < 20 || key.chars().any(char::is_whitespace) {
        return Err("That doesn't look like an Anthropic API key (they start with \"sk-ant-\").".into());
    }
    entry()?
        .set_password(key)
        .map_err(|e| format!("Could not save the key to the keychain: {e}"))
}

#[tauri::command]
pub fn ai_key_remove() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not remove the key: {e}")),
    }
}

#[derive(Serialize)]
pub struct ProxyResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

/// Send one Anthropic API request with the key from the keychain.
#[tauri::command]
pub async fn anthropic_fetch(
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<ProxyResponse, String> {
    if !url.starts_with(API_ORIGIN) {
        return Err("Only api.anthropic.com can be called".into());
    }
    let key = stored_key()?.ok_or_else(|| "No Anthropic API key saved yet".to_string())?;

    let method = reqwest::Method::from_bytes(method.to_uppercase().as_bytes()).map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.request(method, &url);
    for (name, value) in headers {
        let lower = name.to_ascii_lowercase();
        // The key is added below; never forward credentials or hop-by-hop headers from the page.
        if matches!(lower.as_str(), "x-api-key" | "authorization" | "host" | "content-length" | "connection") {
            continue;
        }
        req = req.header(name, value);
    }
    req = req.header("x-api-key", key);
    if let Some(body) = body {
        req = req.body(body);
    }

    let res = req.send().await.map_err(|e| format!("Network error: {e}"))?;
    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
        .collect();
    let body = res.text().await.map_err(|e| format!("Network error: {e}"))?;
    Ok(ProxyResponse { status, headers, body })
}
