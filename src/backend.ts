import type { ModelConfig, SelectedCodeContext, SessionState } from './types';

export type AgoraBackendConfig = {
  appId: string;
  appCertificate: string;
  agentUid: string;
  geofence: string;
  customerId?: string;
  customerSecret?: string;
};

export type StartSessionResult = {
  session: SessionState;
  prompt: string;
};

const SESSION_TTL_SECONDS = 3600;
/** Numeric UID reserved for the in-panel browser client. */
const CLIENT_UID = 1;

function defaultModelConfig(): ModelConfig {
  return {
    mode: 'cascading',
    avatarEnabled: false,
    stt: {
      provider: 'deepgram',
      fields: {
        model: 'nova-3',
        language: 'en',
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
      },
    },
  };
}

function isManagedDefaultStack(cfg: ModelConfig): boolean {
  return cfg.mode === 'cascading'
    && !cfg.avatarEnabled
    && cfg.stt?.provider === 'deepgram'
    && cfg.llm?.provider === 'openai'
    && cfg.tts?.provider === 'minimax';
}

function field(
  selection: { fields?: Record<string, string> } | undefined,
  key: string,
  fallback = '',
): string {
  const value = selection?.fields?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberField(
  selection: { fields?: Record<string, string> } | undefined,
  key: string,
  fallback?: number,
): number | undefined {
  const value = field(selection, key, '');
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanField(
  selection: { fields?: Record<string, string> } | undefined,
  key: string,
  fallback = false,
): boolean {
  const value = field(selection, key, '');
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export class AgoraBackendClient {
  private activeAgentId: string | null = null;

  constructor(private readonly config: AgoraBackendConfig) {}

  async startSession(
    prompt: string,
    context: SelectedCodeContext,
    modelConfig?: ModelConfig,
  ): Promise<StartSessionResult> {
    this.assertConfig();

    // Use agora-agents SDK (same as the reference Next.js app) so token generation,
    // auth headers, and request format are handled exactly the way Agora expects.
    const agora = require('agora-agents') as typeof import('agora-agents');
    const {
      AgoraClient,
      Agent,
      Area,
      DeepgramSTT,
      MiniMaxTTS,
      OpenAI,
      ExpiresIn,
    } = agora;

    const areaMap: Record<string, typeof Area[keyof typeof Area]> = {
      us: Area.US,
      eu: Area.EU,
      ap: Area.AP,
      cn: Area.CN,
    };
    const area = areaMap[this.config.geofence.toLowerCase()] ?? Area.US;

    // Validate credential format before making any network call.
    if (!/^[0-9a-f]{32}$/i.test(this.config.appId)) {
      throw new Error(
        `Agora AppID looks wrong (got "${this.config.appId.slice(0, 8)}…", expected 32 hex chars). ` +
        'Check VS Code Settings → Agora Mentor: App Id.',
      );
    }
    if (!/^[0-9a-f]{32}$/i.test(this.config.appCertificate)) {
      throw new Error(
        'Agora AppCertificate looks wrong (expected 32 hex chars). ' +
        'Check VS Code Settings → Agora Mentor: App Certificate.',
      );
    }

    // Auth: prefer Basic Auth (Customer ID/Secret) if configured, otherwise fall
    // back to app-credentials (appId + appCertificate → token).
    const useBasicAuth = !!(this.config.customerId && this.config.customerSecret);
    const client = useBasicAuth
      ? new AgoraClient({
          area,
          appId: this.config.appId,
          appCertificate: this.config.appCertificate,
          customerId: this.config.customerId!,
          customerSecret: this.config.customerSecret!,
        })
      : new AgoraClient({
          area,
          appId: this.config.appId,
          appCertificate: this.config.appCertificate,
        });

    const channel = this.buildChannelName();

    const cfg = modelConfig ?? defaultModelConfig();

    let agent = new Agent({
      instructions: prompt,
      greeting: `Hi! I'm your Agora Mentor. Let's look at ${context.fileName}.`,
      failureMessage: 'Please wait a moment.',
      maxHistory: 15,
      advancedFeatures: { enable_rtm: true },
      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    });

    if (cfg.mode === 'realtime') {
      agent = agent.withMllm(buildMllm(agora, cfg.mllm));
    } else if (isManagedDefaultStack(cfg)) {
      agent = agent
        .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en' }))
        .withLlm(new OpenAI({
          model: 'gpt-4o-mini',
          params: { max_tokens: 1024, temperature: 0.7, top_p: 0.95 },
        }))
        .withTts(new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'English_captivating_female1',
        }));
    } else {
      agent = agent
        .withStt(buildStt(agora, cfg.stt))
        .withLlm(buildLlm(agora, cfg.llm))
        .withTts(buildTts(agora, cfg.tts));

      if (cfg.avatarEnabled && cfg.avatar) {
        agent = agent.withAvatar(buildAvatar(agora, cfg.avatar));
      }
    }

    // v2.0.1 API: createSession(client, options)
    const session = agent.createSession(client, {
      channel,
      agentUid: this.config.agentUid,
      remoteUids: [String(CLIENT_UID)],
      idleTimeout: 30,
      expiresIn: ExpiresIn.seconds(SESSION_TTL_SECONDS),
      debug: false,
    });

    const agentId = await session.start();
    this.activeAgentId = agentId;

    // Generate client-side tokens for the webview using agora-token directly.
    // RtcTokenBuilder (AccessToken2) → tokenExpire is a duration in seconds.
    // RtmTokenBuilder (AccessToken v1) → privilegeExpiredTs is an absolute Unix timestamp.
    const { RtcTokenBuilder, RtcRole, RtmTokenBuilder } = require('agora-token') as typeof import('agora-token');

    const clientToken = RtcTokenBuilder.buildTokenWithRtm(
      this.config.appId,
      this.config.appCertificate,
      channel,
      String(CLIENT_UID),
      RtcRole.PUBLISHER,
      SESSION_TTL_SECONDS,       // duration
      SESSION_TTL_SECONDS,
    );

    let rtmToken: string | undefined;
    try {
      rtmToken = RtmTokenBuilder.buildToken(
        this.config.appId,
        this.config.appCertificate,
        String(CLIENT_UID),
        Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,  // absolute timestamp
      );
    } catch (_) {
      // optional; transcript falls back to stream-message events
    }

    const stopUrl =
      `https://api.agora.io/api/conversational-ai-agent/v2/projects/${this.config.appId}/agents/${agentId}/leave`;

    const stopAuth = (this.config.customerId && this.config.customerSecret)
      ? `Basic ${Buffer.from(`${this.config.customerId}:${this.config.customerSecret}`).toString('base64')}`
      : '';

    return {
      prompt,
      session: {
        status: 'live',
        channel,
        agentId,
        agentUid: this.config.agentUid,
        message: 'Session live — speak into your microphone to talk to the AI Mentor.',
        appId: this.config.appId,
        clientToken,
        clientUid: CLIENT_UID,
        rtmToken,
        stopUrl,
        stopAuth,
      },
    };
  }

  async stopSession(agentId?: string) {
    const targetAgentId = agentId ?? this.activeAgentId;
    if (!targetAgentId) {
      return { status: 'idle' as const, message: 'No running session to stop.' };
    }
    try {
      const { AgoraClient, Area } = require('agora-agents') as typeof import('agora-agents');
      const areaMap: Record<string, typeof Area[keyof typeof Area]> = {
        us: Area.US, eu: Area.EU, ap: Area.AP, cn: Area.CN,
      };
      const client = new AgoraClient({
        area: areaMap[this.config.geofence.toLowerCase()] ?? Area.US,
        appId: this.config.appId,
        appCertificate: this.config.appCertificate,
      });
      await client.stopAgent(targetAgentId);
    } catch (_) {
      // best-effort
    }
    this.activeAgentId = null;
    return { status: 'idle' as const, message: 'No session running.' };
  }

  private buildChannelName() {
    return `mentor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private assertConfig() {
    if (!this.config.appId || !this.config.appCertificate) {
      throw new Error('Set Agora appId and appCertificate in the extension settings first.');
    }
    if (!this.config.agentUid) {
      throw new Error('Set a valid agentUid in the extension settings first.');
    }
  }
}

function buildStt(vendors: typeof import('agora-agents'), selection: ModelConfig['stt']): any {
  switch (selection?.provider) {
    case 'ares':
      return new vendors.AresSTT({ language: field(selection, 'language', 'en') });
    case 'assemblyai':
      return new vendors.AssemblyAISTT({
        apiKey: field(selection, 'apiKey'),
        language: field(selection, 'language', 'en'),
      });
    case 'amazon':
      return new vendors.AmazonSTT({
        accessKey: field(selection, 'accessKey'),
        secretKey: field(selection, 'secretKey'),
        region: field(selection, 'region', 'us-east-1'),
        language: field(selection, 'language', 'en-US'),
      });
    case 'google':
      return new vendors.GoogleSTT({
        apiKey: field(selection, 'apiKey'),
        language: field(selection, 'language', 'en-US'),
      });
    case 'microsoft':
      return new vendors.MicrosoftSTT({
        key: field(selection, 'key'),
        region: field(selection, 'region', 'eastus'),
        language: field(selection, 'language', 'en-US'),
      });
    case 'openai':
      return new vendors.OpenAISTT({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model', 'whisper-1'),
        language: field(selection, 'language', 'en'),
      });
    case 'sarvam':
      return new vendors.SarvamSTT({
        apiKey: field(selection, 'apiKey'),
        language: field(selection, 'language', 'en'),
        model: field(selection, 'model', 'saaras:v1'),
      });
    case 'speechmatics':
      return new vendors.SpeechmaticsSTT({
        apiKey: field(selection, 'apiKey'),
        language: field(selection, 'language', 'en'),
        model: field(selection, 'model', 'enhanced'),
      });
    case 'deepgram':
    default:
      return new vendors.DeepgramSTT({
        apiKey: field(selection, 'apiKey') || undefined,
        model: field(selection, 'model', 'nova-3'),
        language: field(selection, 'language', 'en'),
        smartFormat: booleanField(selection, 'smartFormat', true),
        punctuation: booleanField(selection, 'punctuation', true),
      } as any);
  }
}

function buildLlm(vendors: typeof import('agora-agents'), selection: ModelConfig['llm']): any {
  switch (selection?.provider) {
    case 'amazon-bedrock':
      return new vendors.AmazonBedrock({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
        url: field(selection, 'url'),
      });
    case 'azure-openai':
      return new vendors.AzureOpenAI({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
        resourceName: field(selection, 'resourceName'),
        deploymentName: field(selection, 'deploymentName'),
        apiVersion: field(selection, 'apiVersion', '2024-08-01-preview'),
      });
    case 'anthropic':
      return new vendors.Anthropic({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
      });
    case 'dify':
      return new vendors.Dify({
        apiKey: field(selection, 'apiKey'),
        url: field(selection, 'url'),
      });
    case 'gemini':
      return new vendors.Gemini({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
      });
    case 'vertex-ai':
      return new vendors.VertexAILLM({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
        projectId: field(selection, 'projectId'),
        location: field(selection, 'location', 'us-central1'),
      });
    case 'groq':
      return new vendors.Groq({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
      });
    case 'custom':
      return new vendors.CustomLLM({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model'),
        url: field(selection, 'url') || undefined,
        vendor: field(selection, 'vendor', 'custom'),
      });
    case 'openai':
    default:
      return new vendors.OpenAI({
        apiKey: field(selection, 'apiKey') || undefined,
        model: field(selection, 'model', 'gpt-4o-mini'),
        params: {
          max_tokens: numberField(selection, 'maxTokens', 1024),
          temperature: numberField(selection, 'temperature', 0.7),
          top_p: numberField(selection, 'topP', 0.95),
        },
      } as any);
  }
}

function buildTts(vendors: typeof import('agora-agents'), selection: ModelConfig['tts']): any {
  switch (selection?.provider) {
    case 'amazon':
      return new vendors.AmazonTTS({
        accessKey: field(selection, 'accessKey'),
        secretKey: field(selection, 'secretKey'),
        region: field(selection, 'region', 'us-east-1'),
        voiceId: field(selection, 'voiceId', 'Joanna'),
      });
    case 'cartesia':
      return new vendors.CartesiaTTS({
        apiKey: field(selection, 'apiKey'),
        voiceId: field(selection, 'voiceId'),
        modelId: field(selection, 'modelId') || undefined,
      });
    case 'deepgram':
      return new vendors.DeepgramTTS({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model', 'aura-2-thalia-en'),
      });
    case 'elevenlabs':
      return new vendors.ElevenLabsTTS({
        key: field(selection, 'key'),
        modelId: field(selection, 'modelId', 'eleven_flash_v2_5'),
        voiceId: field(selection, 'voiceId'),
        sampleRate: numberField(selection, 'sampleRate', 24000) as any,
      } as any);
    case 'fish-audio':
      return new vendors.FishAudioTTS({
        key: field(selection, 'key'),
        referenceId: field(selection, 'referenceId'),
      });
    case 'google':
      return new vendors.GoogleTTS({
        key: field(selection, 'key'),
        voiceName: field(selection, 'voiceName'),
        languageCode: field(selection, 'languageCode', 'en-US'),
      });
    case 'hume':
      return new vendors.HumeAITTS({
        key: field(selection, 'key'),
        configId: field(selection, 'configId') || undefined,
      });
    case 'microsoft':
      return new vendors.MicrosoftTTS({
        key: field(selection, 'key'),
        region: field(selection, 'region', 'eastus'),
        voiceName: field(selection, 'voiceName'),
      });
    case 'murf':
      return new vendors.MurfTTS({
        key: field(selection, 'key'),
        voiceId: field(selection, 'voiceId'),
        style: field(selection, 'style') || undefined,
      });
    case 'openai':
      return new vendors.OpenAITTS({
        apiKey: field(selection, 'apiKey') || undefined,
        voice: field(selection, 'voice', 'alloy'),
        model: field(selection, 'model', 'tts-1'),
      } as any);
    case 'rime':
      return new vendors.RimeTTS({
        key: field(selection, 'key'),
        speaker: field(selection, 'speaker'),
        modelId: field(selection, 'modelId') || undefined,
        lang: field(selection, 'lang', 'en'),
      });
    case 'sarvam':
      return new vendors.SarvamTTS({
        key: field(selection, 'key'),
        speaker: field(selection, 'speaker'),
        targetLanguageCode: field(selection, 'targetLanguageCode', 'en-IN'),
      });
    case 'minimax':
    default:
      return new vendors.MiniMaxTTS({
        key: field(selection, 'key') || undefined,
        groupId: field(selection, 'groupId', 'default'),
        model: field(selection, 'model', 'speech_2_6_turbo'),
        voiceId: field(selection, 'voiceId', 'English_captivating_female1'),
        url: field(selection, 'url', 'wss://api.uw.minimax.io/ws/v1/t2a_v2'),
      } as any);
  }
}

function buildMllm(vendors: typeof import('agora-agents'), selection: ModelConfig['mllm']): any {
  switch (selection?.provider) {
    case 'gemini-live':
      return new vendors.GeminiLive({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model', 'gemini-live-2.5-flash'),
        voice: field(selection, 'voice', 'Aoede'),
        instructions: field(selection, 'instructions') || undefined,
      });
    case 'vertex-ai-live':
      return new vendors.VertexAI({
        model: field(selection, 'model', 'gemini-live-2.5-flash-preview-native-audio-09-2025'),
        projectId: field(selection, 'projectId'),
        location: field(selection, 'location', 'us-central1'),
        adcCredentialsString: field(selection, 'adcCredentialsString'),
        voice: field(selection, 'voice', 'Aoede'),
        instructions: field(selection, 'instructions') || undefined,
      });
    case 'xai-grok':
      return new vendors.XaiGrok({
        apiKey: field(selection, 'apiKey'),
        voice: field(selection, 'voice', 'eve'),
        language: field(selection, 'language', 'en'),
        sampleRate: numberField(selection, 'sampleRate', 24000),
      });
    case 'openai-realtime':
    default:
      return new vendors.OpenAIRealtime({
        apiKey: field(selection, 'apiKey'),
        model: field(selection, 'model', 'gpt-4o-realtime-preview'),
      });
  }
}

function buildAvatar(vendors: typeof import('agora-agents'), selection: ModelConfig['avatar']): any {
  switch (selection?.provider) {
    case 'akool':
      return new vendors.AkoolAvatar({
        apiKey: field(selection, 'apiKey'),
        avatarId: field(selection, 'avatarId') || undefined,
      });
    case 'anam':
      return new vendors.AnamAvatar({
        apiKey: field(selection, 'apiKey'),
        personaId: field(selection, 'personaId') || undefined,
      });
    case 'generic':
      return new vendors.GenericAvatar({
        apiKey: field(selection, 'apiKey'),
        apiBaseUrl: field(selection, 'apiBaseUrl'),
        avatarId: field(selection, 'avatarId'),
        agoraUid: field(selection, 'agoraUid'),
        agoraAppId: field(selection, 'agoraAppId') || undefined,
        agoraChannel: field(selection, 'agoraChannel') || undefined,
        agoraToken: field(selection, 'agoraToken') || undefined,
      });
    case 'heygen':
    case 'liveavatar':
    default:
      return new vendors.LiveAvatarAvatar({
        apiKey: field(selection, 'apiKey'),
        quality: (field(selection, 'quality', 'medium') as 'low' | 'medium' | 'high'),
        agoraUid: field(selection, 'agoraUid'),
        avatarId: field(selection, 'avatarId') || undefined,
      });
  }
}
