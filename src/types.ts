export type SelectedCodeContext = {
  workspaceName: string;
  fileName: string;
  filePath: string;
  language: string;
  selectedText: string;
  surroundingText?: string;
  startLine: number;
  endLine: number;
  characterCount: number;
  timestamp: number;
};

export type SessionState = {
  status: 'idle' | 'starting' | 'live' | 'stopping' | 'error';
  channel?: string;
  token?: string;       // agent RTC token (kept for back-compat)
  uid?: string;         // agent RTC uid (kept for back-compat)
  agentId?: string;
  agentUid?: string;    // agent UID for transcript attribution in the webview
  message?: string;
  // In-panel RTC credentials — sent to the webview so it can join the channel directly
  appId?: string;
  clientToken?: string; // RTC token for the browser client (uid = 1)
  clientUid?: number;   // numeric RTC UID for the browser client
  rtmToken?: string;    // RTM token for live transcript subscription
};

export type SessionMode = 'cascading' | 'realtime';

export type SttProviderId =
  | 'ares'
  | 'assemblyai'
  | 'amazon'
  | 'deepgram'
  | 'google'
  | 'microsoft'
  | 'openai'
  | 'sarvam'
  | 'speechmatics';

export type LlmProviderId =
  | 'amazon-bedrock'
  | 'azure-openai'
  | 'anthropic'
  | 'dify'
  | 'gemini'
  | 'vertex-ai'
  | 'groq'
  | 'openai'
  | 'custom';

export type TtsProviderId =
  | 'amazon'
  | 'cartesia'
  | 'deepgram'
  | 'elevenlabs'
  | 'fish-audio'
  | 'google'
  | 'hume'
  | 'microsoft'
  | 'minimax'
  | 'murf'
  | 'openai'
  | 'rime'
  | 'sarvam';

export type MllmProviderId =
  | 'openai-realtime'
  | 'gemini-live'
  | 'vertex-ai-live'
  | 'xai-grok';

export type AvatarProviderId =
  | 'akool'
  | 'anam'
  | 'generic'
  | 'liveavatar'
  | 'heygen';

export type ProviderSelection<T extends string = string> = {
  provider: T;
  fields: Record<string, string>;
};

export type ModelConfig = {
  mode: SessionMode;
  avatarEnabled?: boolean;
  stt?: ProviderSelection<SttProviderId>;
  llm?: ProviderSelection<LlmProviderId>;
  tts?: ProviderSelection<TtsProviderId>;
  mllm?: ProviderSelection<MllmProviderId>;
  avatar?: ProviderSelection<AvatarProviderId>;
};

export type StartSessionMessage = {
  type: 'start-session';
  action?: QuickActionId;
  prompt?: string;
  modelConfig?: ModelConfig;
};

export type QuickActionId = 'explain' | 'find-bugs' | 'refactor' | 'tests' | 'summarize';
