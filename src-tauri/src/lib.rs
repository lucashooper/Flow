mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Flow Notes");
}
