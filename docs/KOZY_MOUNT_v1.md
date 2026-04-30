# Kozy → Tele•GPT Runtime Mount v1.0

## What was added

Bounded local voice synthesis path through the already-running Kozy XTTS server.

### Files

| File | Purpose |
|------|---------|
| `src/server/voice/kozyProvider.ts` | Kozy HTTP client — validates input, calls Kozy `/speak`, returns structured result |
| `src/server/voice/kozyProvider.test.ts` | Bounded smoke tests (5 test cases, all mocked-free except connectivity) |
| `apps/telegpt-api/src/voice/runtime/voiceRouter.ts` | Updated: tries Kozy first, then CosyVoice stub, then text fallback |

## Env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `KOZY_ENABLED` | `true` | Set `false` to disable Kozy provider |
| `KOZY_SERVER_URL` | `http://127.0.0.1:8010` | Kozy server HTTP endpoint |
| `KOZY_DEFAULT_LANG` | `ru` | Default synthesis language |
| `KOZY_DEFAULT_SPEED` | `1.0` | Default speech speed (0.25–3.0) |

## How to run locally

1. Ensure Kozy server is running:
   ```bash
   # From tele-gpt-providers/Cozy_voice_TGPG
   .venv/bin/uvicorn kozy_server:app --host 127.0.0.1 --port 8010
   ```

2. Verify Kozy is alive:
   ```bash
   curl http://127.0.0.1:8010/health
   ```

3. Start Tele•GPT:
   ```bash
   npx dotenv -e .env.dev -- tsx src/server/index.ts
   ```

4. Run Arisha pipeline with voice:
   ```bash
   curl -X POST http://localhost:8787/v1/arisha/pipeline \
     -H "Content-Type: application/json" \
     -d '{"trace_id":"test-1","session_id":"sess-1","actor_id":"user-1","actor_role":"creator","channel":"alice","raw_input":{"text":"Привет, Ариша"}}'
   ```

## Expected result structure

```json
{
  "ok": true,
  "trace_id": "test-1",
  "channel": "alice",
  "response_trace": {
    "intent": "clarify",
    "mode": "concise",
    "quality_status": "pass",
    "surface": "alice"
  },
  "surface_reply": {
    "channel": "alice",
    "text_output": "Принял. Уточни, что именно нужно раскрыть первым.",
    "audio_output": {
      "asset_id": "arisha_test-1_1234567890.wav",
      "file_path": "/path/to/Cozy_voice_TGPG/out/arisha_test-1_1234567890.wav",
      "filename": "arisha_test-1_1234567890.wav",
      "mime": "audio/wav",
      "size_bytes": 222316,
      "provider": "kozy",
      "duration_ms": 56000
    },
    "audio_url": "/v1/voice/files/arisha_test-1_1234567890.wav",
    "payload_shape": "audio_first",
    "fallback_used": false
  }
}
```

When no audio (text-only surfaces like web/telegram):

```json
{
  "surface_reply": {
    "channel": "telegram",
    "text_output": "Я рядом. Можно спокойно пойти шаг за шагом.",
    "audio_output": null,
    "audio_url": null,
    "payload_shape": "text_first",
    "fallback_used": false
  }
}
```

## Kozy server API

Kozy exposes:
- `GET /health` — model status
- `POST /speak` — synthesize text to WAV
- `GET /files/{filename}` — download generated audio

See `kozy_server.py` in `tele-gpt-providers/Cozy_voice_TGPG/` for full API.

---

## Voice Latency + UX Hardening v1.0

### Latency Breakdown (measured live)

| Phase | Duration | % of total | Notes |
|-------|----------|------------|-------|
| Telegram inbound → Arisha call | ~5ms | <1% | Negligible |
| Arisha pipeline (attention → composition → quality → surface) | ~30-50ms | <1% | Negligible |
| Kozy XTTS synthesis | 30-40s | ~99% | **Dominant bottleneck** |
| WAV file send (sendVoice) | ~200-500ms | <1% | Network + Telegram upload |
| **Total** | **30-40s** | **100%** | Kozy-dominated |

### Bounded Optimizations Applied

| Optimization | Impact | Description |
|-------------|--------|-------------|
| Spoken text capped to 100 chars | Reduces Kozy time | Shorter text → faster synthesis. Display text remains full-length. |
| Voice policy: max 200 chars | Prevents long waits | Messages > 200 chars fall through to intel path instead of waiting 40s+ |
| Caption capped to 200 chars | Prevents Telegram API issues | Telegram captions max at 1024, but 200 is safer for voice context |
| `ctx.sendChatAction("record_voice")` | UX improvement | Shows 🎙 recording indicator immediately — user sees activity during 30-40s wait |
| Non-blocking bot launch | Server startup fix | `bot.launch()` no longer blocks server startup |

### Remaining Dominant Latency Cause

**Kozy XTTS inference on CPU** — ~30-40 seconds per synthesis. This is the model loading and running inference on CPU (no GPU acceleration). All other latency is <1% of total.

### How to Verify Live

1. Start server: `ARISHA_ENABLED=true TELEGPT_ENABLE_TELEGRAM_BOT=1 npx dotenv -e .env.dev -- tsx src/server/index.ts`
2. Send short message (< 200 chars) to the bot
3. User sees 🎙 recording indicator immediately
4. After ~30-40s: voice message arrives
5. Check structured logs for timing:
   - `telegram_voice_bridge_started` → start
   - `arisha_call_started` → Arisha begins
   - `arisha_call_finished` → includes `arisha_ms` (should be ~30-40s)
   - `wav_ready` → file ready
   - `telegram_voice_send_succeeded` → includes `send_voice_ms` (should be <1s)
   - `total_ms` → total user-visible latency

### Config

| Variable | Default | Description |
|----------|---------|-------------|
| `ARISHA_VOICE_MAX_CHARS` | `200` | Max input length for voice path. Longer messages go to intel/text path. |
| `ARISHA_VOICE_HARD_TEXT_LIMIT` | `500` | Hard limit above which voice is never attempted. |

---

## Voice Strategy Layer v1.0

### Strategy Modes

| Mode | Meaning | Provider |
|------|---------|----------|
| `voice_quality` | Worth generating high-quality voice | Kozy (LIVE) |
| `voice_fast` | Fast voice if available | PREPARED (no live provider) |
| `text_only` | Intentionally text — no voice | — |

### Routing Rules (explicit in code)

| Input | Strategy | Reason |
|-------|----------|--------|
| Empty / whitespace | text_only | No content |
| `/command` | text_only | Commands don't need voice |
| Ultra-short tokens: "ok", "да", "нет", "привет", "пока", "спасибо"… | text_only | Ack/greeting — no voice value |
| Greeting/ack one-liners (< 40 chars matching known patterns) | text_only | Friendly but trivial |
| Short reply (≤ 200 chars, not trivial) | voice_quality | Worth hearing |
| Medium reply (200–500 chars) | text_only | Too long for comfortable voice wait |
| Long reply (> 500 chars) | text_only | Definitely text territory |
| Kozy unavailable | text_only | No voice provider |

### Config

| Variable | Default | Description |
|----------|---------|-------------|
| `ARISHA_VOICE_MAX_CHARS` | `200` | Max chars for voice_quality. |
| `ARISHA_VOICE_HARD_TEXT_LIMIT` | `500` | Hard limit — never voice above this. |
| `KOZY_ENABLED` | `true` (unless `"false"`) | Whether Kozy is considered live. |

### Provider Status

| Provider | Mode | Status |
|----------|------|--------|
| Kozy XTTS | voice_quality | **LIVE** — confirmed working |
| (fast slot) | voice_fast | **PREPARED** — no real provider yet |

### How to Verify Live

1. Start server: `ARISHA_ENABLED=true TELEGPT_ENABLE_TELEGRAM_BOT=1 npx dotenv -e .env.dev -- tsx src/server/index.ts`
2. Send messages of different lengths/types to the bot
3. Check structured logs for `voice_strategy_decision` event:
   - `"привет"` → `strategy_mode: "text_only", reason: "ultra_short_ack"`
   - `"Что думаешь об архитектуре?"` → `strategy_mode: "voice_quality", reason: "short_friendly_Nchars"`
   - 300-char message → `strategy_mode: "text_only", reason: "medium_length_300chars_text_preferred"`
4. Voice path still works for short meaningful messages — confirmed live Kozy path unchanged

---

## Voice Fast Provider v1.0

### What was added

Real fast voice provider using macOS built-in `say` command + `afconvert` → WAV.

| Aspect | Fast Provider (say_macos) | Quality Provider (Kozy XTTS) |
|--------|--------------------------|----------------------------|
| **Engine** | macOS system TTS | Neural XTTS |
| **Voice** | Milena (ru_RU) | Custom cloned voice |
| **Latency** | **<1 second** | **30-40 seconds** |
| **Quality** | Good system TTS | Natural, expressive |
| **Platform** | macOS only | Cross-platform (Python) |
| **Status** | **LIVE** | **LIVE** |

### How it works

1. Strategy layer receives short message (≤ 300 chars, not a greeting/ack)
2. Decides `voice_fast` mode → fast provider selected
3. `synthesizeFast()` calls `/usr/bin/say -v Milena -o output.aiff text`
4. `/usr/bin/afconvert -f WAVE -d LEI16 output.aiff output.wav`
5. AIFF cleaned up, WAV sent via existing `ctx.replyWithVoice()` path
6. Total latency: **<1 second** (vs 30-40s for Kozy)

### Config

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_FAST_PROVIDER_ENABLED` | `true` (if say available) | Enable/disable fast provider |
| `VOICE_FAST_VOICE` | `Milena` | Voice name for `say` command |
| `VOICE_FAST_SPEED` | `1.0` | Speech speed multiplier |
| `VOICE_FAST_MAX_CHARS` | `300` | Max chars for fast provider |
| `VOICE_FAST_LANG` | `ru` | Language |
| `VOICE_FAST_OUTPUT_DIR` | `/tmp/tele-gpt-voice-fast` | Output directory for WAV files |
| `VOICE_FAST_FALLBACK_TO_KOZY` | `true` | If fast fails, try Kozy |

### Strategy Routing (updated)

| Input | Strategy | Provider | Latency |
|-------|----------|----------|---------|
| Greeting/ack ("привет", "ok") | text_only | — | — |
| Short meaningful (≤ 300 chars) | **voice_fast** | **say_macos** | **<1s** |
| Short (≤ 200 chars, fast disabled) | voice_quality | Kozy | 30-40s |
| Medium (200–500 chars) | text_only | — | — |
| Long (> 500 chars) | text_only | — | — |

### How to Verify Live

1. Start server: `ARISHA_ENABLED=true TELEGPT_ENABLE_TELEGRAM_BOT=1 npx dotenv -e .env.dev -- tsx src/server/index.ts`
2. Send short message (not greeting): "Расскажи об этом подробнее"
3. Check logs: `voice_strategy_decision` → `strategy_mode: "voice_fast"`
4. Check logs: `fast_provider_succeeded` → `latency_ms: <1000`
5. User receives voice message in <1 second

---

## Voice Personality / Style Layer v1.0

### Style Modes

| Mode | When | Speech Rate (say) | Feel |
|------|------|-------------------|------|
| `warm` | Greetings, friendly openers | 180 wpm | Softer, welcoming |
| `supportive` | Requests for help, emotional content | 160 wpm | Calming, gentle |
| `concise` | Confirmations, short replies | 220 wpm | Brief, direct |
| `neutral` | Everything else (default) | 200 wpm | Balanced, factual |

### How Styles Are Chosen

Explicit pattern matching — no ML, no sentiment analysis:

| Input Pattern | Style | Example |
|---------------|-------|---------|
| Support keywords (поддержк, тяжело, страшно, помоги...) | supportive | "мне нужна поддержка" |
| Greetings (привет, здравствуй, добрый день...) | warm | "привет, как дела?" |
| Confirmations (ok, да, нет, сделано, готово...) | concise | "ок, сделаю" |
| Short replies (< 30 chars, not greeting/support) | concise | "Хорошо, понял" |
| Everything else | neutral | "Расскажи об архитектуре" |

### Provider Style Support

| Provider | Style Support | How |
|----------|---------------|-----|
| say_macos (voice_fast) | **Speech rate** | `-r` parameter: 160-220 wpm |
| Kozy XTTS (voice_quality) | **Metadata only** | Provider doesn't accept style params; style logged for observability |
| text_only | **N/A** | No synthesis, style metadata only |

### Truth About Style

- **STYLE_SELECTED** = style decision was made based on input patterns
- **STYLE_APPLIED** = provider actually adjusted speech rate (say_macos only)
- **STYLE_NEUTRAL_FALLBACK** = empty/unrecognized input → neutral mode
- **PROVIDER_LIMITED** = Kozy cannot express style beyond metadata logging

### Config

No new env vars needed — style is fully automatic based on input patterns.

### How to Verify

1. Send "привет" → logs: `voice_style_selected, style_mode: warm, speech_rate: 180`
2. Send "мне нужна поддержка" → logs: `voice_style_selected, style_mode: supportive, speech_rate: 160`
3. Send "ок" → logs: `voice_style_selected, style_mode: concise, speech_rate: 220`
4. Send "Расскажи об архитектуре" → logs: `voice_style_selected, style_mode: neutral, speech_rate: 200`

---

## Voice Presence / Relationship Layer v1.0

### What This Is

A bounded short-arc conversational continuity layer — **NOT a memory system, NOT user profiling, NOT emotional modeling**.

Introduces light awareness of recent interaction context so responses feel less mechanical and more intentional across turns.

### What This Is NOT

- **No persistent storage** — context lives only in memory, lost on restart
- **No user profiles** — no tracking of preferences, personality, or history
- **No emotional modeling** — does not track or respond to emotional states
- **No long-term memory** — resets after 5-minute gaps or topic shifts
- **No personalization** — does not adapt to individual users over time

### Presence Modes

| Mode | When | Text Shaping |
|------|------|--------------|
| `fresh` | First interaction, no history | None |
| `continuing` | Natural follow-up to recent exchange | Remove repeated openers if present |
| `soft_followup` | Gentle continuation after supportive exchange | Keep brief if too long |
| `reset` | Long gap (>5min) or topic shift | None — clean slate |

### Presence Rules (Explicit, No ML)

| Condition | Result |
|-----------|--------|
| No history (first message) | fresh |
| Gap > 5 minutes since last interaction | reset |
| User changes topic after support (contains ? or topic-shift words) | reset |
| Back-to-back greetings | continuing |
| User acknowledges support with concise reply | soft_followup |
| Same style repeated (< 3 interactions) | continuing |
| Has history, none of above | continuing |

### Text Shaping Applied

| Presence Mode | Shaping | Example |
|---------------|---------|---------|
| fresh | None | "Привет!" → "Привет!" |
| continuing | Remove repeated opener if last was voice | "Привет! Расскажи..." → "Расскажи..." |
| soft_followup | Shorten if > 80 chars | Long reply → truncated to 80 + "..." |
| reset | None | Clean slate, no shaping |

### Context Window

- **Max 5 interactions** tracked per chat
- **5-minute timeout** — resets after gap
- **Per-chat** — each chat_id has independent context
- **Ephemeral** — lost on server restart

### Observability

| Log Event | When |
|-----------|------|
| `voice_presence_started` | Presence layer begins processing |
| `voice_presence_mode_selected` | Mode decided (fresh/continuing/etc.) |
| `voice_presence_adjustment_applied` | Text was shaped |
| `voice_presence_skipped` | No shaping needed |
| `final_presence_mode` | Final mode logged after response sent |

### Config

No new env vars. Presence is fully automatic based on interaction history.

### How to Verify

1. Send "привет" → logs: `voice_presence_mode_selected, presence_mode: fresh`
2. Send "как дела?" → logs: `presence_mode: continuing` (follow-up to greeting)
3. Wait 6 minutes, send "что нового?" → logs: `presence_mode: reset` (long gap)
4. Send "мне нужна поддержка" → style: supportive
5. Send "спасибо" → logs: `presence_mode: soft_followup` (after support)

---

## Voice Natural Variation Layer v1.0

### What This Is

Bounded micro-variation for repeated phrasing — rotates among **approved template variants** for openers, confirmations, and transitions. Reduces robotic repetition while preserving meaning.

### What This Is NOT

- **NOT LLM rewriting** — no AI paraphrasing
- **NOT creativity engine** — only approved variants used
- **NOT persona drift** — doesn't change assistant identity
- **NOT free paraphrasing** — meaning and facts preserved exactly
- **NOT emotional generation** — only surface-level phrasing diversity

### Variation Modes

| Mode | When | What Changes |
|------|------|--------------|
| `none` | No template matched / technical content / very short text | Nothing — original preserved |
| `light` | Greeting / confirmation / explanation opener | Rotates to different approved variant |
| `micro_shift` | Supportive connector/transition | Slight connector variation |

### Template Families (Approved Variants Only)

| Family | Variants | Example |
|--------|----------|---------|
| **greeting** | "Привет! ", "Привет. ", "Хей! ", "Здравствуй! " | "Привет! Как дела?" ↔ "Хей! Как дела?" |
| **confirmation** | "Понял. ", "Принял. ", "Ясно. ", "Хорошо. " | "Понял. Сделаю." ↔ "Принял. Сделаю." |
| **explanation** | "Сейчас объясню. ", "Объясняю. ", "Сейчас коротко покажу. ", "Вот смотри. " | "Сейчас объясню. Вот как..." ↔ "Объясняю. Вот как..." |
| **supportive** | "Давай спокойно разберём. ", "Можно пойти шаг за шагом. ", "Давай по порядку. " | "Давай спокойно разберём. Что..." ↔ "Можно пойти шаг за шагом. Что..." |

### What Is NOT Varied

| Content Type | Why Not Varied |
|--------------|----------------|
| Technical explanations | Risk of changing meaning |
| URLs / file paths | Must be exact |
| Code snippets / class names | Technical accuracy |
| Numbers / dates / times | Factual content |
| Safety instructions | Must be precise |
| Very short text (< 10 chars) | No meaningful template to rotate |

### Deterministic Selection

Variation uses **hash-based rotation** for debuggability:
- Seed = `{chatId}-{templateFamily}-{traceId last 6 chars}`
- Hash → index in variant array
- If same as current → rotates to next variant (avoid repetition)
- **Reproducible**: same inputs always produce same output

### How to Verify

1. Send "привет" 4 times in a row:
   - Should rotate among: "Привет!", "Привет.", "Хей!", "Здравствуй!"
   - Logs: `voice_variation_applied, template_family: greeting`
2. Send "Понял. Сделаю." 3 times:
   - Should rotate among: "Понял.", "Принял.", "Ясно.", "Хорошо."
   - Logs: `voice_variation_applied, template_family: confirmation`
3. Send technical text with URL:
   - Should NOT vary — logs: `voice_variation_skipped, reason: technical_content_skipped`
4. Same trace + chat + text always produces same variation (deterministic)

---

## Voice Rhythm / Cadence Layer v1.0

### What This Is

Bounded deterministic cadence/rhythm decisions for spoken responses. Controls **how speech FLOWS** — not what it says. Makes voice responses sound less like flat synthetic blocks and more like natural speech with varying rhythm.

### What This Is NOT

- **NOT LLM rewriting** — no generative paraphrasing
- **NOT TTS engine changes** — provider contracts unchanged
- **NOT emotional modeling** — rhythm, not emotion
- **NOT free-form pacing** — only approved cadence modes used

### Cadence Modes

| Mode | When | Speech Rate (say) | Feel |
|------|------|-------------------|------|
| `crisp_direct` | Direct user tone | 220 wpm | Straight to point, tight |
| `warm_compact` | Short answers, follow-ups in warm context | 200 wpm | Friendly but concise |
| `steady_explanatory` | Medium/high complexity | 190 wpm | Measured, not rushed |
| `soft_guided` | High complexity + warm relationship | 180 wpm | Gentle guidance |
| `supportive_gentle` | Support-seeking user | 160 wpm | Calming, spacious |

### Pacing Density

| Density | When | Effect |
|---------|------|--------|
| `tight` | Direct users, short answers | Closer phrasing, no padding |
| `balanced` | Most cases | Natural spacing |
| `airy` | Supportive context | Spacious, low-pressure |

### Sentence Shape

| Shape | When | Effect |
|-------|------|--------|
| `short_bursts` | Direct, short, follow-up | Clean spoken chunks |
| `mixed_natural` | Explanatory, neutral | Varied sentence lengths |
| `smooth_layered` | Supportive, guided | Flowing, connected phrasing |

### Cadence Rules

| Rule | Trigger | Result |
|------|---------|--------|
| **A** — direct users | `userTone === "direct"` | crisp_direct / tight / short_bursts |
| **B** — supportive context | `userTone === "support-seeking"` | supportive_gentle / airy / smooth_layered |
| **C** — complexity | `taskComplexity === "high"` | Not tight; steady_explanatory or soft_guided |
| **D** — short answers | `answerLength === "short"` | warm_compact / tight / short_bursts |
| **E** — follow-up | `isFollowUp === true` | Slightly tighter but context-aligned |
| **F** — clean ending | Always | `shouldEndCleanly = true` |

### Integration with Fast Provider

Cadence overrides speech rate from style:
- Before: style → speech rate (warm=180, supportive=160, etc.)
- After: cadence → speech rate (crisp=220, supportive=160, etc.)
- Cadence is more nuanced because it considers user tone, complexity, follow-up status, and relationship mode

### Config

No new env vars. Cadence is fully automatic based on context signals.

### How to Verify

1. Send direct question: "Что сделано?" → logs: `cadence_mode: crisp_direct, speech_rate_hint: 220`
2. Send support request: "Мне нужна поддержка" → logs: `cadence_mode: supportive_gentle, speech_rate_hint: 160`
3. Send complex question: "Расскажи подробно об архитектуре системы и как все компоненты взаимодействуют друг с другом" → logs: `cadence_mode: steady_explanatory, speech_rate_hint: 190`
4. Listen to voice responses — cadence should vary naturally based on context

---

## Realtime First-Audio Layer v1.0

### What This Is

Bounded first-audio optimization — reduces **perceived latency** by starting with a clean spoken chunk when safe. Makes the system feel like it responds **immediately** instead of "thinking too long."

### What This Is NOT

- **NOT streaming audio** — no websocket/RTP/VoIP
- **NOT broken/abrupt starts** — first chunk must sound complete
- **NOT meaning sacrifice** — never breaks sentences for speed
- **NOT full two-part synthesis** — v1.0 sends single optimized chunk

### First-Audio Modes

| Mode | When | Behavior |
|------|------|----------|
| `disabled` | Not a voice reply | No optimization |
| `single_chunk_fast_start` | Clean chunk available | Send optimized first chunk immediately |
| `full_response_only` | No clean boundary or soft cadence | Normal full response |

### Decision Rules

| Rule | Trigger | Result |
|------|---------|--------|
| **A** — short/medium answers | `isVoiceReply && (short || medium)` | Allow fast start |
| **B** — long with clean boundary | Long text + sentence-ending punctuation | Split at clean boundary |
| **C** — supportive/soft cadence | `supportive_gentle` or `soft_guided` | No harsh cuts; only split if naturally soft |
| **D** — direct/crisp cadence | `crisp_direct` or `warm_compact` | Allow earlier chunking |
| **E** — semantic cleanliness | First chunk must end cleanly | No dangling "because…", "look…", "firstly…" |
| **F** — always fallback | Any risk → `full_response_only` | Never start with bad audio |

### Split Heuristics

```
Priority 1: Sentence-ending punctuation (., !, ?, …)
Priority 2: Safe comma/dash break (only if natural)
Never: Below 35 chars or above 180 chars
```

### Chunk Quality Guards

First chunk must: contain meaningful spoken unit (35-180 chars), end with sentence punctuation or safe break, NOT end with dangling patterns ("потому что", "смотри…"), sound complete enough to stand alone.

### Integration

After cadence decision, before provider synthesis. If `single_chunk_fast_start`: uses first chunk text instead of full delivery text. Structured logs: `voice_first_audio_decision`, `voice_first_audio_applied`, `voice_first_audio_sent`, `voice_first_audio_fallback`.

### Config

No new env vars. First-audio is fully automatic based on context signals.

### How to Verify

1. Send short direct question: "Что сделано?" → logs: `mode: single_chunk_fast_start`
2. Send long explanation with clean sentences → logs: `mode: single_chunk_fast_start, first_chunk_chars: ~100-150`
3. Send supportive message: "Мне тяжело" → logs: `mode: single_chunk_fast_start` or `full_response_only` (no harsh cut)
4. Send technical text with URLs → logs: `mode: full_response_only`
5. Listen — short responses should feel snappier, long responses should start with complete thought

---

## Voice Interruption / Barge-In Layer v1.0

### What This Is

Bounded turn-supersession / stale-prevention layer. Ensures **stale voice responses are never delivered** after a newer user turn arrives. If user sends a new message while voice is being synthesized, the old voice is cancelled — preventing "late" or irrelevant responses.

### What This Is NOT

- **NOT live audio interruption** — doesn't stop mid-playback audio
- **NOT streaming barge-in** — no microphone capture or real-time audio cutting
- **NOT websocket/RTP/VoIP** — pure pre-send stale-check gate
- **NOT meaning loss** — cancelled voice is dropped cleanly, no partial sends

### Interruption Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| `active` | Voice is being prepared for current turn | Continue synthesis |
| `superseded` | Newer user turn arrived | Cancel voice send |
| `cancelled` | Voice explicitly cancelled | Don't send |
| `safe_to_send` | Voice is current and safe | Proceed to send |

### Decision Rules

| Rule | Trigger | Result |
|------|---------|--------|
| **A** — latest turn wins | Newer user turn registered | `status=superseded`, cancel send |
| **B** — same turn valid | Voice matches latest turn | `status=safe_to_send`, allow send |
| **C** — check before send | Right before `replyWithVoice()` | Mandatory stale gate |
| **D** — first-audio also checked | Fast-start path | Same stale gate applies |
| **E** — no over-cancellation | Same turn, no new message | Never cancel valid voice |

### Turn Key Discipline

Turn identity is stable and deterministic:
- Format: `{chatId}:{messageId}`
- Example: `12345:999`
- Each incoming message immediately registers as latest turn

### In-Memory Turn Registry

- `Map<chatId, ChatTurnState>` — per-chat latest turn tracking
- ChatTurnState: `{latestUserMessageId, latestTurnKey, updatedAtMs}`
- Ephemeral — lost on server restart
- Isolated per chat — chat A interruption never affects chat B

### Integration Points

1. **On incoming message**: `registerLatestUserTurn()` — immediately marks this as latest turn
2. **When preparing voice**: `createVoiceInterruptionContext()` — captures turn identity for this voice response
3. **Right before sendVoice**: `evaluateVoiceInterruption(ctx)` — mandatory stale gate
4. **If superseded**: return without sending — clean exit, no crash, no stale audio

### Observability

| Log Event | When |
|-----------|------|
| `voice_interruption_context_created` | Voice response preparation begins |
| `voice_interruption_decision` | Stale gate evaluated (status, cancel/allow, superseded info) |
| `voice_send_cancelled_stale` | Voice blocked due to newer user turn |
| `voice_send_allowed_current` | Voice cleared stale gate, proceeding to send |

### Config

No new env vars. Interruption layer is fully automatic — latest turn always wins.

### How to Verify

1. Send message "привет" → bot starts synthesizing voice
2. Quickly send another message "что нового?" before voice is ready
3. Observe logs: `voice_interruption_decision, status: superseded, should_cancel: true`
4. Observe logs: `voice_send_cancelled_stale, reason: newer_user_turn_superseded_pending_voice`
5. No stale voice delivered — only response to latest message is sent
6. Send single message, wait for voice → logs: `status: safe_to_send, voice_send_allowed_current`

---

## Voice Response Assembly Layer v1.0

### What This Is

Bounded spoken-first response assembly — prepares text for voice delivery BEFORE TTS synthesis. Makes text naturally speakable, not just readable. Reduces cases where text looks fine written but sounds heavy/awkward when spoken.

### What This Is NOT

- **NOT LLM rewriting** — no generative paraphrasing
- **NOT meaning change** — facts and intent preserved exactly
- **NOT full regeneration** — cleanup only, not rewrite
- **NOT telegraph style** — keeps natural flow, just removes written heaviness

### Assembly Modes

| Mode | When | Effect |
|------|------|--------|
| `direct_spoken` | Direct user tone, crisp_direct cadence | Remove fillers, compact opening |
| `soft_spoken` | Warm/neutral context | Gentle cleanup |
| `guided_spoken` | High complexity, explanatory cadence | Remove fillers, reduce density, shorten sentences |
| `supportive_spoken` | Support-seeking user, gentle cadence | Remove dangling openers, soften tone |

### Text Cleanup Heuristics

| Operation | When | What |
|-----------|------|------|
| Remove leading fillers | direct_spoken, guided_spoken | "Ну,", "Короче,", "Смотри," → removed |
| Soften dangling openers | supportive_spoken, soft_spoken | "Смотри,", "Потому что" → removed |
| Replace written connectors | High complexity, long answers | Em-dashes → periods, colons → periods |
| Split long sentences | High complexity, explanatory cadence | >150 char sentences split at commas |
| First sentence extraction | Always | Clean spoken unit for first-audio layer |

### First Sentence Discipline

First sentence must be:
- Complete enough (≥ 5 chars)
- Spoken-safe (no dangling fillers)
- Not too dense (no stacked clauses)
- Not abrupt in supportive contexts
- Helpful for first-audio layer

### Integration

After cadence decision, before first-audio and provider synthesis. `fullSpokenText` replaces `deliveryText` for all voice synthesis. `firstSentenceText` available for future first-audio integration.

### Observability

| Log Event | When |
|-----------|------|
| `voice_assembly_started` | Assembly begins, source text length |
| `voice_assembly_decision` | Mode, full_spoken_chars, first_sentence_chars, flags, hints, warnings |
| `voice_assembly_applied` | Output chars, first sentence chars |

### Config

No new env vars. Assembly is fully automatic based on context signals.

### How to Verify

1. Send "Ну, короче, смотри, я это сделал." → logs: `mode: direct_spoken`, text: "Я это сделал." (fillers removed)
2. Send long explanation with em-dashes and colons → logs: `should_reduce_density: true`, text with periods instead of dashes
3. Send supportive message → logs: `mode: supportive_spoken`, first sentence complete and gentle
4. Compare raw text vs assembled text — assembled should sound more natural when read aloud

---

## Voice Turn Smoothing Layer v1.0

### What This Is

Bounded turn-edge shaping — smoothes entry and exit of voice turns so responses feel like natural continuations, not hard-cut audio packets. Reduces "abrupt start/stop" feeling in spoken delivery.

### What This Is NOT

- **NOT audio DSP** — no signal processing
- **NOT prosody engine** — no SSML or TTS markup
- **NOT content rewrite** — only edge cleanup
- **NOT making everything equally soft** — direct stays direct, supportive stays supportive

### Entry Modes

| Mode | When | Effect |
|------|------|--------|
| `clean_direct_entry` | Direct/concise contexts | Compact opening, remove soft intro |
| `soft_continuation_entry` | Continuing conversation | Gentle reentry, no cold restart |
| `warm_reentry_entry` | Warm follow-up | Warm continuation feel |
| `supportive_gentle_entry` | Supportive contexts | Calming, low-pressure opening |

### Exit Modes

| Mode | When | Effect |
|------|------|--------|
| `clean_stop` | Short practical answers | Crisp ending, no trailing |
| `soft_landing` | Medium/long warm answers | Gentle fade-out |
| `warm_hold` | Warm continuing | Warm continuation at ending |
| `supportive_hold` | Supportive contexts | Emotionally non-harsh ending |

### Edge Cleanup Heuristics

| Cleanup | When | What |
|---------|------|------|
| Remove abrupt openers | Direct, continuation, supportive modes | "Так.", "Ну.", "Смотри,", "Короче." → removed |
| Remove dangling endings | All modes | "...", "и всё.", "вот.", "короче." → cleaned |
| Soften endings | Soft landing, warm hold, supportive hold | Harsh endings → period, natural closure |
| Clean trailing punctuation | Clean stop mode | Ellipsis, commas, dashes → removed |

### Integration

After assembly, before first-audio and provider synthesis. `smoothedText` replaces `spokenText` for all voice synthesis.

### Observability

| Log Event | When |
|-----------|------|
| `voice_turn_smoothing_started` | Smoothing begins, input chars |
| `voice_turn_smoothing_decision` | Entry mode, exit mode, flags, hints, warnings |
| `voice_turn_smoothing_applied` | Output chars |

### Config

No new env vars. Smoothing is fully automatic based on context signals.

### How to Verify

1. Send "Так. Смотри, я это сделал." → logs: `entry_mode: clean_direct_entry`, text: "Я это сделал." (abrupt openers removed)
2. Send follow-up in continuing conversation → logs: `entry_mode: soft_continuation_entry` (no cold restart)
3. Send supportive message → logs: `exit_mode: supportive_hold` (non-harsh ending)
4. Send short answer → logs: `exit_mode: clean_stop` (crisp ending)
