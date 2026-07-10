# Agora Mentor VS Code Extension

Agora Mentor is a VS Code extension for voice and text chat sessions with an AI mentor around the code you have selected. It builds a prompt from the current file, selection, and nearby context, then lets you talk or type to a live AI agent — all without leaving VS Code.

## What It Is

This extension is language-agnostic and works with any codebase. The prompt is derived from the current editor selection plus surrounding context, so it can be used for explanations, debugging, refactors, tests, or general review. You can interact with the agent by voice (using a browser companion window) or by text chat entirely within the VS Code panel.

## How It Works

### Text chat (no mic required)

1. Select code in the editor or place the cursor on a non-empty line.
2. Open the Agora Mentor panel or use `Agora Mentor: Ask About Selection`.
3. Pick a focus action and adjust the model stack if needed.
4. Click **Open Chat** to start a text-only session.
5. Type in the chat box and press **Enter** (or click Send) to talk to the AI Mentor.
6. The full conversation history persists for the duration of the session.

### Voice session

1. Follow steps 1–3 above.
2. Click **Open Mic in Browser** to start a voice session.
3. A companion browser window opens for microphone input and agent audio.
4. The live transcript streams back to the panel in real time.

## Branding And UI

The panel uses Agora branding pulled from the Next.js quickstart logo mark. The header, status pill, and card surfaces are styled to match the Agora visual language more closely, while keeping the extension shell lightweight.

## Model Flow

The model section is split into collapsible provider groups so the panel stays compact.

- `cascading` mode uses separate STT, LLM, and TTS providers.
- `realtime` mode uses an MLLM / realtime speech model.
- Provider fields appear only when a model needs them.
- If a provider requires an API key or similar secret, the matching input field is shown.

### Default selections

By default, the extension uses the managed Agora stack so it works without changing the model picker:

- STT: `Deepgram` with `nova-3`
- LLM: `OpenAI` with `gpt-4o-mini`
- TTS: `MiniMax` with `speech_2_6_turbo`
- Realtime MLLM: `OpenAI Realtime` with `gpt-4o-realtime-preview`
- Avatar: off

### Working providers (v0.1)

The following Agora-managed providers are active and fully supported:

| Family | Provider |
|---|---|
| STT | Deepgram |
| LLM | OpenAI |
| TTS | MiniMax |
| Realtime MLLM | OpenAI Realtime |

All other providers shown in the model picker are labelled **Coming Soon** and are disabled. The start button will not activate until all selected providers are available.

## Session Flow

The extension keeps the browser companion and the VS Code panel in sync through Agora tokens and RTM events.

- The extension host creates the session and mints the client tokens.
- The webview shows the transcript and session controls.
- The browser companion can be used to open the mic and listen to agent audio.
- The transcript appears as assistant and user turns when the RTM stream is available.

## Configuration

Set these values in VS Code settings:

- `agoraMentor.appId`
- `agoraMentor.appCertificate`
- `agoraMentor.agentUid`
- `agoraMentor.geofence`
- `agoraMentor.customerId` optional, enables Basic Auth for the REST call
- `agoraMentor.customerSecret` optional, works with `customerId`

## Commands

- `Agora Mentor: Open Panel`
- `Agora Mentor: Ask About Selection`
- `Agora Mentor: Start Session`
- `Agora Mentor: Stop Session`
- `Agora Mentor: Open Companion Client`

## Development

1. Install dependencies with `pnpm install`.
2. Run `pnpm run watch` to start esbuild in watch mode.
3. Press `F5` in VS Code to launch the extension host.
4. Run `pnpm run compile` for a one-shot build.
5. Run `pnpm run typecheck` to verify types without emitting files.
6. Run `pnpm run package` to produce a `.vsix` file ready for upload.

## Troubleshooting

- **Transcript empty (voice):** Keep the browser companion window open; the transcript streams via Agora RTM.
- **Chat not responding:** Confirm the session started (status pill shows "live") and the chat input is enabled. If it times out, start a new chat session.
- **Browser mic silent:** Click the mic control in the companion window after the session starts.
- **Session won't stop:** Use `Agora Mentor: Stop Session` from the command palette and wait for idle.
- **Credential errors:** Verify `App ID`, `App Certificate`, and optional REST credentials in Settings.
