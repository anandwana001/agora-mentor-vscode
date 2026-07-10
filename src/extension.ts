import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgoraBackendClient } from './backend';
import { buildMentorPrompt } from './prompt';
import type { SelectedCodeContext, SessionState } from './types';
import { buildHtml } from './webview';

let panel: vscode.WebviewPanel | undefined;
let lastSelection: SelectedCodeContext | null = null;
let activeSession: SessionState | null = null;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('agoraMentor.askAboutSelection', () => {
      const sel = captureSelection();
      if (!sel) return;
      lastSelection = sel;
      openOrRefresh(context, sel);
    }),

    vscode.commands.registerCommand('agoraMentor.openPanel', () => {
      openOrRefresh(context, lastSelection);
    }),
  );
}

// ── Selection ─────────────────────────────────────────────────────────────────

function captureSelection(): SelectedCodeContext | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Agora Mentor: open a file and place your cursor on code first.');
    return null;
  }

  const doc = editor.document;
  const sel = editor.selection;
  const range = sel.isEmpty
    ? new vscode.Range(new vscode.Position(sel.active.line, 0), doc.lineAt(sel.active.line).range.end)
    : sel;

  const selectedText = doc.getText(range).trim();
  if (!selectedText) {
    vscode.window.showWarningMessage('Agora Mentor: select some code (or place cursor on a non-empty line).');
    return null;
  }

  const surroundStart = Math.max(0, range.start.line - 3);
  const surroundEnd   = Math.min(doc.lineCount - 1, range.end.line + 3);
  const surroundingText = doc.getText(
    new vscode.Range(new vscode.Position(surroundStart, 0), doc.lineAt(surroundEnd).range.end),
  ).trim();

  return {
    workspaceName:  vscode.workspace.getWorkspaceFolder(doc.uri)?.name ?? 'Workspace',
    fileName:       doc.fileName.split(/[\\/]/).pop() ?? doc.fileName,
    filePath:       doc.uri.fsPath,
    language:       doc.languageId,
    selectedText,
    surroundingText,
    startLine:      range.start.line,
    endLine:        range.end.line,
    characterCount: selectedText.length,
    timestamp:      Date.now(),
  };
}

// ── Panel ─────────────────────────────────────────────────────────────────────

function openOrRefresh(context: vscode.ExtensionContext, sel: SelectedCodeContext | null) {
  const col = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;

  const mediaDir = vscode.Uri.file(path.join(context.extensionPath, 'media'));

  if (!panel) {
    panel = vscode.window.createWebviewPanel('agoraMentor', 'Agora Mentor', col, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [mediaDir],
    });
    panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage(
      (msg) => handleWebviewMessage(msg),
      null,
      context.subscriptions,
    );
  }

  const rtcSdkUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'AgoraRTC_N.js')),
  );
  const rtmSdkUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'media', 'agora-rtm.js')),
  );

  panel.webview.html = buildHtml(panel.webview, sel, rtcSdkUri.toString(), rtmSdkUri.toString());
  panel.reveal(col);
}

function send(msg: object) {
  panel?.webview.postMessage(msg);
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleWebviewMessage(msg: any) {
  switch (msg.type) {
    case 'start-session': {
      if (!lastSelection) {
        send({ type: 'session-error', text: 'No code selected — right-click on code first.' });
        return;
      }
      send({ type: 'session-phase', phase: 'starting', text: 'Starting Agora session…' });
      try {
        const client = makeClient();
        const promptFromMsg = (msg as { prompt?: string }).prompt;
        const prompt =
          typeof promptFromMsg === 'string' && promptFromMsg.trim()
            ? promptFromMsg
            : buildMentorPrompt(lastSelection, msg.action ?? 'explain');
        const result = await client.startSession(prompt, lastSelection, msg.modelConfig);
        activeSession = result.session;
        send({ type: 'session-live', session: result.session });
        openCompanionInBrowser(result.session as Record<string, unknown>);
        vscode.window.showInformationMessage('Agora Mentor: browser companion opened — click Join Session.');
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        send({ type: 'session-error', text });
        vscode.window.showErrorMessage('Agora Mentor: ' + text);
      }
      break;
    }
    case 'stop-session': {
      try {
        const client = makeClient();
        await client.stopSession(activeSession?.agentId);
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage('Agora Mentor: ' + text);
      } finally {
        activeSession = null;
        send({ type: 'session-phase', phase: 'idle', text: 'Session ended.' });
      }
      break;
    }
    case 'toast': {
      vscode.window.showInformationMessage(String((msg as { text?: string }).text ?? ''));
      break;
    }
  }
}

function openCompanionInBrowser(session: Record<string, unknown>) {
  const html = buildCompanionHtml(session);
  const tmpFile = path.join(os.tmpdir(), `agora-mentor-companion-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');
  vscode.env.openExternal(vscode.Uri.file(tmpFile));
}

function buildCompanionHtml(session: Record<string, unknown>): string {
  const s = JSON.stringify(session);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Agora Mentor — Microphone</title>
<script src="https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.20.2/AgoraRTC_N-production.js"></script>
<script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@2.2.3/AgoraRTM_N-production.js"></script>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #0f111a; color: #cdd9f0;
         display: flex; flex-direction: column; align-items: center; justify-content: center;
         height: 100vh; margin: 0; gap: 20px; }
  h2 { font-size: 20px; margin: 0; }
  p  { font-size: 13px; color: #888; margin: 0; text-align: center; }
  #status { font-size: 14px; color: #ffb020; }
  button { padding: 10px 24px; border-radius: 8px; border: 0; font-size: 14px;
           font-weight: 600; cursor: pointer; background: #7cddff; color: #07101d; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  #join-btn { padding: 14px 40px; font-size: 16px; border-radius: 12px; }
  .vol { width: 220px; height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
  .bar { height: 100%; width: 0; background: #7cddff; transition: width .08s; }
  .transcript-wrap { width: min(760px, calc(100vw - 32px)); max-height: 42vh; display: flex; flex-direction: column; gap: 10px; }
  .transcript-title { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #888; align-self: flex-start; }
  .transcript { width: 100%; overflow: auto; padding: 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; background: rgba(255,255,255,.03); display: grid; gap: 10px; }
  .turn { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.05); }
  .turn.assistant { background: rgba(160,123,255,.10); }
  .turn.user { background: rgba(124,221,255,.08); }
  .turn-head { margin-bottom: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; }
  .turn-body { white-space: pre-wrap; line-height: 1.55; font-size: 13px; color: #e7e7e7; }
  .empty { margin: 0; color: #888; font-size: 13px; text-align: center; padding: 16px 0; }
  #session { display: none; flex-direction: column; align-items: center; gap: 20px; width: 100%; }
</style>
</head>
<body>
<div id="splash" style="display:flex;flex-direction:column;align-items:center;gap:20px">
  <h2>🎙 Agora Mentor</h2>
  <p>Click to connect your mic and hear the AI agent.<br>Keep this window open while your VS Code session is live.</p>
  <button id="join-btn" onclick="joinSession()">Join Session</button>
</div>
<div id="session">
  <h2>🎙 Agora Mentor — Live</h2>
  <div id="status">Connecting…</div>
  <div class="vol"><div class="bar" id="bar"></div></div>
  <button id="mute-btn" onclick="toggleMute()" disabled>Mute</button>
  <div class="transcript-wrap">
    <div class="transcript-title">Transcript</div>
    <div id="transcript" class="transcript">
      <p class="empty">Your conversation will appear here once the agent starts speaking.</p>
    </div>
  </div>
</div>
<script>
var SESSION = ${s};
var client, track, muted = false, timer;
var rtmClient = null;
var agentAudioTrack = null;
var audioContextReady = false;
var transcriptHistory = [];
var liveTurn = null;
var chunkBuffers = {};
var sessionEnded = false;

function stopAgentRemote() {
  if (!SESSION.stopUrl || sessionEnded) return;
  sessionEnded = true;
  try {
    // keepalive: true lets this fetch complete even while the page is unloading
    fetch(SESSION.stopUrl, {
      method: 'POST',
      keepalive: true,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        SESSION.stopAuth ? { Authorization: SESSION.stopAuth } : {}
      ),
    });
  } catch (_) {}
}

function showSessionEnded(reason) {
  sessionEnded = true;
  document.getElementById('status').textContent = reason || 'Session ended.';
  document.getElementById('status').style.color = '#888';
  var muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.disabled = true;
}

async function joinSession() {
  var btn = document.getElementById('join-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';

  // Unlock the audio context within this click handler — satisfies browser autoplay policy.
  // Any agent audio that arrives after this will play immediately without a second prompt.
  try {
    if (typeof AgoraRTC.resumeAudioContext === 'function') {
      await AgoraRTC.resumeAudioContext();
    }
    audioContextReady = true;
  } catch (_) {}

  document.getElementById('splash').style.display = 'none';
  document.getElementById('session').style.display = 'flex';

  await start();
}

async function start() {
  try {
    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    AgoraRTC.setLogLevel(4);
    client.on('user-published', function(user, mt) {
      client.subscribe(user, mt).then(function() {
        if (mt === 'audio' && user.audioTrack) {
          agentAudioTrack = user.audioTrack;
          // Audio context is already unlocked — play immediately.
          agentAudioTrack.play();
        }
      });
    });
    // Detect when the agent leaves (e.g. stopped from VS Code Stop button)
    client.on('user-left', function(user) {
      if (String(user.uid) === String(SESSION.agentUid)) {
        showSessionEnded('Session ended by VS Code.');
      }
    });
    client.on('stream-message', handleStreamMessage);
    if (SESSION.rtmToken) {
      try { await joinRtm(); } catch (_) {}
    }
    await client.join(SESSION.appId, SESSION.channel, SESSION.clientToken, SESSION.clientUid);
    track = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'speech_low_quality' });
    await client.publish(track);
    document.getElementById('status').textContent = 'Live — agent can hear you.';
    document.getElementById('status').style.color = '#4dd17a';
    document.getElementById('mute-btn').disabled = false;
    timer = setInterval(function() {
      if (track && !muted) document.getElementById('bar').style.width = Math.round(track.getVolumeLevel() * 100) + '%';
    }, 100);
  } catch(e) {
    sessionEnded = true; // Don't attempt a remote stop — we never fully joined
    document.getElementById('status').textContent = 'Error: ' + e.message;
    document.getElementById('status').style.color = '#ff6b7a';
    var btn = document.getElementById('join-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
    document.getElementById('splash').style.display = 'flex';
    document.getElementById('session').style.display = 'none';
  }
}

function handleStreamMessage(uid, stream) {
  try {
    var text = new TextDecoder('utf-8').decode(stream);
    var pipes = (text.match(/\|/g) || []).length;
    if (pipes === 3) {
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
        text = assembled;
      } else {
        return;
      }
    }
    var msg = JSON.parse(text);
    var obj = msg.object || '';
    if (obj === 'assistant.transcription') {
      if (msg.text) appendTranscript('assistant', msg.text, msg.turn_id, !!msg.final);
    } else if (obj === 'user.transcription') {
      if (msg.text && msg.final) appendTranscript('user', msg.text, msg.turn_id, true);
    }
  } catch (_) {}
}

async function joinRtm() {
  if (typeof AgoraRTM === 'undefined' || !AgoraRTM.RTM) return;
  rtmClient = new AgoraRTM.RTM(SESSION.appId, String(SESSION.clientUid));
  await rtmClient.login({ token: SESSION.rtmToken });
  await rtmClient.subscribe(SESSION.channel);
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

function appendTranscript(role, text, turnId, isFinal) {
  if (!text) return;
  var item = {
    role: role || 'system',
    text: String(text),
    turnId: turnId != null ? String(turnId) : null,
    isFinal: !!isFinal,
    createdAt: Date.now(),
  };
  if (item.role === 'assistant' && !item.isFinal) {
    liveTurn = item;
  } else if (item.role === 'assistant' && item.isFinal && liveTurn && String(liveTurn.turnId || 'x') === String(item.turnId || 'x')) {
    transcriptHistory.push(item);
    liveTurn = null;
  } else {
    transcriptHistory.push(item);
    if (item.role === 'user') liveTurn = null;
  }
  renderTranscript();
}

function renderTranscript() {
  var el = document.getElementById('transcript');
  if (!el) return;
  el.innerHTML = '';
  var items = transcriptHistory.slice();
  if (liveTurn) items.push(liveTurn);
  if (!items.length) {
    var empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Your conversation will appear here once the agent starts speaking.';
    el.appendChild(empty);
    return;
  }
  items.forEach(function(item) {
    var row = document.createElement('div');
    row.className = 'turn ' + (item.role || 'system');
    var head = document.createElement('div');
    head.className = 'turn-head';
    head.textContent = (item.role === 'assistant' ? 'AI' : item.role === 'user' ? 'You' : 'System') + (item.createdAt ? ' · ' + new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
    var body = document.createElement('div');
    body.className = 'turn-body';
    body.textContent = item.text;
    row.appendChild(head);
    row.appendChild(body);
    el.appendChild(row);
  });
  el.scrollTop = el.scrollHeight;
}

function toggleMute() {
  muted = !muted;
  if (track) track.setEnabled(!muted);
  document.getElementById('mute-btn').textContent = muted ? 'Unmute' : 'Mute';
  if (muted) document.getElementById('bar').style.width = '0';
}

window.addEventListener('beforeunload', function() {
  // Stop the agent via REST before the page unloads (keepalive fetch survives unload)
  stopAgentRemote();
  clearInterval(timer);
  chunkBuffers = {};
  if (rtmClient) {
    try { rtmClient.removeEventListener('message', handleRtmMessage); } catch (_) {}
    try { rtmClient.logout(); } catch (_) {}
  }
  if (track) { track.stop(); track.close(); }
  if (client) client.leave();
});
</script>
</body>
</html>`;
}

function makeClient() {
  const c = vscode.workspace.getConfiguration('agoraMentor');
  return new AgoraBackendClient({
    appId:          String(c.get('appId')          ?? '').trim(),
    appCertificate: String(c.get('appCertificate') ?? '').trim(),
    agentUid:       String(c.get('agentUid')       ?? '123456').trim(),
    geofence:       String(c.get('geofence')       ?? 'us').trim(),
    customerId:     String(c.get('customerId')     ?? '').trim() || undefined,
    customerSecret: String(c.get('customerSecret') ?? '').trim() || undefined,
  });
}

export function deactivate() {}
