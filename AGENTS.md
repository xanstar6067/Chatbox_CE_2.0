# AGENTS.md

## Repository layout

- The application repository is in `chatbox-main/`; run project commands from that directory.
- **Android work has priority. Start Android investigations in `chatbox-main/android/`.**
- Native Android sources are under `chatbox-main/android/app/src/main/`.
- Capacitor configuration is in `chatbox-main/capacitor.config.ts`.
- Shared web UI sources are under `chatbox-main/src/renderer/`.
- Android build and sync commands are defined in `chatbox-main/package.json`.
- `chatbox-main/release/app/dist/renderer/` and copied Capacitor web assets are generated output. Do not edit them directly.

## Android-first workflow

- For Android issues, inspect the relevant native Android file first, then `capacitor.config.ts`, then only the directly related shared web component.
- Prefer the smallest platform-specific fix that preserves web, desktop, Electron, and iOS behavior.
- Keep `MainActivity` simple unless a verified device or emulator failure requires native inset handling.
- Use current AndroidX inset APIs when custom handling is necessary; do not use deprecated APIs, fixed device offsets, or hard-coded keyboard heights.
- Do not add dependencies, change SDK/package versions, or refactor shared UI without evidence that the task requires it.

## Required web-to-Android synchronization

- **The Android app embeds the compiled shared web UI. Every relevant web/React/CSS change must be made in `chatbox-main/src/renderer/` and synchronized into Android before considering the task complete.**
- Never patch the generated renderer bundle or Android's copied web assets as the source of truth.
- After changing shared web code, Capacitor configuration, plugins, or mobile-facing assets, run from `chatbox-main/`:

  ```powershell
  pnpm.cmd run mobile:sync:android
  ```

- For final Android verification, prefer:

  ```powershell
  pnpm.cmd run mobile:build:android
  ```

- `mobile:sync:android` builds the web renderer with the Android mobile target and then runs `cap sync android`; skipping this step can leave the Android build with stale web code.

## Validation

- Use the narrowest checks that cover the changed files, then run the Android sync/build when applicable.
- For TypeScript or React changes, run `pnpm.cmd run check` and relevant tests; use `pnpm.cmd test -- <path>` for focused Vitest coverage when practical.
- For formatting and lint validation, use `pnpm.cmd run check:biome` or a targeted Biome command. Do not reformat unrelated files.
- Validate keyboard, system-bar, rotation, and other device-dependent behavior on an Android emulator or physical device when the change affects native layout.
- Report commands run, generated files changed by sync, and any validation that still requires a physical device.

## Change discipline

- Preserve existing user changes and avoid unrelated cleanup.
- Do not change visual design or cross-platform behavior unless explicitly requested.
- Keep diffs local and explain why every changed file is necessary.
- Do not commit secrets, signing files, local SDK paths, generated build directories, or device-specific configuration.

## Code review rules

- Flag Android UI changes that modify only generated web assets instead of shared sources; the safe path is to update `src/renderer/` and run `mobile:sync:android`.
- Flag shared web changes that were not synchronized before Android validation, because the APK may otherwise contain stale code.
- Flag hard-coded IME/system-bar offsets and deprecated inset APIs; use platform-provided insets and responsive layout instead.
- Flag Android fixes that unnecessarily change desktop, web, Electron, or iOS behavior.
