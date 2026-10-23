# Speech-to-Text (STT) and Text-to-Speech (TTS) for Tamil (ta-IN) - Provider Research

Status: COMPLETE (started 2026-10-22, completed 2026-10-22)

Project: AgroSaarthi AI (Tamil Nadu first; web voice assistant plus a telephone channel for button-phone users).
Stack: Angular 21 SPA, Node 20+/Express 5/TypeScript backend, MongoDB, Python FastAPI + onnxruntime model service, Gemini as first conversational AI provider.

## TL;DR

- Primary STT and TTS for BOTH the web assistant and the telephone channel: **Sarvam AI** (STT `saaras:v4`, TTS `bulbul:v3`). One API key (header `api-subscription-key`), Rs 100 one-time free credit, Tamil STT and Tamil TTS, accepts browser WebM/Opus directly, STT model documented as "optimized for 8KHz telephony audio", TTS can emit 8 kHz audio.
- Fallbacks: STT -> Gemini audio understanding using the Gemini API key the project already needs (free tier on audio input), then Azure AI Speech `ta-IN`; TTS -> Azure Neural `ta-IN-PallaviNeural` (single key, 0.5M chars/month free), then Gemini TTS (paid, Tamil supported), then Google Cloud TTS (needs a service account).
- Rejected as primary: AWS (Polly has NO Tamil), Bhashini (official docs: "PoC only"), Google Cloud (documented auth is service account / OAuth only; developer has no cloud credentials), browser Web Speech API (Chromium/Safari only, audio goes to a vendor cloud, Tamil support not verified), self-hosted AI4Bharat models (good licences, but GPU + ops cost; defer).
- Hard limits to design around: Sarvam REST STT = 30 seconds per request; no per-utterance confidence from Sarvam (only `language_probability`); TTS `opus` codec errors on bulbul:v3 / v4-flash; no SSML; use native Tamil script.

## 1. Scope & method

- Question: which STT/TTS to use for Tamil (ta-IN) first (Telugu, Kannada, Malayalam, Hindi later) for (1) a browser voice assistant and (2) a telephone channel (8 kHz audio), given the developer has NO cloud credentials today and wants the simplest credential plus a free tier.
- Date: 2026-10-22. All facts were looked up on the live web on that date using WebSearch and WebFetch (52 web tool calls in total, above the ~30 guideline, because several pages redirected or were truncated and decision-critical field names needed a second look).
- Evidence labels used below:
  - [P] = read on the vendor's own page. NOTE: WebFetch passes pages through a small summariser model, so numbers/field names are "as extracted"; pages returned verbatim (no summariser) are marked [RAW].
  - [S] = secondary only (search-result summary, third-party page, or a page that could not be read in full).
  - [U] = UNVERIFIED (could not be confirmed; do not rely on it without checking).
- Known page-load problems: Google Cloud STT pricing page and TTS pricing page returned truncated bodies; the Google TTS voice list page was truncated before the Tamil rows; Azure pricing page shows "$-" placeholders for paid prices (free tier visible); `cloud.google.com/free/docs/free-cloud-features` redirected and was not followed; Bhashini sub-pages with endpoint/header details were not fetched individually.
- Not covered (out of scope or not checked): measured Tamil accuracy (WER) and latency of any provider; data-residency and retention terms; legal/consent (e.g. DPDP Act) requirements. These need a bake-off and a legal check (Section 6).

## 2. Options compared

### 2A. Speech-to-Text (Tamil, ta-IN)

| Option | Tamil STT | Credential | Free tier | Browser webm/opus | 8 kHz phone audio | Sync limit | Confidence returned | List price | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Sarvam `saaras:v4` / `saaras:v3` (REST) | Yes, `ta-IN` (+ auto-detect `unknown`) [P] | One API key, header `api-subscription-key` [P] | Rs 100 one-time credit, never expires [P] | Accepted (WebM, OPUS, OGG, MP3, AAC, M4A, WAV, FLAC, AMR...) [P] | Saaras "optimized for 8KHz telephony audio" [P]; streaming 8000/16000 Hz WAV/PCM [P]; REST 8 kHz rule not stated [U] | 30 s per request (batch 2 h/file) [P] | No per-utterance score; only `language_probability` [P] | Rs 0.49/min pay-as-you-go [P] | PRIMARY |
| Google Cloud STT v2 (`chirp_3`, `chirp_2`, `chirp`, `long`, `short`) and v1 | Yes, `ta-IN` in all those v2 models; Chirp 3 GA [P] | Service account / OAuth bearer; API keys NOT documented [P] | [U] (60 min/month is commonly cited, not confirmed) | v1 enum has WEBM_OPUS and OGG_OPUS [P]; v2 `auto_decoding_config` [P] | v1 MULAW 8 kHz supported [P] | v1: ~1 min and 10 MB; Chirp 3 Recognize: under 1 min [P] | Word-level (`enableWordConfidence`); Chirp 3 value "isn't truly a confidence score" [P] | V2 standard $0.016/min first 500k min/month [S] | Fallback / bake-off candidate |
| Azure AI Speech (REST short audio, fast transcription, SDK) | Yes, `ta-IN` real-time + fast + batch [P] | One resource key `Ocp-Apim-Subscription-Key` (needs Azure subscription) [RAW] | F0: 5 audio hours/month [P] | REST accepts only WAV PCM 16 kHz mono and OGG OPUS 16 kHz mono, so WebM must be transcoded [RAW] | Not listed for REST short audio; upsample to 16 kHz [RAW] | 60 s [RAW] | Yes, `format=detailed` -> `NBest[].Confidence` [RAW] | [U] (page shows "$-") | Fallback #2 (STT) |
| AWS Transcribe | Yes, `ta-IN` batch + streaming (streaming not in 5 regions) [RAW] | IAM keys (not checked) [U] | [U] | [U] | [U] | [U] | [U] | [U] | Excluded (no Tamil TTS on AWS) |
| Gemini audio understanding (`gemini-3.8-flash`) | LLM transcription; page has no language list [U] | Gemini API key (already needed for chat) [P] | Free tier: Yes for audio input [P] | `audio/webm`, `audio/opus`, `audio/ogg`... listed [P] | `audio/mulaw`, `audio/alaw`, `audio/l16` listed; audio downsampled to 16 Kbps [P] | 20 MB inline request; 9.5 h per prompt [P] | None [P] | $3.00 per 1M audio input tokens, "$0.005/min" [P] | Fallback #1 (STT) |
| Bhashini / ULCA (Dhruva pipeline) | ASR for Tamil exists [S] | userID + ulcaApiKey -> inferenceApiKey [S] | "PoC only" usage terms [P] | [U] | [U] | [U] | [U] | Production access by contacting Bhashini team [P] | Not for production |
| AI4Bharat IndicConformer 600M (self-host) | Yes (`ta`, 22 languages) [P] | None (MIT licence) [P] | n/a | We transcode to 16 kHz mono [P] | Upsample to 16 kHz | Unlimited (we chunk) | We would derive from CTC/RNNT [U] | Our hardware | Later phase |
| Browser Web Speech `SpeechRecognition` | `ta-IN` acceptance [U] | None | Free | Chromium + Safari only [P] | Not usable for phone | Browser-defined | [U] | Free | Optional enhancement only |

### 2B. Text-to-Speech (Tamil, ta-IN)

| Option | Tamil voices | Credential | Free tier | Output formats | 8 kHz output | Input limit | List price | Verdict |
|---|---|---|---|---|---|---|---|---|
| Sarvam `bulbul:v3` (stable default), `bulbul:v4-flash` (latest) | v3: 30+ named speakers incl. ritu, ishita, ratan, rohan, shubh; v4-flash: 222 persona ids (Tamil supported; no Malayalam/Odia) [P] | One API key | Rs 100 one-time credit [P] | Working: wav, mp3, aac, flac, linear16; `opus` returns a validation error; `mulaw`/`alaw` are in the schema but not confirmed [P] | `speech_sample_rate: 8000` supported (REST 8k-48k; streaming 8k-24k) [P] | 2,500 chars per request [P] | v3 Rs 3.00 per 1,000 chars; v4-flash Rs 2.00 per 1,000 chars [P] | PRIMARY |
| Google Cloud TTS (Standard/WaveNet/Neural2/Chirp 3 HD) | Chirp 3 HD lists `ta-IN` (`ta-IN-Chirp3-HD-<Name>`) [P]; Standard/WaveNet/Neural2 Tamil inventory [U] | Service account / OAuth; API keys not documented [P] | [S] 4M chars Standard, 1M Chirp 3 HD/Neural2 (WaveNet line inconsistent) | LINEAR16, MP3, OGG_OPUS, MULAW, ALAW, PCM [P] | Yes via `sampleRateHertz` / MULAW / ALAW [P] | [U] (not on fetched page) | [S] Chirp 3 HD $30/1M chars | Fallback #3 (TTS) |
| Azure Neural TTS | `ta-IN-PallaviNeural` (F), `ta-IN-ValluvarNeural` (M); no styles [P] | One resource key | F0: 0.5M chars/month [P] | riff/raw 8-48 kHz PCM, mulaw, alaw, mp3, ogg/webm opus, amr-wb, g722 [RAW] | `raw-8khz-8bit-mono-mulaw`, `riff-8khz-16bit-mono-pcm` [RAW] | Audio capped at 10 min [RAW] | [U] | Fallback #1 (TTS) |
| AWS Polly | NO Tamil (only hi-IN and en-IN among Indian languages) [RAW] | - | - | - | - | - | - | Excluded |
| Gemini TTS (`gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`) | Tamil supported; 30 prebuilt voices [P] | Gemini API key | NO free tier [P] | WAV 24 kHz mono 16-bit (unary); `audio/l16` PCM (streaming) [P] | Convert ourselves | [U] | Flash $9 per 1M audio tokens through 2026-12-31, then $18; Flash-Lite $6 then $12 [P] | Fallback #2 (TTS, paid) |
| Bhashini TTS | Exists [S] | userID + ulcaApiKey [S] | "PoC only" [P] | [U] | [U] | [U] | contact team [P] | Not for production |
| AI4Bharat Indic Parler-TTS (self-host) | Tamil yes; speakers Kavitha, Jaya (Jaya recommended) [P] | None (Apache-2.0) [P] | n/a | We encode (wav/mp3) | We resample | [U] | GPU cost | Later phase |
| Browser `speechSynthesis` | Device-dependent [U] | None | Free | n/a | Not usable for phone | n/a | Free | Last-resort only |

## 3. Findings per option with citations

### 3.1 Sarvam AI (STT + TTS)

Sources: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe ; https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert ; https://www.sarvam.ai/api-pricing ; https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview ; https://docs.sarvam.ai/api/getting-started/ratelimits ; https://docs.sarvam.ai/api/speech-to-text/faq ; https://docs.sarvam.ai/api-reference-docs/getting-started/models/bulbul ; https://docs.sarvam.ai/api-reference-docs/getting-started/models/saaras (all fetched OK on 2026-10-22, summariser-extracted [P]).

STT (REST, synchronous):
- `POST https://api.sarvam.ai/speech-to-text`; auth header `api-subscription-key` (single API key, no service account).
- multipart/form-data. Required: `file`. Optional: `model` (default `saaras:v4` "latest, recommended"; also `saaras:v3`); `language_code` (BCP-47, defaults to `unknown` = auto-detect; `ta-IN`, `hi-IN`, `te-IN`, `kn-IN`, `ml-IN`, `en-IN` and ~18 more supported); `mode` ("Only applicable when using saaras:v3 model": transcribe (default), translate, verbatim, translit, codemix); `with_timestamps` (bool); `input_audio_codec` ("PCM files are supported only at 16kHz sample rate"); `keyterms` (up to 50 domain terms, saaras:v4 only, REST and Batch only; "Sent as a JSON-encoded array in one multipart form field, e.g. keyterms=[\"Sarvam\",\"New Delhi\",\"Vistaar\"]").
- Note a documentation conflict: the REST reference says `mode` applies to saaras:v3 only, while the Saaras model page says v4 also has five modes. Do not send `mode` with v4 (default is transcribe).
- Accepted formats: "WAV, MP3, AAC, AIFF, OGG, OPUS, FLAC, MP4/M4A, AMR, WMA, WebM, and PCM" (FAQ: REST/Batch "WAV, MP3, M4A, AAC, OGG, FLAC, WebM, PCM (pcm_s16le, pcm_l16, pcm_raw)"; WebSocket streaming: WAV and raw PCM only). 16 kHz is optimal / recommended ("16kHz or higher"). Behaviour for native 8 kHz WAV on REST, automatic conversion and max file size: not stated [U].
- Limits: REST 30 seconds per request; Batch 2 hours per file and 20 files per job; streaming WebSocket 16000 Hz (default) or 8000 Hz.
- Response JSON: `request_id`, `transcript`, `language_code`, `language_probability` (0.0-1.0; a language-ID probability, NOT a transcription confidence), `timestamps` (only if requested). No diarization on REST. No per-utterance or per-word confidence documented.
- HTTP errors documented: 400, 403, 422, 429 (quota exceeded), 500, 503.
- Models: `saaras:v4` (default), `saaras:v3`, `saaras:v2.5` ("deprecated soon", separate `/speech-to-text-translate` endpoint). The older "Saarika" name is not in current docs. Both v3/v4: 22 Indian languages + English, automatic language detection, "Optimized for 8KHz telephony audio with enhanced multi-speaker recognition capabilities", code-mixed audio support with proper noun/entity preservation. v4 adds "Global English" and keyterm prompting. Latency numbers: not stated [U]. Vendor accuracy claim (generic, not Tamil-specific): 95-98% for clear speech with minimal noise, 85-90% with heavy accent or noise (unverified marketing figure).

TTS (REST, synchronous):
- `POST https://api.sarvam.ai/text-to-speech`; headers `api-subscription-key: <key>` and `Content-Type: application/json`. Verbatim vendor sample body: `{"text": "Welcome to Sarvam AI!", "language_code": "hi-IN"}`. The language field is `language_code` (NOT `target_language_code`); required fields: `text` and `language_code`.
- Optional fields: `speaker` (default `shubh` for bulbul:v3, `anushka` for v2, `shubh_enhi_ads` for v4-flash); `model` (`bulbul:v2`, `bulbul:v3` default, `bulbul:v4-flash`); `pace` (v3/v4: 0.5-2.0; v2: 0.3-3.0; default 1.0); `pitch` (-0.75..0.75) and `loudness` (0.3-3.0) only on v2; `speech_sample_rate` (8000, 16000, 22050, 24000, 32000, 44100, 48000; default 22050; 32k/44.1k/48k are REST-only); `output_audio_codec` (enum `mp3`, `linear16`, `mulaw`, `alaw`, `opus`, `flac`, `aac`, `wav`; default `wav`); `enable_preprocessing` (default false; not supported on v3/v4-flash); `temperature` (0.01-1.0, default 0.6; v3 and v4-flash); `dict_id` (custom pronunciation dictionary); `enable_cached_responses` (beta; v1/v2 only).
- Codec caveat (from the field description): "On /text-to-speech with bulbul:v3 and bulbul:v4-flash, opus is listed for schema compatibility but currently returns a validation error." The Bulbul page says "wav, mp3, aac, flac, and linear16" work with v3 and v4-flash. `mulaw`/`alaw` are in the schema enum but their working status on v3/v4-flash is not confirmed [U]: smoke-test them, else request `wav` at 8000 Hz and transcode.
- Text limit: 2,500 characters per request (v3 and v4-flash); 1,500 on v2. No SSML. "Romanised Indic input degrades quality": send native Tamil script. Number/English-word normalisation: not stated [U] (so verify how numerals and units like "ml" and "kg" are spoken).
- Response 200: `request_id`, `audios` (array of base64 strings). Error codes (strings): invalid_request_error, internal_server_error, unprocessable_entity_error, insufficient_quota_error, invalid_api_key_error, authentication_error, not_found_error, rate_limit_exceeded_error, model_call_error, gateway_timeout_error, billing_service_unavailable_error.
- Models: `bulbul:v4-flash` (latest): 200+ persona voices (222 ids, naming `<name>_<language>_<style>`, e.g. `ishita_hi_devotional`), languages Hindi, English, enhi, Bengali, Gujarati, Kannada, Marathi, Punjabi, Tamil, Telugu (NO Malayalam, NO Odia). `bulbul:v3` (stable default): 30+ named speakers, 11 languages including Malayalam and Odia. Speakers (lower-case in API): shubh (default), aditya, ritu, priya, neha, rahul, pooja, rohan, simran, kavya, amit, dev, ishita, shreya, ratan, varun, manan, sumit, roopa, kabir, aayan, ashutosh, advait, anand, tanya, tarun, sunny, mani, gokul, vijay, shruti, suhani, mohit, kavitha, rehan, soham, rupali. No Tamil speaker recommendation on the Bulbul page; a search summary of the Voices page [S] claims Tamil-recommended voices are male `ratan`, `rohan` and female `ishita`, `ritu` (https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices, not fetched).
- Streaming sample rates: 8k-24k Hz. Telephony/8 kHz note on the Bulbul page: not stated.

Pricing and free tier ([P] https://www.sarvam.ai/api-pricing, https://docs.sarvam.ai/api/getting-started/ratelimits):
- STT: Rs 0.49/min pay-as-you-go (real-time and batch), Rs 0.45 Pro, Rs 0.41 Growth/Business. TTS per 1,000 characters: Bulbul V4 Flash Rs 2.00 / 1.85 / 1.70; Bulbul V3 Rs 3.00 / 2.85 / 2.70 (PAYG / Pro / Growth-Business).
- Free: "Rs 100 worth of free credits for every user on signup"; "Credits are universal and never expire". This is a one-time credit, not a recurring monthly free tier. (Search results mention an older Rs 1,000 signup credit; the rate-limits page now says Rs 100.)
- Rate limits (Starter / Pro / Business): STT REST 60 / 100 / 4,000 req/min; STT WebSocket concurrency 20 / 100 / 100; TTS REST 60 (30 for bulbul:v3) / 200 / 1,000 req/min; TTS WebSocket concurrency 60 (30 for v3) / 200 / 1,000.
- Plan prices (Pro Rs 10,000, Business Rs 50,000, Enterprise custom) come from a search snippet of https://docs.sarvam.ai/api/getting-started/pricing only [S].
- Not checked [U]: data residency/retention, commercial-use licence terms (page exists: https://docs.sarvam.ai/api/getting-started/commercial-licensing, not fetched), WebSocket streaming endpoint URL.

### 3.2 Google Cloud Speech-to-Text (v1 / v2 / Chirp)

Sources: https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages (old cloud.google.com URL 301-redirects here) ; https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3 ; https://docs.cloud.google.com/speech-to-text/quotas ; https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v1/RecognitionConfig ; https://docs.cloud.google.com/speech-to-text/docs/authentication ; https://cloud.google.com/speech-to-text/pricing (search summary only).
- Tamil (India) `ta-IN` appears in V2 models `chirp_3` (automatic punctuation, model adaptation, profanity filter), `chirp_2` (+ word-level confidence), `chirp` (automatic punctuation), `long` (word-level confidence), `short` (model adaptation, word-level confidence). No diarization/spoken punctuation for Tamil. The region lists the summariser produced looked incomplete [U].
- Chirp 3: Tamil in the GA language list; GA locations `us` and `eu` multi-regions (examples also use `asia-southeast1`; an India region is [U]); methods `Speech.StreamingRecognize`, `Speech.Recognize` (audio shorter than one minute), `Speech.BatchRecognize` (about 1 min to 1 hour; up to 20 minutes with word-level timestamps); `language_codes=['auto']` auto-detect; word-level confidence "isn't truly a confidence score"; Chirp models are V2 only. Python example fields: `recognizer`, `config` (`auto_decoding_config`, `language_codes`, `model='chirp_3'`), `content`.
- V1 limits (quotas page): sync Recognize ~1 minute and 10 MB; StreamingRecognize ~5 minutes per stream, 10 MB per message; 900 recognition requests per 60 s; 480 hours of audio per day. Page recommends V2 for new users.
- V1 `RecognitionConfig`: encodings LINEAR16, FLAC, MULAW (G.711 8-bit), OGG_OPUS, WEBM_OPUS, MP3 (beta); for OGG_OPUS/WEBM_OPUS `sampleRateHertz` must be one of 8000, 12000, 16000, 24000, 48000; range 8000-48000, 16000 optimal, required except for FLAC/WAV; `audioChannelCount` 1-8 (1 for MULAW); `languageCode` required; `enableAutomaticPunctuation`; `enableWordConfidence`.
- Auth: the Speech-to-Text authentication page documents only Application Default Credentials / service accounts / gcloud OAuth bearer (`Authorization: Bearer $(gcloud auth print-access-token)`, scope `https://www.googleapis.com/auth/cloud-platform`); API keys are NOT mentioned. A plain single API key is therefore not a documented option. V1 REST endpoint: `POST https://speech.googleapis.com/v1/speech:recognize`.
- Pricing [S]: V2 standard models $0.016 per minute for the first 500,000 minutes/month, tiering to $0.004/min at 2,000,000+; Chirp 3 billed at the standard rate. The direct page fetch was truncated. Free tier: [U] (the only "60 free minutes per month" statement found was in an on-prem context).

### 3.3 Google Cloud Text-to-Speech

Sources: https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize ; https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd ; https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types (truncated) ; https://cloud.google.com/text-to-speech/pricing (search summary only).
- REST: `POST https://texttospeech.googleapis.com/v1/text:synthesize`. Fields: `input.text` or `input.ssml`; `voice.languageCode`; `voice.name`; `audioConfig.audioEncoding` (LINEAR16, MP3, OGG_OPUS, MULAW, ALAW, PCM); `audioConfig.sampleRateHertz`; `speakingRate`, `pitch`, `volumeGainDb`, `effectsProfileId`. Response `audioContent` (base64). OAuth scope cloud-platform; API keys not mentioned; max input size not stated on the fetched page [U] (commonly 5,000 bytes; not verified).
- Chirp 3: HD: `ta-IN` is a supported language; voice naming `ta-IN-Chirp3-HD-<VoiceName>` (Tamil voice-name list not visible on the page [U]); streaming output ALAW, MULAW, OGG_OPUS, PCM; batch output ALAW, MULAW, MP3, OGG_OPUS, PCM; default LINEAR16; GA endpoints global, us, eu, asia-southeast1, europe-west2, asia-northeast1; no SSML on streaming; Chirp 3 HD does not support SSML input generally.
- Standard/WaveNet/Neural2 Tamil voices: the full voices page was truncated before Tamil. A third-party doc (https://edesy.in/docs/voice-agent/tts/google) mentions `ta-IN-Neural2-A` [S]. Exact inventory [U].
- Pricing [S] (search summary; internally suspicious): Chirp 3 HD $30 per 1M chars (first 1M free/month); Neural2 $16 per 1M (1M free); WaveNet $4 per 1M (4M free); Standard $4 per 1M (4M free). The WaveNet line conflicts with common recollection ($16 per 1M, 1M free); read the pricing page before relying on it.

### 3.4 Azure AI Speech

Sources (RAW unless noted): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short (updated 2026-06-05) ; https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech (updated 2026-05-21) ; https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support [P] ; https://azure.microsoft.com/en-us/pricing/details/speech/ [P].
- Tamil: STT `ta-IN` supported for real-time and fast transcription (batch/custom speech too); phrase list and pronunciation assessment not listed for ta-IN. TTS voices `ta-IN-PallaviNeural` (female) and `ta-IN-ValluvarNeural` (male), standard neural, no styles/roles. No ta-LK/ta-SG/ta-MY locales.
- STT REST short audio: `POST https://YourResourceName.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1?language=ta-IN&format=detailed` (`language` REQUIRED or 4xx; `format` simple (default) | detailed; `profanity` masked (default) | removed | raw). Max 60 s of audio, final results only. Accepted audio: WAV PCM 16 kHz mono (`Content-type: audio/wav; codecs=audio/pcm; samplerate=16000`) and OGG OPUS 16 kHz mono (`Content-type: audio/ogg; codecs=opus`). Auth `Ocp-Apim-Subscription-Key` or `Authorization: Bearer <token>` (token from `POST https://<region>.api.cognitive.microsoft.com/sts/v1.0/issueToken`, valid 10 min). Response simple: `RecognitionStatus` (Success, NoMatch, InitialSilenceTimeout, BabbleTimeout, Error), `DisplayText`, `Offset`, `Duration`; detailed adds `NBest[]` with `Confidence`, `Lexical`, `ITN`, `MaskedITN`, `Display`. Status codes listed: 100, 200, 400, 401, 403. The page says to use this endpoint only when the Speech SDK or fast transcription API cannot be used, and that chunked upload ("Transfer-Encoding: chunked", "Expect: 100-continue") "can significantly reduce the latency". Browser MediaRecorder gives WebM (not OGG) so audio must be transcoded.
- TTS REST: `POST https://<region>.tts.speech.microsoft.com/cognitiveservices/v1` (e.g. `centralindia`). Headers `Ocp-Apim-Subscription-Key` or `Authorization: Bearer`, `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat`, `User-Agent`. SSML body. Audio capped at 10 minutes. Status codes 200, 400, 401, 415, 429, 502, 503. Voice list `GET https://<resource>.cognitiveservices.azure.com/tts/cognitiveservices/voices/list`. Output formats include `riff-8khz-8bit-mono-alaw`, `riff-8khz-8bit-mono-mulaw`, `riff-8khz-16bit-mono-pcm`, `riff-24khz-16bit-mono-pcm`, `raw-8khz-8bit-mono-mulaw`, `raw-8khz-16bit-mono-pcm`, `raw-16khz-16bit-mono-pcm`, `audio-16khz-32kbitrate-mono-mp3`, `audio-24khz-48kbitrate-mono-mp3`, `ogg-16khz-16bit-mono-opus`, `webm-24khz-16bit-mono-opus`, `amr-wb-16000hz`, `g722-16khz-64kbps`. Docs inconsistency: the header table lists `Authorization` as required, while the Authentication table says the key header works for TTS too.
- Free tier [P]: Free (F0) = Speech-to-Text 5 audio hours free per month (shared between Standard and Custom); Neural Text-to-Speech 0.5 million characters free per month. Batch transcription not available on F0 [S]. Paid prices not visible on the page ("$-" placeholders) [U].

### 3.5 AWS Transcribe and Amazon Polly

Sources (RAW): https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html ; https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html
- Transcribe: Tamil `ta-IN` row = data input "batch, streaming*"; transcribing numbers "batch, streaming*"; acronyms (custom vocabulary) "streaming*"; custom language models no; redaction no; Call Analytics no. Streaming not available in af-south-1, ap-northeast-1, ap-southeast-5, ap-southeast-7, cn-northwest-1. Other Indian languages: hi-IN, te-IN, kn-IN, ml-IN, mr-IN, bn-IN, gu-IN, pa-IN, or-IN, en-IN all batch + streaming.
- Polly: Tamil is NOT in the language list. Indian entries are only Hindi `hi-IN` and English (Indian) `en-IN`. AWS cannot provide Tamil TTS, so it is excluded. Transcribe auth, audio-format and pricing details were not checked [U].

### 3.6 Bhashini / ULCA (Government of India)

Sources: https://bhashini.gitbook.io/bhashini-apis [P] ; https://bhashini.gitbook.io/bhashini-apis/pipeline-config-call/request-payload [P] ; other official sub-page URLs from a search listing [S].
- The official docs state "Usage of these APIs shall be for the purposes of PoC only"; paid production versions require contacting the Bhashini team. Flow: Pipeline Search call [optional], Pipeline Config call [mandatory], Pipeline Compute call [mandatory].
- Config-call request body (official sample): `{"pipelineTasks":[{"taskType":"asr","config":{"language":{"sourceLanguage":"xx"}}}],"pipelineRequestConfig":{"pipelineId":"xxxx8d51ae52cxxxxxxxx"}}` (same for `"taskType":"tts"`); the pipelineId comes from a Pipeline Search call or the ULCA web UI.
- Per search summaries [S]: config response has `pipelineInferenceAPIEndPoint` with `callbackUrl`, `inferenceApiKey` (`name` "Authorization", `value`), `isMultilingualEnabled`, `isSyncApi`; compute call for ASR needs `audio.audioContent` (base64). Third-party clients show headers `userID` and `ulcaApiKey`, config endpoint `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline`, inference endpoint `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`; access steps: sign up on the portal, verify e-mail, log in, My Profile, generate API key. A WebSocket ASR API page exists (https://dibd-bhashini.gitbook.io/bhashini-apis/websocket-asr-api). Registration steps and exact headers were not confirmed from an official page [U].
- Conclusion: no published SLA or free-tier numbers, "PoC only" terms: not a production dependency.

### 3.7 Gemini audio transcription and Gemini TTS (brief)

Sources: https://ai.google.dev/gemini-api/docs/speech-generation ; https://ai.google.dev/gemini-api/docs/audio ; https://ai.google.dev/gemini-api/docs/pricing (all [P], summariser-extracted).
- TTS models: `gemini-3.8-flash-tts` (GA), `gemini-3.8-flash-lite-tts` (GA), `gemini-3.1-flash-tts-preview` (Preview), `gemini-2.5-pro-preview-tts` (Preview). Tamil has checkmarks for Gemini 3.8 Flash TTS and Flash-Lite TTS. REST shown as `POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key: $GEMINI_API_KEY`; single speaker `speech_config: [{"voice": "Kore"}]`; multi-speaker `"speech_config": {"speakers": [{"speaker": "Joe", "voice": "Puck"}]}` with `"mode": "conversational"`. Unary audio is base64 `audio/wav`, 24 kHz mono 16-bit; streaming gives headerless `audio/l16` PCM 24 kHz mono 16-bit. 30 voices: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat. The full JSON skeleton of the new endpoint was not captured [U]; use the official SDK in the existing Gemini adapter instead of hand-written REST.
- Audio understanding: MIME types `audio/wav`, `audio/mp3`, `audio/aiff`, `audio/aac`, `audio/ogg`, `audio/flac`, `audio/mpeg`, `audio/m4a`, `audio/l16`, `audio/opus`, `audio/alaw`, `audio/mulaw`, `audio/webm`; up to 9.5 hours per prompt; 32 tokens per second (1 minute = 1,920 tokens); 20 MB total inline request (use the Files API above that); audio downsampled to 16 Kbps, multi-channel mixed to mono; timestamps in MM:SS shown; no confidence score; no language-support statement on the page; example model `gemini-3.8-flash`; content part shape shown `{"type": "audio", "data": "<base64>", "mime_type": "audio/mp3"}`.
- Pricing: Gemini 3.8 Flash TTS - no free tier, audio output $9.00 per 1M tokens through 2026-12-31 and $18.00 from 2027-01-01; Flash-Lite TTS - no free tier, $6.00 then $12.00; 3.1 Flash TTS Preview - no free tier, $20.00. Gemini 3.8 Flash audio input: free tier yes, "$3.00 or $0.005/min (audio)".

### 3.8 Self-hostable AI4Bharat models

Sources: https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual ; https://huggingface.co/ai4bharat/indic-parler-tts ([P], summariser-extracted from the model cards).
- IndicConformer 600M multilingual: licence `mit`; 600M parameters; 22 Indian languages incl. Tamil (`ta`); CTC and RNNT decoding; load with `transformers` `AutoModel.from_pretrained(..., trust_remote_code=True)`; install list includes `onnxruntime==1.20.1` and `onnxruntime-gpu==1.20.1`, tagged ONNX; input resampled to 16 kHz mono. Hardware requirement NOT stated [U]. Arithmetic only: 600M parameters = about 1.2 GB (fp16) to 2.4 GB (fp32) of weights; CPU real-time factor [U].
- Indic Parler-TTS: licence `apache-2.0` (commercial use allowed per licence); Tamil included; recommended Tamil speakers "Kavitha, Jaya" (Jaya recommended); 0.9B parameters; run via `pip install git+https://github.com/huggingface/parler-tts.git` and `AutoModelForSeq2SeqLM`; output rate is `model.config.sampling_rate` (value not stated [U]); speed options listed: SDPA, torch.compile, batching, streaming; GPU/VRAM requirement not stated [U]. Arithmetic only: 0.9B parameters = about 1.8 GB (fp16) to 3.6 GB (fp32) of weights; autoregressive codec TTS of this size is normally served on a GPU (inference, not a documented requirement). Parler-TTS style models take a text prompt plus a natural-language voice description (general knowledge, not re-verified).
- Operational fit: our Python FastAPI + onnxruntime service can host them, but we would own uptime, GPU cost, batching and audio post-processing. Defer until volume, privacy or offline needs justify it.

### 3.9 Browser Web Speech API

Sources: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition [P] ; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json [P] ; Windows Narrator voices page https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices [S].
- MDN flags SpeechRecognition "Limited availability - This feature is not Baseline because it does not work in some of the most widely-used browsers." Privacy, exact quote: "On some browsers, like Chrome, using Speech Recognition on a web page involves a server-based recognition engine. Your audio is sent to a web service for recognition processing, so it won't work offline." On-device path: `processLocally`, static `available()` and `install()` (Chrome 139+; unavailable on Android; Firefox "preview" only). `lang` defaults to the HTML `lang` attribute or the UA language.
- Compat data: Chrome 33+ with `webkit` prefix (unprefixed from 139; "Requires web server for recognition"); Edge, Samsung Internet, Opera and Android WebView mirror Chromium; Safari 14.1+ with `webkit` prefix; Firefox not shipped. Whether each vendor's service accepts `lang = "ta-IN"` was NOT verified [U] (test with `onerror` and the "language-not-supported" error name, which is general knowledge of the spec). HTTPS/mic-permission text not on the fetched excerpt [U] (secure context is the standard requirement for `getUserMedia`; not re-verified).
- speechSynthesis Tamil voices: no authoritative cross-platform statement found [U]. Search confirmed only that `getVoices()` returns what the browser and OS expose and that with no matching voice "a browser may stay silent or choose an unsuitable default". Windows has a Tamil natural voice "Valluvar" (male) for Narrator [S]; a Microsoft Q&A thread title ("Why are Natural Voices only available for Narrator and not for Text to Speech?") suggests natural voices may not be exposed to `speechSynthesis` [S]. Android/iOS/macOS Tamil voices not checked [U]. Do not rely on browser TTS for Tamil.

### 3.10 Telephony-provider speech features (examples only; provider not named in the brief)

- Twilio `<Gather>` (https://www.twilio.com/docs/voice/twiml/gather, search summary [S]): Tamil (India) `ta-IN` is in the language appendix (no enhanced/experimental model) but that table applied to Google v1 STT with Gather 1.0, which is being phased out for Gather 2.0 (per-provider language lists), so current Gather 2.0 ta-IN support is [U]. Twilio ConversationRelay voice configuration (https://www.twilio.com/docs/voice/conversationrelay/voice-configuration) reportedly lists Tamil TTS via Google, Amazon Polly or ElevenLabs with ElevenLabs default for ta-IN [S] (the Polly claim conflicts with the Polly language table above).
- Infobip IVR (https://www.infobip.com/docs/voice-and-video/interactive-voice-response-ivr/supported-speech-languages, [P]): Tamil (India) `ta-IN` is listed for speech recognition (also hi-IN, te-IN, kn-IN, ml-IN); TTS voices/engines, audio limits not listed on that page.
- Other Indian providers (Exotel, Ozonetel, Knowlarity, Plivo, etc.): not checked [U].
- Takeaway: some CPaaS vendors expose Tamil ASR, but quality/engine/limits are opaque. Keep our own provider-neutral STT/TTS adapters for the telephone path and use provider-native speech only as a measured optimisation.

## 4. Recommendation with trade-offs

### 4.1 Web voice assistant (Angular -> Express)

- STT primary: Sarvam `saaras:v4`, `language_code=ta-IN`, REST. Send the MediaRecorder blob as is (WebM/Opus, or MP4/M4A on Safari); on any 4xx/422 transcode to 16 kHz mono PCM WAV with ffmpeg and retry once. Cap recordings at 25 s on the client (REST limit is 30 s). Pass crop/pest/pesticide vocabulary in `keyterms` (up to 50).
- STT fallbacks, in order: (1) Gemini audio understanding via the SDK and the existing Gemini key (free tier on audio input; strict "transcribe verbatim, output only the Tamil transcript" prompt; no confidence); (2) Azure AI Speech `ta-IN` (create a Speech resource once; F0 gives 5 audio h/month; needs WAV 16 kHz or OGG Opus 16 kHz); (3) Google Chirp 3 only when a service account exists and a bake-off shows it is clearly better.
- TTS primary: Sarvam `bulbul:v3` (stable; 30+ speakers; 11 languages incl. Malayalam), `language_code=ta-IN`, `output_audio_codec=mp3`, `speech_sample_rate=24000`, short sentences, native Tamil script. Consider `bulbul:v4-flash` (about 33% cheaper) after choosing a Tamil persona from the Voices page and listening to it; note v4-flash has no Malayalam.
- TTS fallbacks, in order: (1) Azure `ta-IN-PallaviNeural` (key auth, F0 0.5M chars/month); (2) Gemini TTS `gemini-3.8-flash-lite-tts` (paid, no free tier; price doubles on 2027-01-01); (3) Google Cloud TTS (service account); (4) browser `speechSynthesis` only if a ta voice is detected, as an offline last resort.
- Browser SpeechRecognition: optional progressive enhancement only (Chromium/Safari; audio goes to the browser vendor; Tamil acceptance unverified); never the only path.

### 4.2 Telephone channel (button phones)

- Use the same Sarvam adapters; the telephony layer only records or streams audio (typically 8 kHz G.711) and plays audio back. Pipeline: provider webhook/recording -> ffmpeg normalise -> Sarvam STT (Saaras is documented as optimised for 8 kHz telephony audio) -> Gemini -> Sarvam TTS (`output_audio_codec=wav`, `speech_sample_rate=8000`; transcode to the provider's playback format, e.g. mu-law) -> play.
- Use telephony-provider-native Tamil ASR/TTS only if it is demonstrably accurate in a side-by-side test (Twilio's older Gather ta-IN and Infobip's ta-IN ASR listing exist, but engines and limits are opaque).
- Button-phone UX: short prompts, DTMF menus as the primary control with voice as an option, utterance cap of 25 s, read-back of numbers and product names before acting. Streaming/barge-in (Sarvam WebSocket: WAV/PCM at 8000 or 16000 Hz) is a later optimisation.
- Fallbacks mirror the web chain; Azure STT REST does not list 8 kHz input, so upsample to 16 kHz WAV first.

### 4.3 Credentials plan

1. Now: create a Sarvam account and API key (Rs 100 one-time credit, no cloud account) - covers STT + TTS for both channels.
2. Now: reuse the Gemini API key for the STT fallback (free tier on audio input).
3. Later (only if needed): an Azure Speech resource (F0 free tier; single key) as the second key-based provider.
4. Avoid for now: Google Cloud (project + billing + service account, API keys not documented for Speech), AWS, Bhashini.

### 4.4 Trade-offs

- Sarvam concentrates STT and TTS in one Indian vendor: simplest credential and best Indic/telephony fit, but single-vendor risk (pricing, model churn: saaras v2.5 -> v3 -> v4, bulbul v2 -> v3 -> v4-flash), unverified data-residency/retention terms, and rate limits on the Starter plan (STT REST 60 req/min; TTS v3 30 req/min).
- No per-utterance confidence from Sarvam: low-confidence handling must rely on `language_probability`, empty/very short transcripts, and read-back confirmation of critical entities (crop, pesticide, dosage numbers). Azure (NBest `Confidence`) and Google (word confidence) do return scores but need heavier credentials/transcoding.
- Gemini STT needs no new credential but is an LLM (may paraphrase, translate or hallucinate; no confidence; API shapes are changing) and Gemini TTS has no free tier.
- Self-hosting AI4Bharat (MIT / Apache-2.0) removes per-call fees and vendor lock-in but costs GPU + ops and has unverified latency.
- Accuracy is NOT measured here. The choice rests on credentials, formats, telephony fit, language coverage and cost; run the bake-off in Section 5.8 before committing production traffic.

### 4.5 Cost sketch (derived arithmetic from list prices; billing unit for "characters" not verified)

- Assumptions: 15 s farmer question, 400-character answer.
- STT: 0.25 min x Rs 0.49 = about Rs 0.12. TTS: v3 0.4 x Rs 3.00 = Rs 1.20; v4-flash 0.4 x Rs 2.00 = Rs 0.80.
- Per voice turn: about Rs 1.32 (v3) or Rs 0.92 (v4-flash); the Rs 100 free credit covers roughly 75 (v3) or 108 (v4-flash) turns. Cache static prompts/menus to save TTS cost (Sarvam's own `enable_cached_responses` is beta and v1/v2-only, so cache by hash of model+speaker+text+rate+codec in our own store).

## 5. Implementation details an engineer needs WITHOUT web access

### 5.1 Configuration keys (suggested)

```
SPEECH_STT_CHAIN=sarvam,gemini,azure        # order of providers
SPEECH_TTS_CHAIN=sarvam,azure,gemini
SARVAM_API_KEY=...                          # header api-subscription-key
SARVAM_STT_MODEL=saaras:v4
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_TTS_SPEAKER=ritu                     # choose by listening test; shubh is the vendor default
SPEECH_MAX_UTTERANCE_MS=25000               # REST STT hard limit is 30 s
AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=centralindia AZURE_SPEECH_ENDPOINT=https://<resource>.cognitiveservices.azure.com
GEMINI_API_KEY=...                          # already used for chat
```
Pin model names in config (not code): model names have changed several times.

### 5.2 Sarvam STT - exact contract

```
POST https://api.sarvam.ai/speech-to-text
Header:  api-subscription-key: <SARVAM_API_KEY>
         (do NOT set Content-Type by hand when sending FormData; the multipart boundary is added automatically)
Body (multipart/form-data):
  file           = <audio bytes>                         REQUIRED  (filename extension should match the container)
  model          = saaras:v4                             optional  (default saaras:v4; alt saaras:v3)
  language_code  = ta-IN                                 optional  (default "unknown" = auto-detect)
  with_timestamps= true|false                            optional
  input_audio_codec = <codec>                            optional  (for raw PCM; PCM only at 16 kHz)
  keyterms       = ["Thanjavur","Carbendazim", ...]      optional  (saaras:v4 only; JSON array in ONE form field; max 50)
  mode           = (omit; documented as saaras:v3-only)
Response 200 JSON:
  { "request_id": "...", "transcript": "...", "language_code": "ta-IN", "language_probability": 0.98, "timestamps": {...} }
Errors: HTTP 400, 403, 422, 429 (quota), 500, 503
Limits: 30 s audio per request (Batch API: 2 h/file, 20 files/job - separate endpoints, not covered here)
Formats: WAV, MP3, AAC, AIFF, OGG, OPUS, FLAC, MP4/M4A, AMR, WMA, WebM, PCM (16 kHz only)
```

Constructed curl (field names are verified; the command itself is assembled, not copied from the vendor):

```
curl -X POST https://api.sarvam.ai/speech-to-text \
  -H "api-subscription-key: $SARVAM_API_KEY" \
  -F "file=@sample.webm;type=audio/webm" \
  -F "model=saaras:v4" \
  -F "language_code=ta-IN"
```

### 5.3 Sarvam TTS - exact contract

```
POST https://api.sarvam.ai/text-to-speech
Headers: api-subscription-key: <SARVAM_API_KEY>
         Content-Type: application/json
Body:
  {
    "text": "<Tamil text, native script, <= 2500 chars, no SSML>",      REQUIRED
    "language_code": "ta-IN",                                           REQUIRED (not target_language_code)
    "model": "bulbul:v3",                                               optional (v3 default; also bulbul:v4-flash, bulbul:v2)
    "speaker": "ritu",                                                  optional (lower-case; v3 list in Section 3.1)
    "pace": 1.0,                                                        optional (v3/v4: 0.5-2.0)
    "speech_sample_rate": 24000,                                        optional (8000|16000|22050|24000|32000|44100|48000; default 22050)
    "output_audio_codec": "mp3",                                        optional (wav default; mp3, aac, flac, linear16 work; opus ERRORS; mulaw/alaw unconfirmed)
    "temperature": 0.6,                                                 optional (v3/v4-flash)
    "dict_id": "<pronunciation dictionary id>"                          optional
  }
  (pitch and loudness exist only on bulbul:v2; enable_preprocessing is not supported on v3/v4-flash)
Response 200 JSON: { "request_id": "...", "audios": ["<base64>", ...] }   -> Buffer.from(audios[0], "base64")
Errors (string codes): invalid_request_error, internal_server_error, unprocessable_entity_error, insufficient_quota_error,
  invalid_api_key_error, authentication_error, not_found_error, rate_limit_exceeded_error, model_call_error,
  gateway_timeout_error, billing_service_unavailable_error
Rate limits (Starter): 60 req/min (30 req/min for bulbul:v3); concurrency for WebSocket streaming 60 (30 for v3)
```
Expect one element in `audios` for one `text`; if more than one arrives, play sequentially (for WAV, decode and concatenate PCM rather than concatenating files) [behaviour not verified].

Constructed curl:

```
curl -X POST https://api.sarvam.ai/text-to-speech \
  -H "api-subscription-key: $SARVAM_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"வணக்கம்","language_code":"ta-IN","model":"bulbul:v3","speaker":"ritu","speech_sample_rate":24000,"output_audio_codec":"mp3"}' \
  | jq -r '.audios[0]' | base64 -d > out.mp3
```
(On Windows PowerShell, quoting JSON with Tamil text is awkward; use the Node script below for smoke tests.)

### 5.4 TypeScript reference adapters (Node 20+, global fetch/FormData/Blob)

```ts
export class SpeechProviderError extends Error {
  constructor(public provider: string, public status: number, public body: string) {
    super(`${provider} HTTP ${status}: ${body.slice(0, 300)}`);
  }
  get retryable() { return this.status === 429 || this.status >= 500; }
}

export interface SttResult { text: string; languageCode: string | null; languageProbability: number | null; requestId: string | null; provider: string; }

export async function sarvamTranscribe(
  audio: Buffer,
  o: { mimeType: string; filename: string; languageCode?: string; model?: string; keyterms?: string[]; timeoutMs?: number },
): Promise<SttResult> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY missing');
  const form = new FormData();
  form.append('file', new Blob([audio], { type: o.mimeType }), o.filename);   // e.g. 'audio/webm', 'audio.webm'
  form.append('model', o.model ?? process.env.SARVAM_STT_MODEL ?? 'saaras:v4');
  form.append('language_code', o.languageCode ?? 'ta-IN');
  if (o.keyterms?.length) form.append('keyterms', JSON.stringify(o.keyterms.slice(0, 50)));
  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': key },
    body: form,
    signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
  });
  if (!res.ok) throw new SpeechProviderError('sarvam', res.status, await res.text());
  const j = (await res.json()) as { request_id?: string | null; transcript?: string; language_code?: string | null; language_probability?: number | null };
  return {
    text: (j.transcript ?? '').trim(),
    languageCode: j.language_code ?? null,
    languageProbability: j.language_probability ?? null,
    requestId: j.request_id ?? null,
    provider: 'sarvam',
  };
}

export interface TtsResult { audio: Buffer; mimeType: string; sampleRateHz: number; provider: string; }

export async function sarvamSynthesize(
  text: string,
  o: { languageCode?: string; model?: string; speaker?: string; sampleRateHz?: number; codec?: 'mp3' | 'wav' | 'aac' | 'flac' | 'linear16'; pace?: number; timeoutMs?: number } = {},
): Promise<TtsResult> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY missing');
  if (text.length > 2500) throw new Error('split text first (limit 2500 chars)');
  const codec = o.codec ?? 'mp3';
  const sampleRateHz = o.sampleRateHz ?? 24000;
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language_code: o.languageCode ?? 'ta-IN',
      model: o.model ?? process.env.SARVAM_TTS_MODEL ?? 'bulbul:v3',
      speaker: o.speaker ?? process.env.SARVAM_TTS_SPEAKER ?? 'ritu',
      pace: o.pace ?? 1.0,
      speech_sample_rate: sampleRateHz,
      output_audio_codec: codec,
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
  });
  if (!res.ok) throw new SpeechProviderError('sarvam', res.status, await res.text());
  const j = (await res.json()) as { request_id?: string; audios?: string[] };
  const b64 = j.audios?.[0];
  if (!b64) throw new SpeechProviderError('sarvam', 502, 'empty audios[]');
  const mime = codec === 'mp3' ? 'audio/mpeg' : codec === 'aac' ? 'audio/aac' : codec === 'flac' ? 'audio/flac' : 'audio/wav';
  return { audio: Buffer.from(b64, 'base64'), mimeType: mime, sampleRateHz, provider: 'sarvam' };
}
```

Fallback policy: try providers in `SPEECH_*_CHAIN` order; on timeout, 429 (after one short back-off), 5xx or 422 move to the next provider; 403/401 means a configuration problem - alert and also fall through so users are still served; always log provider, latency and request id; never log raw audio or full transcripts without consent. Split long answers into sentences (about 300-500 characters each, hard limit 2,500) so playback can start sooner and the Starter TTS rate limit is respected.

### 5.5 Audio capture and conversion

Browser (Angular):
- Capture: `navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`; pick a supported type with `MediaRecorder.isTypeSupported` in this order: `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus` (Safari typically records MP4/AAC, Chromium/Firefox WebM or Ogg Opus - general knowledge, not verified here). Use `audioBitsPerSecond` about 24000 for speech. Stop automatically at 25 s.
- Upload as multipart with a filename extension matching the container (`audio.webm`, `audio.m4a`, `audio.ogg`). MediaRecorder WebM blobs often have no duration header, so measure duration on the client and re-check on the server after decoding (16 kHz mono 16-bit = 32,000 bytes/s).
- Playback: server returns `audio/mpeg` (mp3) and the SPA plays it with an `<audio>` element created from a Blob URL after a user gesture (autoplay policies).

ffmpeg conversions (standard ffmpeg usage, not vendor-sourced; test locally):
```
# browser webm/opus (or any) -> 16 kHz mono PCM WAV  (Sarvam fallback, Azure STT, IndicConformer)
ffmpeg -y -i in.webm -vn -ac 1 -ar 16000 -c:a pcm_s16le out16k.wav
# -> OGG Opus 16 kHz mono  (Azure STT REST alternative to WAV)
ffmpeg -y -i in.webm -vn -ac 1 -ar 16000 -c:a libopus out16k.ogg
# raw headerless 8 kHz mu-law telephone audio -> 16 kHz WAV
ffmpeg -y -f mulaw -ar 8000 -ac 1 -i call.ulaw -ar 16000 -c:a pcm_s16le call16k.wav
# 8 kHz telephone WAV -> 16 kHz WAV (upsampling adds no information but satisfies "16 kHz" providers)
ffmpeg -y -i call8k.wav -ar 16000 -ac 1 -c:a pcm_s16le call16k.wav
# TTS WAV/MP3 -> 8 kHz WAV for telephony playback
ffmpeg -y -i tts.mp3 -ar 8000 -ac 1 -c:a pcm_s16le tts8k.wav
# TTS -> raw G.711 mu-law 8 kHz
ffmpeg -y -i tts.wav -ar 8000 -ac 1 -f mulaw tts.ulaw
```
When piping WAV to stdout, ffmpeg cannot patch the WAV header sizes afterwards; if a provider rejects piped WAV, write to a temp file instead. Run ffmpeg via `child_process.spawn` with `-i pipe:0 ... pipe:1` or temp files; keep a copy of the original audio only if consent allows.

Chunking rule for the 30 s limit: prefer short prompts and the 25 s cap; if a longer upload arrives, split at silence (ffmpeg `silencedetect`) into segments under 28 s and join the transcripts; do not cut mid-word.

### 5.6 Fallback providers - minimal contracts

Azure STT (verified, [RAW]):
```
POST https://<resource>.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1?language=ta-IN&format=detailed
Headers: Ocp-Apim-Subscription-Key: <key>   (or Authorization: Bearer <token>)
         Content-Type: audio/wav; codecs=audio/pcm; samplerate=16000      (or audio/ogg; codecs=opus)
         Accept: application/json
Body: raw audio bytes (<= 60 s). Chunked transfer optional (Transfer-Encoding: chunked + Expect: 100-continue) to cut latency.
Response: { "RecognitionStatus":"Success", "Offset":..., "Duration":..., "NBest":[{ "Confidence":0.9, "Lexical":"...", "ITN":"...", "MaskedITN":"...", "Display":"..." }] }
```
Azure TTS (verified, [RAW]):
```
POST https://centralindia.tts.speech.microsoft.com/cognitiveservices/v1
Headers: Ocp-Apim-Subscription-Key: <key>  (or Authorization: Bearer <token>)
         Content-Type: application/ssml+xml
         X-Microsoft-OutputFormat: audio-16khz-32kbitrate-mono-mp3        (web)  |  riff-8khz-16bit-mono-pcm / raw-8khz-8bit-mono-mulaw  (phone)
         User-Agent: agrosaarthi
Body: <speak version='1.0' xml:lang='ta-IN'><voice xml:lang='ta-IN' name='ta-IN-PallaviNeural'>TEXT</voice></speak>
Response: audio bytes in the requested format (max 10 min); errors 400/401/415/429/502/503
```
Gemini (STT fallback / TTS fallback): use the official Google GenAI SDK already used for chat. STT: send the audio part with the correct MIME type (`audio/webm`, `audio/mulaw`...) plus an instruction such as "Transcribe this Tamil speech verbatim in Tamil script. Output only the transcript." with temperature 0. TTS: model `gemini-3.8-flash-lite-tts` or `gemini-3.8-flash-tts`, voice name e.g. `Kore`, Tamil text; response audio is 24 kHz mono 16-bit (WAV unary / L16 streaming) - resample for telephony. Raw REST shape of the new `/v1beta/interactions` endpoint [U]: confirm in the SDK/docs before coding.
Google Cloud (only if a service account exists): TTS `POST https://texttospeech.googleapis.com/v1/text:synthesize` with `{"input":{"text":"..."},"voice":{"languageCode":"ta-IN","name":"ta-IN-Chirp3-HD-<Name>"},"audioConfig":{"audioEncoding":"MP3"}}` and `Authorization: Bearer <token>` (response `audioContent` base64). STT v2 Chirp 3 uses a recognizer resource with `config` {auto decoding, `languageCodes:["ta-IN"]`, `model:"chirp_3"`} and `content` (field names derived from the verified Python snake_case names; the REST path form is [U]). V1 `speech:recognize` is verified above.

### 5.7 Telephone pipeline details

1. Provider webhook gives a recording URL or a media stream. Record only the caller turn (silence timeout 2-3 s, max 25 s).
2. Download, identify format (WAV/MP3/raw mu-law), normalise: try the original 8 kHz PCM WAV with Sarvam first (Saaras is documented as optimised for 8 kHz telephony; REST 8 kHz handling is not stated), and on 4xx/poor output upsample to 16 kHz WAV.
3. STT -> Gemini chat -> answer text (keep answers short for the phone, e.g. under 400 characters per turn).
4. TTS: `bulbul:v3`, `output_audio_codec=wav` (or linear16), `speech_sample_rate=8000`; if the provider needs mu-law/a-law, transcode with ffmpeg (do not depend on Sarvam `mulaw`/`alaw` until smoke-tested).
5. Play to the caller; ask a yes/no read-back for critical items (crop, product, dose); DTMF fallback (1/2/3) always available.
6. Streaming/barge-in later: Sarvam WebSocket STT accepts only WAV/raw PCM (`wav`, `pcm_s16le`, `pcm_l16`, `pcm_raw`) at 16000 Hz (default) or 8000 Hz; endpoint URL not captured [U].

### 5.8 Smoke tests and bake-off (do before launch)

- Smoke: (a) 5 s Tamil WebM/Opus clip from Chrome -> Sarvam STT returns `transcript`; (b) the same clip as 8 kHz WAV; (c) TTS `bulbul:v3` with `mp3` and with `wav` at 8000 Hz; (d) TTS with `mulaw` to learn whether it works; (e) 31 s clip to confirm the 30 s error code/body; (f) numerals and units ("2 ml per litre") in TTS; (g) key-term biasing with `keyterms`.
- Bake-off: 100+ real Tamil Nadu farmer utterances (mixed dialects, noise, 8 kHz and 16 kHz), measure CER/WER on Tamil script, accuracy on crop/disease/pesticide names and numbers, latency p50/p95 from the deployment region, and cost per minute. Compare Sarvam `saaras:v4` vs `saaras:v3`, Gemini audio, Azure `ta-IN`, and (if credentials exist) Google Chirp 3. For TTS: blind listening tests with farmers on a real 8 kHz phone line for `ratan`/`rohan`/`ishita`/`ritu`/`shubh`, Azure Pallavi, Gemini voices.

## 6. Risks, limitations, open questions

Risks and limitations
- Evidence quality: most numbers came through a page summariser; field names for the Sarvam TTS request were confirmed from vendor code samples, others are "as extracted". Re-check against the live docs when coding.
- Sarvam: single vendor; REST STT 30 s cap; no transcript confidence; `mode` documented as saaras:v3-only while the model page says v4 has modes; `mulaw`/`alaw` TTS unconfirmed and `opus` errors; native 8 kHz REST handling unconfirmed; Starter rate limits (STT 60/min; TTS v3 30/min) may bottleneck a pilot with parallel callers; free credit is a one-time Rs 100; model-name churn (v2.5 deprecated soon).
- Data protection: voice recordings are personal data; Sarvam/Google/Azure retention, training-use, residency and commercial-use terms were NOT checked (Sarvam commercial licensing page exists but was not read). Consent notice and recording-retention rules (e.g. India's DPDP Act) need a legal check - not verified here.
- Google: documented auth excludes API keys; Chirp 3 GA regions listed are `us`/`eu` (latency and residency from India [U]); pricing/free tier pages unreadable; Tamil Standard/WaveNet/Neural2 voice inventory unverified.
- Azure: needs an Azure subscription; REST short audio takes only WAV/OGG-Opus at 16 kHz and 60 s; paid prices unverified; docs inconsistent on key vs bearer for TTS.
- AWS: no Polly Tamil; excluded.
- Bhashini: "PoC only" terms, no SLA; registration and header details not confirmed from an official page.
- Gemini: STT is LLM-based (paraphrase/hallucination risk, no confidence); TTS has no free tier and its price doubles on 2027-01-01 per the pricing page; the `interactions` REST shape is new and unverified.
- Self-host: GPU/ops cost; latency and hardware needs unverified; Indic Parler-TTS sample rate unverified.
- Browser: Web Speech support is Chromium/Safari only and cloud-based; `ta-IN` acceptance and Tamil `speechSynthesis` voices unverified; cannot serve the phone channel.
- Quality: Tamil dialects, code-mixing with English agricultural terms, rural noise and 8 kHz audio can all hurt accuracy; wrong pesticide names or dosages are a safety issue - always confirm critical entities back to the user.
- Process: 52 web calls were used (guideline ~30).

Open questions
1. Which telephony provider (and which Indian numbers/DLT constraints) will be used, and does it expose Tamil ASR/TTS and bidirectional media streaming?
2. Expected monthly volume and budget in Rs; is the Starter plan enough or is Pro/Business needed?
3. Data-residency and retention requirements for farmer voice data; Sarvam commercial-licence terms for generated audio.
4. Which Tamil TTS persona do farmers prefer (v3 named speaker vs v4-flash persona), and does native Tamil text normalise numbers/units acceptably?
5. Does Sarvam REST accept native 8 kHz WAV and does TTS `mulaw`/`alaw` work on v3/v4-flash (smoke tests).
6. Is Chirp 3 materially more accurate for Tamil Nadu dialects than `saaras:v4` (bake-off), and is it served from an India region?
7. Do target browsers accept `ta-IN` in `SpeechRecognition` and expose any Tamil `speechSynthesis` voice (device test matrix)?
8. Exact paid prices for Azure Speech and Google STT/TTS free tiers (read the pricing pages directly).

## 7. Sources

Sarvam AI
- https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe - STT REST endpoint, auth header, fields, defaults, formats, response fields, errors.
- https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert - TTS REST endpoint, `language_code`, speakers default, codecs (opus error), sample rates, response `audios`, vendor code samples.
- https://www.sarvam.ai/api-pricing - STT per-minute and TTS per-1,000-character prices, free credits statement.
- https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview - 30 s REST limit, batch 2 h/20 files, streaming 8000/16000 Hz WAV/PCM, current models.
- https://docs.sarvam.ai/api/getting-started/ratelimits - Rs 100 free credits (never expire), rate limit tables per plan.
- https://docs.sarvam.ai/api/speech-to-text/faq - format lists for REST vs streaming, 30 s limit, 16 kHz recommendation, generic accuracy claims.
- https://docs.sarvam.ai/api-reference-docs/getting-started/models/bulbul - Bulbul v2/v3/v4-flash differences, speaker list, languages, codecs, limitations.
- https://docs.sarvam.ai/api-reference-docs/getting-started/models/saaras - Saaras v3/v4 modes, Tamil, 8 kHz telephony optimisation, keyterms, deprecations.
- https://docs.sarvam.ai/api/getting-started/pricing , https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices , https://docs.sarvam.ai/api/getting-started/commercial-licensing , https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api - appeared only in search listings (plan prices, Tamil voice recommendation); not fetched.

Google Cloud
- https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages - Tamil in chirp_3/chirp_2/chirp/long/short.
- https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3 - Chirp 3 Tamil GA, regions, methods, confidence caveat, auto language.
- https://docs.cloud.google.com/speech-to-text/quotas - V1 sync/streaming limits and quotas.
- https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v1/RecognitionConfig - encodings, sample-rate rules, confidence fields.
- https://docs.cloud.google.com/speech-to-text/docs/authentication - ADC/service account/OAuth documented, no API keys.
- https://cloud.google.com/speech-to-text/pricing - STT price (search summary only; fetch truncated).
- https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize - TTS REST shape and encodings.
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd - Chirp 3 HD Tamil support, formats, endpoints.
- https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types - voice list (truncated before Tamil).
- https://cloud.google.com/text-to-speech/pricing - TTS price/free tier (search summary only).
- https://edesy.in/docs/voice-agent/tts/google - third-party mention of `ta-IN-Neural2-A` (secondary).

Microsoft Azure
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support - ta-IN STT support; ta-IN-PallaviNeural / ta-IN-ValluvarNeural.
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short - REST short audio endpoint, formats, 60 s, response fields.
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech - TTS endpoint, headers, output formats, limits, status codes.
- https://azure.microsoft.com/en-us/pricing/details/speech/ - F0 free tier (5 h STT, 0.5M chars TTS); paid prices not visible.

AWS
- https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html - Transcribe ta-IN batch/streaming and region caveat.
- https://docs.aws.amazon.com/polly/latest/dg/supported-languages.html - Polly has no Tamil.

Bhashini
- https://bhashini.gitbook.io/bhashini-apis - PoC-only usage statement, call flow.
- https://bhashini.gitbook.io/bhashini-apis/pipeline-config-call/request-payload - config request body sample.
- https://bhashini.gitbook.io/bhashini-apis/pipeline-config-call/response-payload , https://bhashini.gitbook.io/bhashini-apis/pipeline-compute-call/request-payload , https://bhashini.gitbook.io/bhashini-apis/pipeline-compute-call , https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage , https://dibd-bhashini.gitbook.io/bhashini-apis/websocket-asr-api - official pages listed by search (not fetched).

Gemini
- https://ai.google.dev/gemini-api/docs/speech-generation - TTS models, Tamil, voices, audio format.
- https://ai.google.dev/gemini-api/docs/audio - audio input MIME types, limits, tokens per second.
- https://ai.google.dev/gemini-api/docs/pricing - TTS prices and free-tier status, audio input price.

AI4Bharat
- https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual - MIT licence, Tamil, CTC/RNNT, ONNX, 16 kHz.
- https://huggingface.co/ai4bharat/indic-parler-tts - Apache-2.0 licence, Tamil speakers, 0.9B parameters.

Browser and telephony
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition - server-based recognition quote, limited availability, processLocally/available/install.
- https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json - per-browser support versions and prefixes.
- https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-a-supported-languages-and-voices - Windows Narrator Tamil voice (search summary only).
- https://www.twilio.com/docs/voice/twiml/gather and https://www.twilio.com/docs/voice/conversationrelay/voice-configuration - Twilio Tamil speech notes (search summaries only).
- https://www.infobip.com/docs/voice-and-video/interactive-voice-response-ivr/supported-speech-languages - Infobip IVR lists Tamil (India) ta-IN for speech recognition.
