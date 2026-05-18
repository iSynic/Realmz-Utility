const APP_COMMANDS: &[&str] = &[
    "pick_scenarios_folder",
    "remember_scenarios_folder",
    "save_exported_map_png",
];

fn main() {
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));

    tauri_build::try_build(attributes).expect("failed to build Tauri application");
}
