# Agora Mentor — Pricing Guide

> **Who this is for:** Anyone evaluating or using Agora Mentor who wants to understand what Agora charges based on how they use the extension.

---

## TL;DR

The extension uses three Agora products under the hood. Their costs are very different in magnitude:

| Product | Free Tier | Paid Rate | Applies To |
|---|---|---|---|
| **Conversational AI Engine** | First 300 minutes (one-time) | **$0.10 / minute** | Voice + Chat |
| **Voice Calling (RTC)** | 10,000 min / month | $0.99 / 1,000 min | Voice mode only |
| **Signaling (RTM)** | 1,000,000 messages / month | $59 / month (starting) | Voice + Chat |

**Bottom line:** ConvoAI at $0.10/min is the dominant cost. RTC and RTM are practically free for individual or small-team usage.

---

## What charges what

### Conversational AI Engine (`agora-agents` SDK)
- **Every session** — voice or chat — runs the ConvoAI agent.
- Billed per **session minute** from the moment `session.start()` is called until `session.stop()` or timeout.
- **Free tier:** The first 300 minutes are free (one-time, new account credit).
- **Paid rate:** $0.10 / minute.

### Voice Calling / RTC Audio (`AgoraRTC_N.js`)
- Only used in **voice mode**. Chat mode has no RTC channel join.
- Billed per **participant-minute** (each user in the channel, per minute).
- In voice mode there are **2 participants**: the browser client (UID 1) and the AI agent (UID from settings).
  - Example: 10-minute voice session → 2 × 10 = **20 participant-minutes** billed.
- **Free tier:** 10,000 participant-minutes / month (resets monthly).
- **Paid rate:** $0.99 / 1,000 minutes ≈ **$0.001 / participant-minute**.

### Signaling / RTM (`agora-rtm.js`)
- Used in **both modes** for live transcript delivery.
- Each `assistant.transcription` and `user.transcription` event is one RTM message.
- A typical conversation generates roughly 10–60 messages per minute of session time.
- **Free tier:** 1,000,000 messages / month.
- **Paid rate:** Starts at $59 / month for the first paid tier.

---

## Cost by usage mode

### Voice Mode Only

| Cost component | Notes |
|---|---|
| ConvoAI | $0.10/min (primary cost) |
| RTC Audio | ~$0.002/min for 2 participants (usually free tier) |
| RTM | ~20–60 msg/min (well within 1M free/month) |
| **Effective total** | **~$0.10/min** |

The RTC cost is roughly 2% of the ConvoAI cost and stays within the free tier for most users.

### Chat Mode Only

| Cost component | Notes |
|---|---|
| ConvoAI | $0.10/min (only cost) |
| RTC Audio | **$0** — no RTC channel is joined in chat mode |
| RTM | ~10–30 msg/min (within free tier) |
| **Effective total** | **~$0.10/min** |

Chat mode is marginally cheaper than voice because no RTC minutes are consumed, but the difference is negligible — the dominant cost is the same ConvoAI rate.

### Both Modes (alternating sessions)

Cost is simply the sum of individual session times × $0.10/min, plus whatever RTC minutes the voice sessions accumulate. There is no per-mode or mixed-mode pricing — it's all metered per minute.

---

## Example cost calculations

All examples assume the 300 free ConvoAI minutes have already been used.

| Scenario | Session time | ConvoAI | RTC | RTM | Total / month |
|---|---|---|---|---|---|
| Light use — 30 min/day voice | 900 min/mo | $90.00 | Free (1,800 of 10,000 free min used) | Free | **~$90** |
| Moderate use — 1 hr/day voice | 1,800 min/mo | $180.00 | Free (3,600 of 10,000 free min used) | Free | **~$180** |
| Heavy use — 2 hr/day voice | 3,600 min/mo | $360.00 | ~$0.36 (3,600 min over the 10k free—still free actually) | Free | **~$360** |
| Chat only — 1 hr/day | 1,800 min/mo | $180.00 | $0 | Free | **~$180** |
| Team (5 devs, 30 min/day voice) | 4,500 min/mo | $450.00 | Free (9,000 of 10,000 free min) | Free | **~$450** |
| Team (10 devs, 1 hr/day voice) | 18,000 min/mo | $1,800 | ~$7.92 (18,000 participant-min × 2 = 36,000; 26,000 over free) | Free | **~$1,808** |

**Key takeaway:** For teams under ~5 developers doing ~30 min/day, RTC stays within the free tier. The ConvoAI cost is the only material expense.

---

## Free tier — how far does it go?

### ConvoAI 300 free minutes
- 300 minutes = 5 hours of total session time.
- Spread across voice + chat sessions (they share the same pool).
- One-time credit on a new Agora account — not monthly.
- At 30 min/day this covers about 10 days.

### RTC 10,000 free participant-minutes / month
- Voice mode uses 2 participants per session.
- 10,000 / 2 = **5,000 voice session minutes free per month**.
- At 1 hr/day: 1,800 min/month → well within free tier.
- At 2 hr/day: 3,600 min/month → still within free tier.
- You'd need ~2.8 hr/day of continuous voice sessions before hitting RTC charges.

### RTM 1,000,000 free messages / month
- At 60 transcript messages per minute of session time:
  - 1,000,000 / 60 = **~16,667 session minutes free** = ~278 hours of conversation per month.
- Practically unlimited for individual and small team use.

---

## When do you start paying?

| What you're doing | When charges begin |
|---|---|
| **ConvoAI (both modes)** | After the first 300 minutes (one-time credit) |
| **RTC audio (voice mode)** | After 10,000 participant-min/month (~5,000 voice min, or ~83 hours) |
| **RTM (both modes)** | After 1,000,000 messages/month (~16,000+ session minutes) |

For most individual developers:
- **ConvoAI charges begin after ~10 days of normal use.**
- **RTC and RTM charges don't realistically apply** unless you're running the extension for several hours daily.

---

## Cost optimization tips

1. **Use chat mode for exploratory questions.** Chat mode skips RTC entirely, saving RTC minutes even though the ConvoAI cost is identical. For teams at risk of hitting the RTC free tier, routing non-urgent questions to chat helps.

2. **Keep sessions short and intentional.** ConvoAI is metered from `session.start()` to stop. Don't start a session and leave it running. The 30-second `idleTimeout` in voice mode auto-stops the agent after silence, but chat mode has `idleTimeout: 0` — explicitly stop when done.

3. **One Agora project per workspace.** The 10,000 free RTC minutes are per Agora project. If your team is large, spreading load across multiple Agora projects each gets its own free tier. (Requires separate `appId` / `appCertificate` pairs.)

4. **Monitor usage in Agora Console.** The Console's Usage dashboard shows ConvoAI minutes, RTC minutes, and RTM messages in real time. Set billing alerts to avoid surprises.

5. **Enterprise pricing for sustained use.** For teams with predictable monthly volumes above ~$200, Agora offers custom/volume pricing — contact them via the Agora Console.

---

## Pricing source

All rates from [https://www.agora.io/en/pricing/](https://www.agora.io/en/pricing/) as of July 2026. Agora pricing may change — verify current rates in the Agora Console or pricing page before making budget decisions.
