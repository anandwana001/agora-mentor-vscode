# Agora Mentor VS Code Extension

Agora Mentor is a VS Code extension for starting Agora voice sessions around the code you have selected. It builds a prompt from the current file, selection, and nearby context, then opens a companion UI for live conversation, transcripts, and mic control.

## What It Is

This extension is language-agnostic and works with any codebase. The prompt is derived from the current editor selection plus surrounding context, so it can be used for explanations, debugging, refactors, tests, or general review.

## How It Works

1. Select code in the editor or place the cursor on a non-empty line.
2. Open the Agora Mentor panel or use `Agora Mentor: Ask About Selection`.
3. Pick the focus action: Explain, Find Bugs, Refactor, Tests, or Summarize.
4. Adjust the model stack if you want custom providers.
5. Start the voice session.
6. Use the companion browser window for microphone input when needed.
7. Watch the transcript in the panel and in the browser companion.

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

### Supported provider families

The UI currently exposes provider families for:

- STT: Amazon Transcribe, ARES, AssemblyAI, Deepgram, Google, Microsoft Azure, OpenAI, Sarvam, Speechmatics
- LLM: Amazon Bedrock, Azure OpenAI, Anthropic, Dify, Google Gemini, Google Vertex AI, Groq, OpenAI, xAI Grok
- TTS: Amazon Polly, Cartesia, Deepgram, ElevenLabs, Fish Audio, Google, Hume AI, Microsoft Azure, MiniMax, Murf, OpenAI, Rime, Sarvam, xAI
- Realtime speech models: Google Gemini Live, Gemini Live via Vertex AI, OpenAI Realtime API, xAI Grok Realtime
- Avatar: Akool, Anam, Generic Avatar, LiveAvatar / HeyGen

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

1. Install dependencies.
2. Run `pnpm run watch` or `npm run watch` to compile in watch mode.
3. Press `F5` in VS Code to launch the extension host.
4. Use `pnpm run compile` to do a one-shot TypeScript build.

## Troubleshooting

- If the transcript is empty, start the session from the panel and keep the companion window open.
- If the browser mic seems silent, click the browser mic control after the session starts.
- If the session will not stop cleanly, use `Agora Mentor: Stop Session` from the command palette and wait for the panel to return to idle.
- If you see credential errors, verify `App ID`, `App Certificate`, and optional REST credentials in Settings.
