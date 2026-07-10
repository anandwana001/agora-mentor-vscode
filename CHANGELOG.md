# Changelog

## [0.1.1] — 2026-07-10

### Changed
- All audio moved to the browser companion; VS Code panel is now config + transcript only.
- Session no longer starts until the user clicks **Open Mic in Browser** — eliminates the double-session problem.
- Both browser close and VS Code Stop button now fully terminate the agent session.
- Onboarding banner shown in the panel when Agora credentials are missing.
- Transcript area is now fully scrollable with no height cap.

### Added
- Non-default providers labelled **Coming Soon** in the model picker (disabled).
- Start button disabled and warning shown when a Coming Soon provider is selected.
- Agora Console link always visible in the panel header.
- esbuild bundler — all dependencies bundled into a single `dist/extension.js`.
- `.vscodeignore` to keep the VSIX lean (no `src/`, `node_modules/`, dev files).

## [0.1.0] — 2025-07-10

### Added
- Initial release of Agora Mentor VS Code extension.
- Voice session panel with Agora RTC/RTM integration.
- Prompt builder from editor selection and surrounding context.
- Cascading model stack (STT + LLM + TTS) with support for 9 STT providers, 9 LLM providers, 14 TTS providers.
- Realtime/MLLM mode with OpenAI Realtime, Gemini Live, Gemini Live via Vertex AI, and xAI Grok Realtime.
- Avatar support (Akool, Anam, Generic Avatar, HeyGen / LiveAvatar).
- Browser companion window for microphone input and live transcript.
- RTM-based transcript streamed to both the VS Code panel and the companion.
- `Agora Mentor: Ask About Selection` context menu item on editor selections.
- Commands: Open Panel, Ask About Selection, Start Session, Stop Session, Open Companion Client.
- VS Code settings for App ID, App Certificate, Agent UID, geofence, and optional REST credentials.
