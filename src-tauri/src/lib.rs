mod ai;
mod location;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    // Self-update is desktop only (the iPhone app updates through the App Store / TestFlight).
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(vault::VaultState::default())
        .register_uri_scheme_protocol("flowvault", vault::protocol_handler)
        .invoke_handler(tauri::generate_handler![
            vault::vault_inspect,
            vault::vault_open,
            vault::vault_read_text,
            vault::vault_write_text,
            vault::vault_write_bytes,
            vault::vault_remove,
            vault::vault_list_note_files,
            vault::vault_prune_empty_dirs,
            vault::vault_list_dir,
            location::vault_default_location,
            location::vault_icloud_download,
            ai::ai_key_status,
            ai::ai_key_set,
            ai::ai_key_remove,
            ai::anthropic_fetch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Flow Notes");
}
