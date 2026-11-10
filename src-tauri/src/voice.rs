//! 🎤 Voice input. Flow uses the operating system's own dictation rather than
//! recording audio itself: it's free, private to the OS, and works in every
//! text box.

/// Start system dictation in whatever text box has focus.
/// Returns the platform so the app can show the right hint where it can't
/// start dictation for you ("windows" | "macos" | "ios" | "other").
#[tauri::command]
pub fn start_dictation() -> &'static str {
    #[cfg(windows)]
    {
        // Press Win + H: opens Windows voice typing in the focused field.
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_LWIN,
        };
        fn key(vk: u16, up: bool) -> INPUT {
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 },
                },
            }
        }
        const VK_H: u16 = 0x48;
        let inputs = [key(VK_LWIN, false), key(VK_H, false), key(VK_H, true), key(VK_LWIN, true)];
        unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32) };
        return "windows";
    }
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(target_os = "ios")]
    return "ios";
    #[allow(unreachable_code)]
    "other"
}
