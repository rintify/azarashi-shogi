mod evaluation;
mod model;
mod rules;
mod search;
mod wire;

use serde::Serialize;
use wire::Request;

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn clock_now() -> f64;
    fn search_progress(depth: u32, nodes: f64, elapsed_ms: f64);
}
struct WorkerHost {
    #[cfg(not(target_arch = "wasm32"))]
    started: std::time::Instant,
}
impl WorkerHost {
    fn new() -> Self {
        Self {
            #[cfg(not(target_arch = "wasm32"))]
            started: std::time::Instant::now(),
        }
    }
}
impl search::Host for WorkerHost {
    fn now(&mut self) -> f64 {
        #[cfg(target_arch = "wasm32")]
        {
            unsafe { clock_now() }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if NATIVE_CANCEL.load(std::sync::atomic::Ordering::Relaxed) {
                f64::INFINITY
            } else {
                self.started.elapsed().as_secs_f64() * 1000.0
            }
        }
    }
    fn progress(&mut self, _depth: u8, _nodes: u64, _elapsed_ms: f64) {
        #[cfg(target_arch = "wasm32")]
        unsafe {
            search_progress(_depth as u32, _nodes as f64, _elapsed_ms)
        }
    }
}
fn process(input: &[u8], inspect: bool) -> Result<Vec<u8>, String> {
    let request: Request = serde_json::from_slice(input).map_err(|error| error.to_string())?;
    request.profile.validate()?;
    let (position, names) = wire::decode(&request.state)?;
    if inspect {
        serialize(&wire::inspect(&position, &names, &request.profile))
    } else {
        serialize(&wire::result(
            search::search(
                &position,
                &names,
                request.profile,
                request.seed,
                &request.position_history,
                &mut WorkerHost::new(),
            ),
            &names,
        ))
    }
}
fn serialize(value: &impl Serialize) -> Result<Vec<u8>, String> {
    serde_json::to_vec(value).map_err(|error| error.to_string())
}

// The ABI owns each allocation until the caller releases exactly the returned (pointer, length).
// One JSON request and one JSON result cross the boundary; recursive search stays entirely in Rust.
#[no_mangle]
pub extern "C" fn engine_alloc(length: u32) -> u32 {
    Box::into_raw(vec![0u8; length as usize].into_boxed_slice()) as *mut u8 as u32
}
/// # Safety
/// `pointer` and `length` must be an outstanding buffer returned by this module, exactly once.
#[no_mangle]
pub unsafe extern "C" fn engine_free(pointer: u32, length: u32) {
    let slice = std::ptr::slice_from_raw_parts_mut(pointer as *mut u8, length as usize);
    unsafe {
        drop(Box::from_raw(slice));
    }
}
unsafe fn call(pointer: u32, length: u32, inspect: bool) -> u64 {
    let input = unsafe { std::slice::from_raw_parts(pointer as *const u8, length as usize) };
    let output = process(input, inspect).unwrap_or_else(|error| {
        serde_json::to_vec(&serde_json::json!({ "error": error })).unwrap()
    });
    let length = output.len() as u32;
    let pointer = Box::into_raw(output.into_boxed_slice()) as *mut u8 as u32;
    ((pointer as u64) << 32) | length as u64
}
/// # Safety
/// Input must refer to a live readable allocation in this module's memory for the whole call.
#[no_mangle]
pub unsafe extern "C" fn engine_search(pointer: u32, length: u32) -> u64 {
    unsafe { call(pointer, length, false) }
}
/// # Safety
/// Same input contract as `engine_search`. Exposes rules and evaluation for cross-language checks.
#[no_mangle]
pub unsafe extern "C" fn engine_inspect(pointer: u32, length: u32) -> u64 {
    unsafe { call(pointer, length, true) }
}
#[no_mangle]
pub extern "C" fn engine_rules_version() -> u32 {
    model::RULES_VERSION
}

// Unity Editor/native ABI: the same JSON request/response and search implementation.
// WASM keeps its existing 32-bit owned-buffer ABI and Worker execution unchanged.
#[cfg(not(target_arch = "wasm32"))]
static NATIVE_CANCEL: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn azarashi_cancel() {
    NATIVE_CANCEL.store(true, std::sync::atomic::Ordering::Relaxed);
}
/// # Safety
/// Input must remain readable for `length` bytes. Release the returned C string with azarashi_free.
#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub unsafe extern "C" fn azarashi_process(pointer: *const u8, length: usize, inspect: bool) -> *mut std::ffi::c_char {
    if !inspect { NATIVE_CANCEL.store(false, std::sync::atomic::Ordering::Relaxed); }
    let input = unsafe { std::slice::from_raw_parts(pointer, length) };
    let output = process(input, inspect).unwrap_or_else(|error| {
        serde_json::to_vec(&serde_json::json!({ "error": error })).unwrap()
    });
    std::ffi::CString::new(output).unwrap().into_raw()
}
/// # Safety
/// `pointer` must be a live string returned by azarashi_process and released exactly once.
#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub unsafe extern "C" fn azarashi_free(pointer: *mut std::ffi::c_char) {
    if !pointer.is_null() { drop(unsafe { std::ffi::CString::from_raw(pointer) }); }
}

#[cfg(test)]
mod tests;
