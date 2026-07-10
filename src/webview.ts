import * as vscode from 'vscode';
import type { SelectedCodeContext } from './types';

type ModelFieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  inputType?: 'text' | 'number';
  help?: string;
};

type ProviderSpec = {
  id: string;
  label: string;
  fields: ModelFieldSpec[];
  note?: string;
};

type ModelFamilySpec = {
  label: string;
  providers: ProviderSpec[];
};

const AGORA_LOGO_MARK = `
<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M24.9924 36.0241C22.81 36.0241 20.6766 35.3775 18.862 34.1662C17.0474 32.9548 15.6331 31.2331 14.798 29.2187C13.9628 27.2043 13.7443 24.9878 14.17 22.8493C14.5958 20.7109 15.6467 18.7466 17.1899 17.2048C18.7331 15.6631 20.6992 14.6131 22.8397 14.1878C24.9802 13.7624 27.1988 13.9807 29.2151 14.8151C31.2314 15.6495 32.9547 17.0625 34.1672 18.8754C35.3797 20.6883 36.0268 22.8196 36.0268 25C36.0239 27.9229 34.8604 30.7251 32.7917 32.7919C30.7229 34.8587 27.918 36.0211 24.9924 36.0241ZM37.8416 8.93956L37.6736 9.1634L37.5056 9.38724L37.2815 9.21936L37.0687 9.05148C34.5373 7.14076 31.5875 5.85883 28.4626 5.31148C25.3376 4.76414 22.1272 4.96708 19.0963 5.90355C16.0653 6.84003 13.3007 8.48318 11.0306 10.6974C8.76056 12.9117 7.05008 15.6335 6.04036 18.6383C5.03063 21.6431 4.75062 24.8447 5.22343 27.9789C5.69624 31.1131 6.90831 34.0901 8.75962 36.6641C10.6109 39.2381 13.0484 41.3354 15.8708 42.7828C18.6933 44.2303 21.8198 44.9864 24.9924 44.9888C29.356 45.0014 33.6015 43.5732 37.0687 40.9261L37.2815 40.7694L37.5056 40.5904L37.6736 40.8254L37.8416 41.0492C38.5966 42.0901 39.5544 42.9677 40.6575 43.6293C41.7606 44.2909 42.9862 44.7229 44.2606 44.8993L45 45V5L44.2606 5.10073C42.9873 5.27635 41.7624 5.70686 40.6595 6.36647C39.5565 7.02608 38.5981 7.90124 37.8416 8.93956Z" fill="#00C2FF"/>
</svg>`;

const DEFAULT_MODEL_CONFIG = {
  mode: 'cascading',
  avatarEnabled: false,
  stt: {
    provider: 'deepgram',
    fields: {
      model: 'nova-3',
      language: 'en',
      smartFormat: 'true',
      punctuation: 'true',
    },
  },
  llm: {
    provider: 'openai',
    fields: {
      model: 'gpt-4o-mini',
      temperature: '0.7',
      topP: '0.95',
      maxTokens: '1024',
    },
  },
  tts: {
    provider: 'minimax',
    fields: {
      model: 'speech_2_6_turbo',
      voiceId: 'English_captivating_female1',
      groupId: 'default',
      url: 'wss://api.uw.minimax.io/ws/v1/t2a_v2',
    },
  },
  mllm: {
    provider: 'openai-realtime',
    fields: {
      model: 'gpt-4o-realtime-preview',
    },
  },
} as const;

const MODEL_UI_SPEC: Record<string, ModelFamilySpec> = {
  stt: {
    label: 'Speech-to-Text',
    providers: [
      { id: 'deepgram', label: 'Deepgram', fields: [
        { key: 'apiKey', label: 'API key', secret: true, placeholder: 'Optional for managed nova-3' },
        { key: 'model', label: 'Model', placeholder: 'nova-3' },
        { key: 'language', label: 'Language', placeholder: 'en' },
        { key: 'smartFormat', label: 'Smart format', placeholder: 'true', help: 'true or false' },
        { key: 'punctuation', label: 'Punctuation', placeholder: 'true', help: 'true or false' },
      ] },
      { id: 'ares', label: 'ARES', fields: [
        { key: 'language', label: 'Language', placeholder: 'en' },
      ] },
      { id: 'assemblyai', label: 'AssemblyAI', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'language', label: 'Language', placeholder: 'en' },
      ] },
      { id: 'amazon', label: 'Amazon Transcribe', fields: [
        { key: 'accessKey', label: 'Access key', secret: true },
        { key: 'secretKey', label: 'Secret key', secret: true },
        { key: 'region', label: 'Region', placeholder: 'us-east-1' },
        { key: 'language', label: 'Language', placeholder: 'en-US' },
      ] },
      { id: 'google', label: 'Google', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'language', label: 'Language', placeholder: 'en-US' },
      ] },
      { id: 'microsoft', label: 'Microsoft Azure', fields: [
        { key: 'key', label: 'Key', secret: true },
        { key: 'region', label: 'Region', placeholder: 'eastus' },
        { key: 'language', label: 'Language', placeholder: 'en-US' },
      ] },
      { id: 'openai', label: 'OpenAI', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'whisper-1' },
        { key: 'language', label: 'Language', placeholder: 'en' },
      ] },
      { id: 'sarvam', label: 'Sarvam', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'language', label: 'Language', placeholder: 'en' },
        { key: 'model', label: 'Model', placeholder: 'saaras:v1' },
      ] },
      { id: 'speechmatics', label: 'Speechmatics', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'language', label: 'Language', placeholder: 'en' },
        { key: 'model', label: 'Model', placeholder: 'enhanced' },
      ] },
    ],
  },
  llm: {
    label: 'Large Language Model',
    providers: [
      { id: 'openai', label: 'OpenAI', fields: [
        { key: 'apiKey', label: 'API key', secret: true, placeholder: 'Optional for managed presets' },
        { key: 'model', label: 'Model', placeholder: 'gpt-4o-mini' },
        { key: 'temperature', label: 'Temperature', inputType: 'number', placeholder: '0.7' },
        { key: 'topP', label: 'Top P', inputType: 'number', placeholder: '0.95' },
        { key: 'maxTokens', label: 'Max tokens', inputType: 'number', placeholder: '1024' },
      ] },
      { id: 'azure-openai', label: 'Azure OpenAI', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'gpt-4' },
        { key: 'resourceName', label: 'Resource name', placeholder: 'my-resource' },
        { key: 'deploymentName', label: 'Deployment name', placeholder: 'gpt-4-deployment' },
        { key: 'apiVersion', label: 'API version', placeholder: '2024-08-01-preview' },
      ] },
      { id: 'anthropic', label: 'Anthropic', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'claude-3-5-sonnet-20241022' },
      ] },
      { id: 'gemini', label: 'Google Gemini', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'gemini-2.0-flash' },
      ] },
      { id: 'groq', label: 'Groq', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'llama-3.1-70b-versatile' },
      ] },
      { id: 'vertex-ai', label: 'Vertex AI', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'gemini-2.0-flash' },
        { key: 'projectId', label: 'Project ID', placeholder: 'my-project' },
        { key: 'location', label: 'Location', placeholder: 'us-central1' },
      ] },
      { id: 'amazon-bedrock', label: 'Amazon Bedrock', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'anthropic.claude-3-5-sonnet-20240620-v1:0' },
        { key: 'url', label: 'URL', placeholder: 'https://bedrock-runtime.us-east-1.amazonaws.com' },
      ] },
      { id: 'dify', label: 'Dify', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'url', label: 'URL', placeholder: 'https://api.dify.ai' },
      ] },
      { id: 'custom', label: 'Custom LLM', fields: [
        { key: 'apiKey', label: 'API key', secret: true, placeholder: 'Optional' },
        { key: 'model', label: 'Model', placeholder: 'model-name' },
        { key: 'url', label: 'URL', placeholder: 'https://your-endpoint.example.com' },
        { key: 'vendor', label: 'Vendor hint', placeholder: 'custom' },
      ] },
    ],
  },
  tts: {
    label: 'Text-to-Speech',
    providers: [
      { id: 'minimax', label: 'MiniMax', fields: [
        { key: 'key', label: 'API key', secret: true, placeholder: 'Optional for managed model' },
        { key: 'groupId', label: 'Group ID', placeholder: 'default' },
        { key: 'model', label: 'Model', placeholder: 'speech_2_6_turbo' },
        { key: 'voiceId', label: 'Voice ID', placeholder: 'English_captivating_female1' },
        { key: 'url', label: 'URL', placeholder: 'wss://api.uw.minimax.io/ws/v1/t2a_v2' },
      ] },
      { id: 'openai', label: 'OpenAI', fields: [
        { key: 'apiKey', label: 'API key', secret: true, placeholder: 'Optional for managed tts-1' },
        { key: 'voice', label: 'Voice', placeholder: 'alloy' },
        { key: 'model', label: 'Model', placeholder: 'tts-1' },
      ] },
      { id: 'elevenlabs', label: 'ElevenLabs', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'modelId', label: 'Model ID', placeholder: 'eleven_flash_v2_5' },
        { key: 'voiceId', label: 'Voice ID', placeholder: 'pNInz6obpgDQGcFmaJgB' },
        { key: 'sampleRate', label: 'Sample rate', inputType: 'number', placeholder: '24000' },
      ] },
      { id: 'cartesia', label: 'Cartesia', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'voiceId', label: 'Voice ID', placeholder: 'voice-id-here' },
        { key: 'modelId', label: 'Model ID', placeholder: 'sonic-2' },
      ] },
      { id: 'deepgram', label: 'Deepgram', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'aura-2-thalia-en' },
      ] },
      { id: 'google', label: 'Google', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'voiceName', label: 'Voice name', placeholder: 'en-US-Wavenet-D' },
        { key: 'languageCode', label: 'Language code', placeholder: 'en-US' },
      ] },
      { id: 'amazon', label: 'Amazon Polly', fields: [
        { key: 'accessKey', label: 'Access key', secret: true },
        { key: 'secretKey', label: 'Secret key', secret: true },
        { key: 'region', label: 'Region', placeholder: 'us-east-1' },
        { key: 'voiceId', label: 'Voice ID', placeholder: 'Joanna' },
      ] },
      { id: 'microsoft', label: 'Microsoft Azure', fields: [
        { key: 'key', label: 'Key', secret: true },
        { key: 'region', label: 'Region', placeholder: 'eastus' },
        { key: 'voiceName', label: 'Voice name', placeholder: 'en-US-JennyNeural' },
      ] },
      { id: 'hume', label: 'Hume AI', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'configId', label: 'Config ID', placeholder: 'optional' },
      ] },
      { id: 'murf', label: 'Murf', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'voiceId', label: 'Voice ID', placeholder: 'Ariana' },
        { key: 'style', label: 'Style', placeholder: 'Conversational' },
      ] },
      { id: 'rime', label: 'Rime', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'speaker', label: 'Speaker', placeholder: 'speaker-id' },
        { key: 'modelId', label: 'Model ID', placeholder: 'optional' },
        { key: 'lang', label: 'Language', placeholder: 'en' },
      ] },
      { id: 'fish-audio', label: 'Fish Audio', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'referenceId', label: 'Reference ID', placeholder: 'reference-id' },
      ] },
      { id: 'sarvam', label: 'Sarvam', fields: [
        { key: 'key', label: 'API key', secret: true },
        { key: 'speaker', label: 'Speaker', placeholder: 'anushka' },
        { key: 'targetLanguageCode', label: 'Target language', placeholder: 'en-IN' },
      ] },
    ],
  },
  mllm: {
    label: 'Realtime Speech',
    providers: [
      { id: 'openai-realtime', label: 'OpenAI Realtime', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'gpt-4o-realtime-preview' },
      ] },
      { id: 'gemini-live', label: 'Gemini Live', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'model', label: 'Model', placeholder: 'gemini-live-2.5-flash' },
        { key: 'voice', label: 'Voice', placeholder: 'Aoede' },
        { key: 'instructions', label: 'Instructions', placeholder: 'Optional' },
      ] },
      { id: 'vertex-ai-live', label: 'Gemini Live via Vertex AI', fields: [
        { key: 'model', label: 'Model', placeholder: 'gemini-live-2.5-flash-preview-native-audio-09-2025' },
        { key: 'projectId', label: 'Project ID', placeholder: 'my-project' },
        { key: 'location', label: 'Location', placeholder: 'us-central1' },
        { key: 'adcCredentialsString', label: 'ADC credentials', placeholder: 'JSON credentials string' },
        { key: 'voice', label: 'Voice', placeholder: 'Aoede' },
        { key: 'instructions', label: 'Instructions', placeholder: 'Optional' },
      ] },
      { id: 'xai-grok', label: 'xAI Grok Realtime', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'voice', label: 'Voice', placeholder: 'eve' },
        { key: 'language', label: 'Language', placeholder: 'en' },
        { key: 'sampleRate', label: 'Sample rate', inputType: 'number', placeholder: '24000' },
      ] },
    ],
  },
  avatar: {
    label: 'Avatar',
    providers: [
      { id: 'liveavatar', label: 'LiveAvatar', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'quality', label: 'Quality', placeholder: 'medium' },
        { key: 'agoraUid', label: 'Agora UID', placeholder: 'unique uid' },
        { key: 'avatarId', label: 'Avatar ID', placeholder: 'optional' },
      ], note: 'Use with cascading models only.' },
      { id: 'heygen', label: 'HeyGen', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'quality', label: 'Quality', placeholder: 'medium' },
        { key: 'agoraUid', label: 'Agora UID', placeholder: 'unique uid' },
        { key: 'avatarId', label: 'Avatar ID', placeholder: 'optional' },
      ], note: 'HeyGen is the legacy LiveAvatar name.' },
      { id: 'akool', label: 'Akool', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'avatarId', label: 'Avatar ID', placeholder: 'optional' },
      ] },
      { id: 'anam', label: 'Anam', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'personaId', label: 'Persona ID', placeholder: 'optional' },
      ] },
      { id: 'generic', label: 'Generic Avatar', fields: [
        { key: 'apiKey', label: 'API key', secret: true },
        { key: 'apiBaseUrl', label: 'API base URL', placeholder: 'https://provider.example.com' },
        { key: 'avatarId', label: 'Avatar ID', placeholder: 'avatar-id' },
        { key: 'agoraUid', label: 'Agora UID', placeholder: 'unique uid' },
        { key: 'agoraAppId', label: 'Agora App ID', placeholder: 'optional' },
        { key: 'agoraChannel', label: 'Agora Channel', placeholder: 'optional' },
        { key: 'agoraToken', label: 'Agora Token', placeholder: 'optional' },
      ] },
    ],
  },
};

// ── Public entry point ────────────────────────────────────────────────────────

export function buildHtml(webview: vscode.Webview, sel: SelectedCodeContext | null, rtcSdkUri: string, _rtmSdkUri: string): string {
  const nonce = nid();

  // Serialize selection into a JS literal embedded directly in the <script> block.
  // Arrives synchronously — no postMessage race is possible.
  const selJson = jsonForScript(sel);

  const csp = [
    `default-src 'none'`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    `style-src 'unsafe-inline'`,
    `img-src ${webview.cspSource} data:`,
    `connect-src https: wss:`,
    `media-src *`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Agora Mentor</title>
  ${css()}
  <script src="${rtcSdkUri}"></script>
  <script src="${_rtmSdkUri}"></script>
</head>
<body>
${htmlBody()}
<script nonce="${nonce}">
(function () {
'use strict';

// ── Data from extension (baked into HTML at generation time) ──
var SEL = ${selJson};
var MODEL_SPEC = ${jsonForScript(MODEL_UI_SPEC)};
var DEFAULT_MODEL_CONFIG = ${jsonForScript(DEFAULT_MODEL_CONFIG)};

// ── VS Code API ───────────────────────────────────────────────
var vscode = acquireVsCodeApi();

// ── State ─────────────────────────────────────────────────────
var state = {
  action:  'explain',
  phase:   'idle',
  session: null,
  muted:   false,
  transcript: [],
  inProgress: null,
  modelConfig: clone(DEFAULT_MODEL_CONFIG),
};

// ── DOM helpers ───────────────────────────────────────────────
function $  (id)    { return document.getElementById(id); }
function txt(id, v) { var el = $(id); if (el) el.textContent = v; }

var savedState = typeof vscode.getState === 'function' ? vscode.getState() : null;
if (savedState) {
  state.action = savedState.action || state.action;
  state.phase = savedState.phase || state.phase;
  state.session = savedState.session || state.session;
  state.muted = !!savedState.muted;
  state.transcript = Array.isArray(savedState.transcript) ? savedState.transcript : [];
  state.inProgress = savedState.inProgress || null;
  state.modelConfig = normalizeModelConfig(savedState.modelConfig);
}

function persistState() {
  if (typeof vscode.setState === 'function') {
    vscode.setState({
      action: state.action,
      phase: state.phase,
      session: state.session,
      muted: state.muted,
      transcript: state.transcript,
      inProgress: state.inProgress,
      modelConfig: state.modelConfig,
    });
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeProviderSelection(selection, fallback) {
  var merged = clone(fallback);
  if (!selection || typeof selection !== 'object') return merged;
  if (typeof selection.provider === 'string' && selection.provider) {
    merged.provider = selection.provider;
  }
  if (selection.fields && typeof selection.fields === 'object') {
    merged.fields = Object.assign({}, merged.fields, selection.fields);
  }
  return merged;
}

function normalizeModelConfig(config) {
  var src = config && typeof config === 'object' ? config : {};
  return {
    mode: src.mode === 'realtime' ? 'realtime' : 'cascading',
    avatarEnabled: !!src.avatarEnabled,
    stt: normalizeProviderSelection(src.stt, DEFAULT_MODEL_CONFIG.stt),
    llm: normalizeProviderSelection(src.llm, DEFAULT_MODEL_CONFIG.llm),
    tts: normalizeProviderSelection(src.tts, DEFAULT_MODEL_CONFIG.tts),
    mllm: normalizeProviderSelection(src.mllm, DEFAULT_MODEL_CONFIG.mllm),
    avatar: src.avatar ? normalizeProviderSelection(src.avatar, {
      provider: 'liveavatar',
      fields: { quality: 'medium' },
    }) : undefined,
  };
}

// ── Render ────────────────────────────────────────────────────
function render() {
  var has = SEL && SEL.selectedText;

  txt('sel-code',       has ? SEL.selectedText : 'Select code in the editor, then right-click > Ask About Selection.');
  txt('sel-summary',    has ? SEL.characterCount + ' chars  ' + (SEL.language || '') : 'No selection');
  txt('sel-file',       has ? SEL.fileName : '—');
  txt('sel-lines',      has ? 'L' + (SEL.startLine + 1) + '-' + (SEL.endLine + 1) : '—');
  txt('ws-name',        has ? SEL.workspaceName : '—');
  txt('prompt-preview', has ? buildPrompt() : 'Select code to see the prompt.');

  var pill = $('status-pill');
  if (pill) {
    pill.textContent = { idle: 'Ready', starting: 'Starting', live: 'Live', error: 'Error' }[state.phase] || 'Ready';
    pill.className   = 'pill ' + state.phase;
  }

  var startBtn = $('btn-start');
  var stopBtn  = $('btn-stop');
  if (startBtn) startBtn.disabled = !has || state.phase === 'starting' || state.phase === 'live';
  if (stopBtn)  stopBtn.disabled  = state.phase !== 'live';

  document.querySelectorAll('[data-action]').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-action') === state.action);
  });

  var vp = $('voice-panel');
  if (vp) vp.style.display = state.phase === 'live' ? 'flex' : 'none';
  renderTranscript();
}

function renderModelControls() {
  var root = $('model-config');
  if (!root) return;

  root.innerHTML = '';

  var modeRow = document.createElement('div');
  modeRow.className = 'model-row';

  var modeLabel = document.createElement('label');
  modeLabel.className = 'model-field model-mode';

  var modeTitle = document.createElement('span');
  modeTitle.className = 'model-label';
  modeTitle.textContent = 'Mode';
  modeLabel.appendChild(modeTitle);

  var modeSelect = document.createElement('select');
  modeSelect.id = 'model-mode';
  [
    { value: 'cascading', label: 'Cascading voice' },
    { value: 'realtime', label: 'Realtime speech' },
  ].forEach(function (opt) {
    var o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    modeSelect.appendChild(o);
  });
  modeSelect.value = state.modelConfig.mode;
  modeSelect.addEventListener('change', function () {
    state.modelConfig.mode = modeSelect.value === 'realtime' ? 'realtime' : 'cascading';
    if (state.modelConfig.mode === 'realtime') {
      state.modelConfig.avatarEnabled = false;
    }
    persistState();
    renderModelControls();
  });
  modeLabel.appendChild(modeSelect);

  var modeHelp = document.createElement('p');
  modeHelp.className = 'model-help';
  modeHelp.textContent = state.modelConfig.mode === 'realtime'
    ? 'Realtime mode uses a single MLLM model and skips STT / LLM / TTS.'
    : 'Cascading mode lets you mix STT, LLM, TTS, and optional avatar providers.';

  modeRow.appendChild(modeLabel);
  root.appendChild(modeRow);
  root.appendChild(modeHelp);

  if (state.modelConfig.mode === 'cascading') {
    var avatarToggle = document.createElement('label');
    avatarToggle.className = 'model-field model-toggle';

    var avatarTitle = document.createElement('span');
    avatarTitle.className = 'model-label';
    avatarTitle.textContent = 'Avatar';
    avatarToggle.appendChild(avatarTitle);

    var avatarCheck = document.createElement('input');
    avatarCheck.type = 'checkbox';
    avatarCheck.checked = !!state.modelConfig.avatarEnabled;
    avatarCheck.addEventListener('change', function () {
      state.modelConfig.avatarEnabled = avatarCheck.checked;
      if (state.modelConfig.avatarEnabled && !state.modelConfig.avatar) {
        state.modelConfig.avatar = {
          provider: 'liveavatar',
          fields: { quality: 'medium', apiKey: '', agoraUid: '' },
        };
      }
      persistState();
      renderModelControls();
    });
    avatarToggle.appendChild(avatarCheck);

    var avatarDesc = document.createElement('span');
    avatarDesc.className = 'model-help-inline';
    avatarDesc.textContent = 'Enable only if you want a visual avatar alongside voice.';
    avatarToggle.appendChild(avatarDesc);

    root.appendChild(avatarToggle);
  }

  var families = state.modelConfig.mode === 'realtime'
    ? ['mllm']
    : ['stt', 'llm', 'tts'].concat(state.modelConfig.avatarEnabled ? ['avatar'] : []);

  families.forEach(function (familyKey) {
    root.appendChild(renderFamilySection(familyKey));
  });
}

function renderFamilySection(familyKey) {
  if (familyKey === 'avatar' && !state.modelConfig.avatar) {
    state.modelConfig.avatar = {
      provider: 'liveavatar',
      fields: { quality: 'medium', apiKey: '', agoraUid: '' },
    };
  }
  var familySpec = MODEL_SPEC[familyKey];
  var providerSpec = findProviderSpec(familyKey, state.modelConfig[familyKey].provider);

  var section = document.createElement('details');
  section.className = 'model-family';
  if (familyKey === 'mllm' || (familyKey === 'avatar' && state.modelConfig.avatarEnabled)) {
    section.open = true;
  }

  var summary = document.createElement('summary');
  summary.className = 'model-family-summary';

  var summaryText = document.createElement('div');
  summaryText.className = 'model-family-summary-text';

  var title = document.createElement('h3');
  title.textContent = familyKey === 'mllm' ? 'Which MLLM?' : familySpec.label;
  summaryText.appendChild(title);

  var subtitle = document.createElement('p');
  subtitle.textContent = providerSpec.label + defaultSuffixForProvider(familyKey, providerSpec.id);
  summaryText.appendChild(subtitle);

  var chevron = document.createElement('span');
  chevron.className = 'model-family-chevron';
  chevron.textContent = '▾';

  summary.appendChild(summaryText);
  summary.appendChild(chevron);
  section.appendChild(summary);

  var body = document.createElement('div');
  body.className = 'model-family-body';

  var providerLabel = document.createElement('label');
  providerLabel.className = 'model-field model-provider';

  var providerTitle = document.createElement('span');
  providerTitle.className = 'model-label';
  providerTitle.textContent = 'Provider';
  providerLabel.appendChild(providerTitle);

  var providerSelect = document.createElement('select');
  providerSelect.setAttribute('data-family', familyKey);
  familySpec.providers.forEach(function (provider) {
    var opt = document.createElement('option');
    opt.value = provider.id;
    opt.textContent = provider.label;
    providerSelect.appendChild(opt);
  });

  providerSelect.value = state.modelConfig[familyKey].provider;
  providerSelect.addEventListener('change', function () {
    var nextProvider = providerSelect.value;
    state.modelConfig[familyKey].provider = nextProvider;
    state.modelConfig[familyKey].fields = defaultFieldsForProvider(familyKey, nextProvider);
    persistState();
    renderModelControls();
  });
  providerLabel.appendChild(providerSelect);
  body.appendChild(providerLabel);

  var note = providerSpec.note;
  if (note) {
    var noteEl = document.createElement('p');
    noteEl.className = 'model-help';
    noteEl.textContent = note;
    body.appendChild(noteEl);
  }

  if (familyKey === 'mllm') {
    var mllmHint = document.createElement('p');
    mllmHint.className = 'model-help';
    mllmHint.textContent = 'Pick one realtime model. OpenAI Realtime is selected by default.';
    body.appendChild(mllmHint);
  }

  var fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'model-fields';
  providerSpec.fields.forEach(function (fieldSpec) {
    fieldsWrap.appendChild(renderModelField(familyKey, fieldSpec));
  });

  body.appendChild(fieldsWrap);
  section.appendChild(body);
  return section;
}

function renderModelField(familyKey, fieldSpec) {
  var label = document.createElement('label');
  label.className = 'model-field';

  var title = document.createElement('span');
  title.className = 'model-label';
  title.textContent = fieldSpec.label + (fieldSpec.secret ? ' *' : '');
  label.appendChild(title);

  var input = document.createElement('input');
  input.type = fieldSpec.secret ? 'password' : (fieldSpec.inputType || 'text');
  input.placeholder = fieldSpec.placeholder || '';
  input.value = String(state.modelConfig[familyKey].fields[fieldSpec.key] || '');
  input.setAttribute('data-family', familyKey);
  input.setAttribute('data-key', fieldSpec.key);
  input.addEventListener('input', function () {
    setModelField(familyKey, fieldSpec.key, input.value);
  });
  label.appendChild(input);

  if (fieldSpec.help) {
    var help = document.createElement('span');
    help.className = 'model-help-inline';
    help.textContent = fieldSpec.help;
    label.appendChild(help);
  }

  return label;
}

function findProviderSpec(familyKey, providerId) {
  var providers = MODEL_SPEC[familyKey].providers;
  for (var i = 0; i < providers.length; i++) {
    if (providers[i].id === providerId) return providers[i];
  }
  return providers[0];
}

function defaultFieldsForProvider(familyKey, providerId) {
  var spec = findProviderSpec(familyKey, providerId);
  var fields = {};
  spec.fields.forEach(function (fieldSpec) {
    fields[fieldSpec.key] = '';
  });
  return fields;
}

function defaultSuffixForProvider(familyKey, providerId) {
  if (familyKey === 'stt' && providerId === 'deepgram') return ' · Agora managed default';
  if (familyKey === 'llm' && providerId === 'openai') return ' · Agora managed default';
  if (familyKey === 'tts' && providerId === 'minimax') return ' · Agora managed default';
  if (familyKey === 'mllm' && providerId === 'openai-realtime') return ' · Agora realtime default';
  return '';
}

function setModelField(familyKey, key, value) {
  state.modelConfig[familyKey].fields[key] = value;
  persistState();
}

// ── Prompt ────────────────────────────────────────────────────
function buildPrompt() {
  var s = SEL;
  if (!s) return '';
  var hints = {
    'explain':   'Explain what this code does, its control flow, and any tradeoffs.',
    'find-bugs': 'Identify bugs, edge cases, and reliability risks.',
    'refactor':  'Suggest a cleaner, more maintainable version.',
    'tests':     'Propose tests that protect the current behaviour.',
    'summarize': 'Summarise the code in concise developer-friendly language.',
  };
  var lines = [
    'You are a senior software mentor. Be practical and precise.',
    '',
    'Task: ' + (hints[state.action] || hints['explain']),
    '',
    'Workspace: ' + s.workspaceName,
    'File: '      + s.filePath,
    'Language: '  + s.language,
    'Lines '      + (s.startLine + 1) + '-' + (s.endLine + 1),
    '',
    'Selected code:',
    s.selectedText.trim(),
  ];
  if (s.surroundingText) lines.push('', 'Surrounding context:', s.surroundingText.trim());
  return lines.join('\\n');
}

// ── Buttons ───────────────────────────────────────────────────
document.querySelectorAll('[data-action]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    state.action = btn.getAttribute('data-action');
    document.querySelectorAll('[data-action]').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
    persistState();
    render();
  });
});

  if ($('btn-start')) {
  $('btn-start').addEventListener('click', function () {
    vscode.postMessage({
      type: 'start-session',
      action: state.action,
      prompt: buildPrompt(),
      modelConfig: state.modelConfig,
    });
  });
}

if ($('btn-stop')) {
  $('btn-stop').addEventListener('click', function () {
    leaveRtc();
    vscode.postMessage({ type: 'stop-session' });
  });
}

if ($('btn-copy')) {
  $('btn-copy').addEventListener('click', function () {
    var p = buildPrompt();
    if (!p) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(p).then(function () {
        vscode.postMessage({ type: 'toast', text: 'Prompt copied.' });
      });
    }
  });
}

if ($('btn-mute')) {
  $('btn-mute').addEventListener('click', function () { toggleMute(); });
}

if ($('btn-browser-mic')) {
  $('btn-browser-mic').addEventListener('click', function () {
    vscode.postMessage({ type: 'open-companion', session: state.session });
  });
}

// ── Messages from extension ───────────────────────────────────
window.addEventListener('message', function (ev) {
  var msg = ev.data;
  switch (msg.type) {
    case 'session-phase':
      state.phase = msg.phase;
      txt('status-text', msg.text || '');
      persistState();
      render();
      break;
    case 'session-live':
      state.phase   = 'live';
      state.session = msg.session;
      state.transcript = [];
      state.inProgress = null;
      txt('status-text', 'Voice session live — speak into your microphone.');
      persistState();
      render();
      joinRtc(msg.session);
      break;
    case 'session-error':
      state.phase = 'error';
      txt('status-text', msg.text || 'Something went wrong.');
      persistState();
      render();
      break;
    case 'transcript':
      appendTranscript(msg.role, msg.text, msg.turnId, msg.isFinal);
      break;
  }
});

// ── Transcript ────────────────────────────────────────────────
function appendTranscript(role, text, turnId, isFinal) {
  if (!text) return;

  var entry = {
    role: role || 'system',
    text: String(text),
    turnId: turnId != null ? String(turnId) : null,
    isFinal: !!isFinal,
    createdAt: Date.now(),
  };

  var transcript = state.transcript.slice();
  var found = false;
  for (var i = 0; i < transcript.length; i++) {
    var current = transcript[i];
    if (current && current.role === entry.role && String(current.turnId || 'x') === String(entry.turnId || 'x')) {
      transcript[i] = entry;
      found = true;
      break;
    }
  }

  if (entry.role === 'assistant') {
    if (entry.isFinal) {
      if (!found) transcript.push(entry);
      if (state.inProgress && String(state.inProgress.turnId || 'x') === String(entry.turnId || 'x')) {
        state.inProgress = null;
      }
    } else {
      state.inProgress = entry;
      if (!found) {
        // Keep the live turn separate from completed history.
      }
    }
  } else {
    if (!found) transcript.push(entry);
    state.inProgress = null;
  }

  state.transcript = transcript;
  persistState();
  renderTranscript();
}

function renderTranscript() {
  var list = $('transcript-list');
  if (!list) return;

  list.innerHTML = '';

  var entries = state.transcript.slice();
  if (state.inProgress) entries.push(state.inProgress);

  if (entries.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Your conversation will appear here once a session starts.';
    list.appendChild(empty);
    return;
  }

  entries.forEach(function (entry) {
    var el = document.createElement('div');
    el.className = 'transcript-entry ' + (entry.role || 'system');

    var rl = document.createElement('span');
    rl.className = 'role';
    rl.textContent = entry.role === 'assistant' ? 'AI' : (entry.role === 'user' ? 'You' : 'System');

    var meta = document.createElement('span');
    meta.className = 'time';
    meta.textContent = entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

    var p = document.createElement('p');
    p.textContent = entry.text;

    el.appendChild(rl);
    if (meta.textContent) el.appendChild(meta);
    el.appendChild(p);
    list.appendChild(el);
  });

  list.scrollTop = list.scrollHeight;
}

// ── Agora RTC/RTM ─────────────────────────────────────────────
var rtcClient = null, rtmClient = null, localTrack = null, volTimer = null, rtcJoined = false, rtmJoined = false;

// Chunked stream-message assembly: messages split across multiple packets
// arrive as "seq|total|turn_id|chunk". Reassemble before parsing JSON.
var chunkBuffers = {};

function handleStreamMessage(uid, stream) {
  try {
    var text = new TextDecoder('utf-8').decode(stream);
    var pipes = (text.match(/\\|/g) || []).length;
    if (pipes === 3) {
      // Chunked format: "seq|total|key|payload"
      var parts = text.split('|');
      var seq = parseInt(parts[0], 10);
      var total = parseInt(parts[1], 10);
      var key = parts[2];
      var payload = parts[3];
      if (!chunkBuffers[key]) chunkBuffers[key] = { parts: {}, total: total };
      chunkBuffers[key].parts[seq] = payload;
      if (Object.keys(chunkBuffers[key].parts).length === total) {
        var assembled = '';
        for (var i = 0; i < total; i++) assembled += chunkBuffers[key].parts[i];
        delete chunkBuffers[key];
        parseAndRenderMessage(uid, assembled);
      }
      return;
    }
    parseAndRenderMessage(uid, text);
  } catch (_) {}
}

function parseAndRenderMessage(uid, text) {
  try {
    var msg = JSON.parse(text);
    var obj = msg.object || '';
    if (obj === 'assistant.transcription') {
      if (msg.text) appendTranscript('assistant', msg.text, msg.turn_id, !!msg.final);
    } else if (obj === 'user.transcription') {
      if (msg.text && msg.final) appendTranscript('user', msg.text, msg.turn_id, true);
    }
  } catch (_) {}
}

function joinRtc(session) {
  if (typeof AgoraRTC === 'undefined') {
    txt('status-text', 'RTC SDK not loaded.');
    return;
  }
  AgoraRTC.setLogLevel(4);
  rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  rtcJoined = false;

  // Subscribe to agent audio when it publishes
  rtcClient.on('user-published', function (user, mediaType) {
    rtcClient.subscribe(user, mediaType).then(function () {
      if (mediaType === 'audio' && user.audioTrack) user.audioTrack.play();
    });
  });

  // Transcripts arrive as RTC stream-messages (binary → UTF-8 JSON)
  rtcClient.on('stream-message', handleStreamMessage);

  if (session.rtmToken && session.channel) {
    joinRtm(session).catch(function (e) {
      txt('status-text', 'RTM transcript unavailable: ' + e.message);
    });
  }

  // Join channel first, then try mic (mic failure is non-fatal)
  rtcClient.join(session.appId, session.channel, session.clientToken, session.clientUid)
    .then(function () {
      rtcJoined = true;
      txt('status-text', 'Connected — speak into your microphone.');
      persistState();
      return AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'speech_low_quality' })
        .then(function (track) {
          localTrack = track;
          return rtcClient.publish(localTrack).then(function () {
            volTimer = setInterval(function () {
              if (localTrack && !state.muted) setBar('mic-bar', localTrack.getVolumeLevel());
            }, 100);
          });
        })
        .catch(function () {
          txt('status-text', 'Agent is speaking. Click "Open Mic in Browser" to talk back.');
          var btn = $('btn-browser-mic');
          if (btn) btn.style.display = 'inline-block';
        });
    })
    .catch(function (e) { txt('status-text', 'RTC join failed: ' + e.message); });
}

async function joinRtm(session) {
  if (typeof AgoraRTM === 'undefined' || !AgoraRTM.RTM) return;
  rtmClient = new AgoraRTM.RTM(session.appId, String(session.clientUid));
  await rtmClient.login({ token: session.rtmToken });
  await rtmClient.subscribe(session.channel);
  rtmJoined = true;
  rtmClient.addEventListener('message', handleRtmMessage);
}

function handleRtmMessage(event) {
  try {
    var payload = event && event.message;
    var text = typeof payload === 'string' ? payload : new TextDecoder('utf-8').decode(payload);
    var msg = JSON.parse(text);
    var obj = msg.object || '';
    if (obj === 'assistant.transcription') {
      if (msg.text) appendTranscript('assistant', msg.text, msg.turn_id, !!msg.final);
    } else if (obj === 'user.transcription') {
      if (msg.text && msg.final) appendTranscript('user', msg.text, msg.turn_id, true);
    }
  } catch (_) {}
}

function leaveRtc() {
  clearInterval(volTimer); volTimer = null;
  if (localTrack)  { localTrack.stop(); localTrack.close(); localTrack = null; }
  if (rtcClient && rtcJoined) { rtcClient.leave(); rtcJoined = false; rtcClient = null; }
  if (rtmClient && rtmJoined) {
    try { rtmClient.removeEventListener('message', handleRtmMessage); } catch (_) {}
    try { rtmClient.logout(); } catch (_) {}
    rtmJoined = false;
    rtmClient = null;
  }
  chunkBuffers = {};
  state.inProgress = null;
  persistState();
  renderTranscript();
}

function toggleMute() {
  state.muted = !state.muted;
  if (localTrack) localTrack.setEnabled(!state.muted);
  txt('btn-mute', state.muted ? 'Unmute' : 'Mute');
  persistState();
}

function setBar(id, level) {
  var el = $(id);
  if (el) el.style.width = Math.round(level * 100) + '%';
}

// ── Boot ──────────────────────────────────────────────────────
renderModelControls();
render();

}());
</script>
</body>
</html>`;
}

// ── HTML body ─────────────────────────────────────────────────────────────────

function htmlBody(): string {
  return `
<div class="layout">

  <header class="header">
    <div class="brand">
      <span class="logo" aria-hidden="true">${AGORA_LOGO_MARK}</span>
      <div class="brand-copy">
        <span class="brand-name">Agora Mentor</span>
        <span class="brand-subtitle">Conversational AI</span>
      </div>
    </div>
    <span class="pill" id="status-pill">Ready</span>
  </header>

  <section class="card">
    <div class="card-header">
      <h2>Selected Code</h2>
      <span class="meta-row">
        <span id="sel-file">—</span> &nbsp;·&nbsp;
        <span id="sel-lines">—</span> &nbsp;·&nbsp;
        <span id="ws-name">—</span>
      </span>
    </div>
    <div class="code-label"><span id="sel-summary">No selection</span></div>
    <pre class="code-block" id="sel-code">Select code in the editor, then right-click → Ask About Selection.</pre>
  </section>

  <section class="card">
    <div class="card-header"><h2>Focus</h2></div>
    <div class="action-row">
      <button data-action="explain"   class="action-btn active">Explain</button>
      <button data-action="find-bugs" class="action-btn">Find Bugs</button>
      <button data-action="refactor"  class="action-btn">Refactor</button>
      <button data-action="tests"     class="action-btn">Tests</button>
      <button data-action="summarize" class="action-btn">Summarize</button>
    </div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2>Models</h2>
      <span class="meta-row">Choose the Agora provider stack you want to run</span>
    </div>
    <div class="model-config" id="model-config"></div>
  </section>

  <section class="card">
    <div class="card-header">
      <h2>Prompt Preview</h2>
      <button class="btn-ghost" id="btn-copy">Copy</button>
    </div>
    <pre class="code-block small" id="prompt-preview">Select code to see the prompt.</pre>
  </section>

  <section class="card">
    <div class="card-header"><h2>Session</h2></div>
    <div class="action-row">
      <button class="btn-primary" id="btn-start">&#9654; Start Voice Session</button>
      <button class="btn-danger"  id="btn-stop" disabled>&#9632; Stop</button>
    </div>
    <p class="status-text" id="status-text">Ready to start.</p>
    <div id="voice-panel" style="display:none" class="voice-panel">
      <div class="voice-row">
        <span class="avatar">&#127908;</span>
        <div class="vol-track"><div class="vol-bar" id="mic-bar"></div></div>
        <span class="avatar">&#129302;</span>
      </div>
      <div class="action-row" style="padding:6px 0 0">
        <button class="btn-ghost" id="btn-mute">Mute</button>
        <button class="btn-ghost" id="btn-browser-mic" style="display:none">&#127908; Open Mic in Browser</button>
      </div>
    </div>
  </section>

  <section class="card transcript-card">
    <div class="card-header"><h2>Transcript</h2></div>
    <div class="transcript-list" id="transcript-list">
      <p class="empty">Your conversation will appear here once a session starts.</p>
    </div>
  </section>

</div>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function css(): string {
  return `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:var(--vscode-font-family,ui-sans-serif,system-ui,sans-serif);
  font-size:var(--vscode-font-size,13px);
  color:var(--vscode-foreground,#cdd9f0);
  background:var(--vscode-editor-background,#1e1e1e);
  padding:12px;
}
.layout{display:grid;gap:10px}
.header{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;
  background:
    radial-gradient(circle at top left, rgba(0,194,255,.18), transparent 42%),
    linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)),
    var(--vscode-sideBar-background,#252526);
  border-radius:14px;
  border:1px solid rgba(0,194,255,.18);
  box-shadow:0 10px 30px rgba(0,0,0,.22);
}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.logo{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex:0 0 auto}
.logo svg{width:40px;height:40px;display:block;filter:drop-shadow(0 0 10px rgba(0,194,255,.25))}
.brand-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.brand-name{font-weight:800;font-size:14px;letter-spacing:-.01em}
.brand-subtitle{font-size:11px;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:.12em}
.pill{
  font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;
  background:rgba(0,194,255,.12);border:1px solid rgba(0,194,255,.22);color:#7ce7ff;
}
.pill.live    {background:rgba(77,209,122,.14);color:#5ce189;border-color:rgba(77,209,122,.26)}
.pill.starting{background:rgba(255,176,32,.14);color:#ffc14d;border-color:rgba(255,176,32,.26)}
.pill.error   {background:rgba(255,107,122,.14);color:#ff8090;border-color:rgba(255,107,122,.26)}
.card{
  background:
    linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
    var(--vscode-sideBar-background,#252526);
  border:1px solid rgba(255,255,255,.08);
  border-radius:14px;overflow:hidden;
  box-shadow:0 8px 20px rgba(0,0,0,.12);
}
.card-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;
  border-bottom:1px solid var(--vscode-panel-border,rgba(255,255,255,.08));
}
.card-header h2{
  font-size:11px;font-weight:600;text-transform:uppercase;
  letter-spacing:.06em;opacity:.65;
}
.meta-row{font-size:11px;color:var(--vscode-descriptionForeground,#888)}
.code-label{
  padding:5px 12px;font-size:11px;
  color:var(--vscode-descriptionForeground,#888);
  border-bottom:1px solid var(--vscode-panel-border,rgba(255,255,255,.06));
}
.code-block{
  margin:0;padding:12px;
  font-family:var(--vscode-editor-font-family,'SF Mono',Menlo,monospace);
  font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;
  max-height:260px;overflow:auto;
}
.code-block.small{max-height:130px;font-size:11.5px;opacity:.85}
.action-row{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px}
.action-btn{
  appearance:none;border:1px solid rgba(255,255,255,.1);border-radius:6px;
  padding:5px 11px;font-size:12px;font-weight:500;cursor:pointer;
  background:rgba(255,255,255,.05);color:var(--vscode-foreground,#cdd9f0);
}
.action-btn:hover {background:rgba(255,255,255,.1)}
.action-btn.active{background:rgba(124,221,255,.15);border-color:rgba(124,221,255,.4);color:#7cddff}
.btn-primary{
  appearance:none;border:0;border-radius:6px;padding:8px 16px;
  font-size:13px;font-weight:600;cursor:pointer;background:#7cddff;color:#07101d;
}
.btn-primary:hover:not(:disabled){opacity:.88}
.btn-primary:disabled{opacity:.35;cursor:not-allowed}
.btn-danger{
  appearance:none;border:0;border-radius:6px;padding:8px 14px;
  font-size:13px;font-weight:600;cursor:pointer;background:#ff6b7a;color:#fff;
}
.btn-danger:hover:not(:disabled){opacity:.88}
.btn-danger:disabled{opacity:.35;cursor:not-allowed}
.btn-ghost{
  appearance:none;border:1px solid rgba(255,255,255,.1);border-radius:5px;
  padding:4px 10px;font-size:11px;cursor:pointer;background:transparent;
  color:var(--vscode-foreground,#cdd9f0);
}
.btn-ghost:hover{background:rgba(255,255,255,.07)}
.status-text{padding:6px 12px 10px;font-size:12px;color:var(--vscode-descriptionForeground,#888)}
.voice-panel{padding:10px 12px;flex-direction:column;gap:10px}
.voice-row{display:flex;align-items:center;gap:10px}
.avatar{font-size:22px}
.vol-track{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
.vol-bar{height:100%;width:0;background:#7cddff;border-radius:3px;transition:width .08s}
.model-config{padding:10px 12px 12px;display:grid;gap:10px}
.model-row{display:grid;gap:8px}
.model-family{
  border-top:1px solid var(--vscode-panel-border,rgba(255,255,255,.06));
  padding-top:2px;
}
.model-family:first-of-type{border-top:0}
.model-family-summary{
  list-style:none;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 0;
}
.model-family-summary::-webkit-details-marker{display:none}
.model-family-summary-text{display:grid;gap:4px;min-width:0}
.model-family-summary h3{font-size:13px;font-weight:700;color:var(--vscode-foreground,#cdd9f0)}
.model-family-summary p{font-size:11px;line-height:1.4;color:var(--vscode-descriptionForeground,#888)}
.model-family-chevron{font-size:12px;color:var(--vscode-descriptionForeground,#888);transition:transform .16s ease}
.model-family[open] .model-family-chevron{transform:rotate(180deg)}
.model-family-body{display:grid;gap:10px;padding:0 0 12px}
.model-fields{display:grid;gap:8px}
.model-field{display:grid;gap:6px}
.model-toggle{grid-template-columns:1fr auto;align-items:center}
.model-field select,.model-field input{
  appearance:none;
  width:100%;
  border:1px solid rgba(255,255,255,.1);
  border-radius:6px;
  padding:7px 10px;
  background:rgba(255,255,255,.04);
  color:var(--vscode-foreground,#cdd9f0);
  font:inherit;
}
.model-field select:focus,.model-field input:focus{
  outline:none;
  border-color:rgba(124,221,255,.45);
  box-shadow:0 0 0 1px rgba(124,221,255,.14);
}
.model-mode{width:100%}
.model-provider{min-width:230px}
.model-label{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--vscode-descriptionForeground,#888)}
.model-help{font-size:11px;line-height:1.45;color:var(--vscode-descriptionForeground,#888)}
.model-help-inline{font-size:10.5px;line-height:1.35;color:var(--vscode-descriptionForeground,#888);margin-top:-2px}
.transcript-card{}
.transcript-list{padding:10px 12px;display:grid;gap:8px;max-height:280px;overflow:auto}
.empty{font-size:12px;color:var(--vscode-descriptionForeground,#888)}
.transcript-entry{border-radius:6px;padding:8px 10px;background:rgba(255,255,255,.04)}
.transcript-entry.user     {background:rgba(124,221,255,.06)}
.transcript-entry.assistant{background:rgba(160,123,255,.06)}
.transcript-entry .time{
  float:right;
  font-size:10px;
  color:var(--vscode-descriptionForeground,#888);
  margin-top:1px;
}
.transcript-entry .role{
  display:block;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.07em;margin-bottom:4px;
  color:var(--vscode-descriptionForeground,#888);
}
.transcript-entry.user      .role{color:#7cddff}
.transcript-entry.assistant .role{color:#a07bff}
.transcript-entry p{font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
</style>`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function nid(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
