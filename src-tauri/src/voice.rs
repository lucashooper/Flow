//! 🎤 Voice input.
//!
//! On desktop, Flow records the microphone in the web view and turns speech
//! into text right here on the computer with Whisper (whisper.cpp). Nothing is
//! uploaded. The speech model (~60 MB) is downloaded once, the first time
//! voice is used, into the app's own data folder (never into the vault).
//!
//! On iPhone, the keyboard's own 🎤 dictation is used instead.

/// Start system dictation where Flow can't record itself (iPhone).
/// Returns the platform so the app can show the right hint.
#[tauri::command]
pub fn start_dictation() -> &'static str {
    #[cfg(target_os = "ios")]
    return "ios";
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(windows)]
    return "windows";
    #[allow(unreachable_code)]
    "other"
}

#[cfg(desktop)]
pub use desktop::*;

#[cfg(desktop)]
mod desktop {
    use std::io::Write;
    use std::path::PathBuf;
    use std::sync::{LazyLock, Mutex};
    use std::time::Duration;

    use serde::Serialize;
    use tauri::{ipc::Request, AppHandle, Emitter, Manager};
    use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

    /// English Whisper "base" model, 5-bit quantised: small, fast, accurate enough for notes.
    const MODEL_FILE: &str = "ggml-base.en-q5_1.bin";
    const MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin";
    const MODEL_MIN_BYTES: u64 = 40_000_000;

    static MODEL: Mutex<Option<WhisperContext>> = Mutex::new(None);
    static DOWNLOAD_LOCK: LazyLock<tauri::async_runtime::Mutex<()>> = LazyLock::new(|| tauri::async_runtime::Mutex::new(()));

    fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("No app data folder: {e}"))?
            .join("models");
        std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
        Ok(dir.join(MODEL_FILE))
    }

    fn model_ready(path: &PathBuf) -> bool {
        std::fs::metadata(path).map(|m| m.len() >= MODEL_MIN_BYTES).unwrap_or(false)
    }

    #[derive(Serialize, Clone)]
    struct Progress {
        downloaded: u64,
        total: u64,
    }

    /// Whether the speech model is on this computer.
    #[tauri::command]
    pub fn voice_model_status(app: AppHandle) -> Result<bool, String> {
        Ok(model_ready(&model_path(&app)?))
    }

    /// Download the speech model (once). Emits `voice-model-progress` events.
    #[tauri::command]
    pub async fn voice_model_download(app: AppHandle) -> Result<(), String> {
        let path = model_path(&app)?;
        if model_ready(&path) {
            return Ok(());
        }
        // One download at a time; a second caller waits, then finds the model ready.
        let _lock = DOWNLOAD_LOCK.lock().await;
        if model_ready(&path) {
            return Ok(());
        }
        download(&app, &path).await
    }

    async fn download(app: &AppHandle, path: &PathBuf) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(20))
            .build()
            .map_err(|e| e.to_string())?;
        let mut res = client
            .get(MODEL_URL)
            .send()
            .await
            .map_err(|e| format!("Could not download the voice model (are you online?): {e}"))?;
        if !res.status().is_success() {
            return Err(format!("Could not download the voice model (HTTP {}).", res.status()));
        }
        let total = res.content_length().unwrap_or(0);
        let tmp = path.with_extension("part");
        let mut file = std::fs::File::create(&tmp).map_err(|e| format!("Could not save the voice model: {e}"))?;
        let mut downloaded: u64 = 0;
        let mut last_emit = 0u64;
        loop {
            match res.chunk().await {
                Ok(Some(bytes)) => {
                    file.write_all(&bytes).map_err(|e| format!("Could not save the voice model: {e}"))?;
                    downloaded += bytes.len() as u64;
                    if downloaded - last_emit > 512 * 1024 || downloaded == total {
                        last_emit = downloaded;
                        let _ = app.emit("voice-model-progress", Progress { downloaded, total });
                    }
                }
                Ok(None) => break,
                Err(e) => {
                    let _ = std::fs::remove_file(&tmp);
                    return Err(format!("The voice model download was interrupted: {e}"));
                }
            }
        }
        file.flush().map_err(|e| e.to_string())?;
        drop(file);
        // A whisper.cpp model starts with the "ggml" magic number.
        let mut head = [0u8; 4];
        let ok = std::fs::File::open(&tmp)
            .and_then(|mut f| std::io::Read::read_exact(&mut f, &mut head))
            .is_ok()
            && u32::from_le_bytes(head) == 0x6767_6d6c
            && downloaded >= MODEL_MIN_BYTES
            && (total == 0 || downloaded == total);
        if !ok {
            let _ = std::fs::remove_file(&tmp);
            return Err("The downloaded voice model was incomplete. Try again.".into());
        }
        std::fs::rename(&tmp, path).map_err(|e| format!("Could not save the voice model: {e}"))?;
        Ok(())
    }

    /// Turn speech into text. The request body is raw 16 kHz mono f32 samples
    /// (little endian), recorded by the web view.
    #[tauri::command]
    pub async fn voice_transcribe(app: AppHandle, request: Request<'_>) -> Result<String, String> {
        let bytes = match request.body() {
            tauri::ipc::InvokeBody::Raw(b) => b.clone(),
            _ => return Err("No audio received.".into()),
        };
        if bytes.len() < 4 * 1600 {
            return Ok(String::new()); // under 0.1 s: nothing said
        }
        let samples: Vec<f32> = bytes.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        let path = model_path(&app)?;
        if !model_ready(&path) {
            return Err("The voice model isn't downloaded yet.".into());
        }
        tauri::async_runtime::spawn_blocking(move || transcribe(&path, &samples))
            .await
            .map_err(|e| e.to_string())?
    }

    pub fn transcribe(path: &PathBuf, samples: &[f32]) -> Result<String, String> {
        let mut guard = MODEL.lock().map_err(|_| "Voice engine is busy.".to_string())?;
        if guard.is_none() {
            let ctx = WhisperContext::new_with_params(path, WhisperContextParameters::default())
                .map_err(|e| format!("Could not load the voice model: {e}"))?;
            *guard = Some(ctx);
        }
        let ctx = guard.as_ref().unwrap();
        let mut state = ctx.create_state().map_err(|e| format!("Voice engine error: {e}"))?;

        // Whisper needs at least 1 s of audio; pad short clips with silence.
        let mut audio = samples.to_vec();
        if audio.len() < 16_000 + 1_600 {
            audio.resize(16_000 + 1_600, 0.0);
        }

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(1, 8);
        params.set_n_threads(threads as i32);
        params.set_language(Some("en"));
        params.set_translate(false);
        params.set_no_context(true);
        params.set_suppress_blank(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        state.full(params, &audio).map_err(|e| format!("Could not transcribe: {e}"))?;

        let mut text = String::new();
        for segment in state.as_iter() {
            if segment.no_speech_probability() > 0.8 {
                continue;
            }
            if let Ok(s) = segment.to_str_lossy() {
                text.push_str(&s);
            }
        }
        Ok(clean(&text))
    }

    /// Drop Whisper's non-speech tags like "[BLANK_AUDIO]" or "(music)" and tidy spaces.
    fn clean(text: &str) -> String {
        let mut out = String::with_capacity(text.len());
        let mut depth = 0i32;
        for ch in text.chars() {
            match ch {
                '[' | '(' => depth += 1,
                ']' | ')' if depth > 0 => depth -= 1,
                _ if depth == 0 => out.push(ch),
                _ => {}
            }
        }
        out.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    #[cfg(test)]
    mod tests {
        use super::clean;
        #[test]
        fn strips_tags() {
            assert_eq!(clean(" [BLANK_AUDIO] "), "");
            assert_eq!(clean(" Hello there. (laughs) How are you?"), "Hello there. How are you?");
        }
    }
}

/// Manual check with a real model: FLOW_TEST_MODEL=... FLOW_TEST_PCM=<16 kHz f32le> cargo test --release -- --ignored real_model
#[cfg(all(test, desktop))]
mod real_model_test {
    #[test]
    #[ignore]
    fn real_model() {
        let model = std::path::PathBuf::from(std::env::var("FLOW_TEST_MODEL").unwrap());
        let bytes = std::fs::read(std::env::var("FLOW_TEST_PCM").unwrap()).unwrap();
        let samples: Vec<f32> = bytes.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        let t = std::time::Instant::now();
        let text = super::transcribe(&model, &samples).unwrap();
        println!("TRANSCRIPT ({:?}): {text}", t.elapsed());
        assert!(text.to_lowercase().contains("dentist"));
        let silence = vec![0.0f32; 16_000 * 2];
        println!("SILENCE: {:?}", super::transcribe(&model, &silence).unwrap());
    }
}
