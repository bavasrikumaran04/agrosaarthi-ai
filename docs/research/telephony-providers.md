# Programmable telephony for inbound calls from Indian farmers (Tamil) - research report

Status: COMPLETE (started 2026-10-22; completed 2026-10-22)

Project: AgroSaarthi AI (Tamil Nadu first; farmers on button phones call a number and get Tamil guidance; Angular 21 SPA, Node 20+/Express 5/TypeScript backend, MongoDB, Python FastAPI+onnxruntime model service, Gemini as first conversational AI provider).
Research date: 2026-10-22. Every fact was checked against live pages on that date unless tagged otherwise.

Evidence tags used in this report:
- [P] verified in a primary source fetched on 2026-10-22 (vendor docs, SDK source, government PDF).
- [S] seen only in a search-result summary or a third-party page (secondary). Treat as a lead, not a fact.
- [L] reproduced or extracted locally by me from a primary source (signature test vectors recomputed with Python/Node; TRAI PDF text extracted with pdftotext).
- UNVERIFIED - not confirmed. Do not build on it without checking in a sandbox or with the vendor.

## Bottom line

1. Implement FIRST: a **Twilio** adapter (TwiML markup + `X-Twilio-Signature`). It is the only candidate where every piece an engineer needs (signature algorithm with a reproducible test vector, request parameters, Gather/Play/Record/Redirect/Dial/Hangup verbs, timeout/retry rules, Media Streams audio format, Tamil TTS voices) is documented and was verified. It can be built and tested without an Indian number.
2. Most practical for a REAL Indian deployment: **Exotel** (India-native; Landline DID, mobile virtual and 1800 toll-free ExoPhones; documented KYC for Indian companies, partnerships, trusts and sole proprietors; documented Voicebot/Stream applet = WebSocket with raw 16-bit 8 kHz PCM). Caveats: no markup webhook (flow/applet model), no documented webhook signature, no native Tamil ASR/TTS (we bring our own), pricing not public, KYC needs a registered business form.
3. Do NOT depend on any telephony vendor's native Tamil speech recognition. Twilio lists `ta-IN` only in a deprecated Gather-1.0 table; Plivo's documented GetInput language list has no Tamil; Vonage does list `ta-IN` but has no verified Indian-number path. Capture/stream audio and run Tamil STT in our own pipeline.
4. Regulatory (not legal advice): a callback that only delivers the advice the farmer asked for is arguably not a TRAI "commercial communication", but promotional content, an AI-voice (Robo Call) callback, and DPDP-2025 notice/consent duties all need design attention (section 3.7).

---

## 1. Scope & method

Scope: programmable telephony for INBOUND calls from Indian button-phone users in Tamil. Providers: Twilio, Exotel, Plivo, Vonage, Ozonetel, Knowlarity. Questions per provider: (a) Indian inbound number + KYC/DoT/TRAI + who can get one; (b) webhook model; (c) webhook authenticity (algorithm, header, signed content, replay); (d) audio (Tamil STT/TTS, external audio URL, recording, media streams, DTMF, transfer, redirect/hold, timeouts, retries, status callbacks); (e) India pricing; (f) testing without an Indian number. Plus Indian regulatory summary and two recommendations.

Method:
- About 41 web tool calls (WebFetch/WebSearch), slightly above the ~30 budget. Two failed: `pib.gov.in` press release PRID=1729725 and the `dot.gov.in` OSP guideline PDF both returned HTTP 403, so OSP statements rest on search summaries [S].
- WebFetch returns a model-written summary of the page, not raw HTML. To limit summarisation risk I (1) re-computed the Twilio documented test vector, (2) read the official Plivo SDK source verbatim and re-implemented it, (3) downloaded the official TRAI consolidated TCCCPR PDF and extracted its text locally. All three matched.
- Search-engine summaries are tagged [S]. Third-party blogs are never used for decision-driving facts.
- Not covered (no verification possible in budget): pricing for Plivo/Vonage/Ozonetel/Knowlarity, Indian number availability on Vonage/Ozonetel/Knowlarity, Twilio ConversationRelay, Telecommunications Act 2023 implementation rules.

---

## 2. Options compared

### 2.1 Numbers, KYC, price, testing

| Provider | Indian inbound numbers | Who can get one (KYC) | Price points found | Trial / testing |
|---|---|---|---|---|
| Twilio | Only **+91 800 toll-free** is listed in Twilio's India regulatory guideline [P]. Local/mobile/national Indian numbers are not listed (a search summary says new Indian domestic numbers are not sold [S]). Inbound capability of the +91 800 number: UNVERIFIED on the fetched page. | Individuals AND businesses whose address is **outside India**; "no documentation required" [P]. An India-address entity is excluded by that rule. | Outbound to India: mobile $0.0496/min, local $0.0699/min [P]. "International numbers starting at $1.15/mo" (generic, not India-specific) [P]. India toll-free inbound per-minute and monthly rental: UNVERIFIED (not shown in fetched page text). | Trial: only verified recipients; voice limited to sign-up country; trial expires 30 days after sign-up (page summary) [P, partial]. |
| Exotel | Landline DID (080-/city STD code), mobile virtual (9XX), **toll-free 1800**, vanity numbers; all four inbound-capable [P]. 140/160 series not mentioned. | KYC categories: Registered Company, Partnership, NGO/Trust/Society, **Sole Proprietorship** (GST or MSME or incorporation certificate + proprietor PAN + address proof + photo) [P]. A pure individual with no business registration is not listed (UNVERIFIED; one search summary mentions individual ID docs [S]). Non-Indian entities: only a UAE (Dubai) route is listed [P]. | Not published. 18% GST on invoices; one-time activation + monthly rental for dedicated virtual and toll-free numbers; toll-free = receiving business pays all inbound minutes at a higher per-minute rate than DIDs [P]. "From INR 0.50/min" and 60 s pulse appear only in search summaries and conflict with the per-second wording of the pricing FAQ [S]. | Free trial: limited credits (few outbound minutes, limited SMS), credits expire after 15 days, SHARED trial phone number [P]. |
| Plivo | Indian numbers exist, but only for Indian-registered businesses; inbound must stay India-to-India [S]. | Certificate of Incorporation + GST certificate only; individuals and foreign companies excluded; foreign firms must use international routes with non-Indian caller ID [S]. | UNVERIFIED | UNVERIFIED |
| Vonage | UNVERIFIED (no Indian-number offer surfaced). | UNVERIFIED | Speech input is chargeable: google provider = "Standard ASR" pricing, deepgram = "Premier ASR" pricing (rates not captured) [P]. | UNVERIFIED |
| Ozonetel | UNVERIFIED (enterprise contact-centre vendor; KooKoo = its programmable IVR). | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Knowlarity | Virtual numbers and toll-free listed on marketing pages [S]. | UNVERIFIED | UNVERIFIED | UNVERIFIED |

### 2.2 Programmability

| Provider | Call-start model | Response expected | Webhook authenticity | Native Tamil STT | Native Tamil TTS | Realtime media | Timeouts / retries |
|---|---|---|---|---|---|---|---|
| Twilio | HTTP request to the number's Voice URL with form params [P] | TwiML XML (Content-Type text/xml, application/xml or text/html) [P] | `X-Twilio-Signature` = base64 HMAC-SHA1(AuthToken, URL + sorted POST params as name+value); documented test vector; no replay protection documented [P][L] | `ta-IN` appears ONLY in the deprecated Gather-1.0 / Google-STT-v1 table (no enhanced, no experimental model); Gather 2.0 models (googlev2_*, deepgram_nova-2/3): Tamil support UNVERIFIED [P] | Yes: Google ta-IN Standard-C/D, Wavenet-C/D, 8 x Chirp3-HD [P] | `<Connect><Stream>` bidirectional WebSocket; audio/x-mulaw, 8000 Hz, mono, base64 [P] | Hard 15 s cap on call-related HTTP; defaults connect 5 s, read 15 s, retry count 1; fallback URL [P] |
| Exotel | ExoPhone starts a call flow of applets; Passthru applet calls your URL; Voicebot/Stream applet opens a WebSocket to you [P] | Passthru: HTTP 200 -> branch "Choice A", 302 -> "Choice B"; no markup [P] | No signature documented. WSS: IP whitelisting or Basic Auth (API key:token) [P] | None documented (bring your own) [P] | None documented (bring your own) | WSS; raw/slin 16-bit LE mono PCM, 8 kHz default (16 k, 24 k optional), base64 [P] | Webhook timeout/retry UNVERIFIED; stream chunks 3.2 KB-100 KB, multiple of 320 B [P] |
| Plivo | Plivo requests the Answer URL of the application attached to the number (Answer-URL mechanics UNVERIFIED; XML elements confirmed in the docs) | Plivo XML (`<GetInput>`, `<Speak>`, `<Play>` ...) [P] | `X-Plivo-Signature-V3` (+ `-Ma-V3`, `-V3-Nonce`): base64 HMAC-SHA256 over URL+params+"."+nonce; nonce aids replay defence [P][L] | Language list in GetInput docs: en-US, en-GB, en-AU, es-US, es-ES, fr-FR, de-DE, it-IT, pt-BR, ja-JP, zh-CN - Tamil not documented [P] | UNVERIFIED | UNVERIFIED | GetInput `executionTimeout` default 15 s [P]; webhook timeouts UNVERIFIED |
| Vonage | Answer webhook returns NCCO JSON [S] | NCCO JSON | JWT in `Authorization: Bearer`, HS256 with signature secret, `payload_hash` = SHA-256 of raw body [S] | Yes, `ta-IN` listed; providers `deepgram` or `google` [P] | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Ozonetel (KooKoo) | HTTP callbacks with `sid`, `cid`, `called_number`, `event` [S] | XML (`playtext`, `playaudio`, `collectdtmf`, `record`, `dial`, `hangup`, `gotourl`) [S] | None found | None found (DTMF `collectdtmf`) | `playtext` uses a TTS engine; Tamil UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Knowlarity | SuperReceptionist with SIP/API destination and webhooks (forum/marketing level) [S] | UNVERIFIED | UNVERIFIED | Marketing page claims Tamil among multilingual voice-AI languages [S] | UNVERIFIED | UNVERIFIED | UNVERIFIED |

---

## 3. Findings per option with citations

### 3.1 Twilio

**(a) Indian inbound number**
- Only India number type in Twilio's regulatory guideline is Toll-Free (+91 800). Address requirement for both individuals and businesses: "must be outside of the country"; documentation: none. [P] https://www.twilio.com/en-us/guidelines/in/regulatory
- A foreign individual or company can therefore hold a +91 800 number without KYC; an Indian-address entity cannot use this route. Local/mobile/national numbers are not listed. A search summary claims new Indian domestic numbers cannot be bought through standard Twilio [S].
- India voice guideline [P] https://www.twilio.com/en-us/guidelines/in/voice : "Outbound calls to India can only be made from international (non-Indian) numbers"; "Voice OTP/2FA is not permitted and may be blocked"; "High volumes of short-duration calls may trigger automated carrier blocks"; customers must gain recipient consent for commercial communications; DoT and TRAI "manage a consumer portal" and local authorities "actively monitor for, and enforce, account blockings of non-compliant use-cases"; outbound calls preserve the sent caller ID.
- UNVERIFIED: whether the +91 800 number is inbound-capable on the account, and the legal posture of a foreign-provisioned +91 800 number serving a domestic Tamil Nadu helpline.

**(b) Webhook model** [P] https://www.twilio.com/docs/voice/twiml
- Twilio requests your Voice URL when a call arrives and interprets the response as TwiML when Content-Type is `text/xml`, `application/xml` or `text/html`.
- Parameters always sent: `CallSid`, `AccountSid` (34 chars, starts `AC`), `From`, `To` (E.164 or client id), `CallStatus` (`queued|initiated|ringing|in-progress|completed|busy|failed|no-answer|canceled`), `ApiVersion`, `Direction` (`inbound` | `outbound-api` | `outbound-dial`), `ForwardedFrom` (only when forwarded), `CallerName` (only if VoiceCallerIdLookup is on), `ParentCallSid`, `CallToken`. Geographic when available: `FromCity`, `FromState`, `FromZip`, `FromCountry`, `ToCity`, `ToState`, `ToZip`, `ToCountry`.
- Status callbacks: reply 204, or 200 with `Content-Type: text/xml` and an empty `<Response/>`.
- Voice verbs: `Say`, `Play`, `Dial`, `Record`, `Gather`; flow control `Hangup`, `Enqueue`, `Leave`, `Pause`, `Redirect`, `Refer`, `Reject`; advanced `VirtualAgent`.

**(c) Webhook authenticity** [P][L] https://www.twilio.com/docs/usage/webhooks/webhooks-security , https://www.twilio.com/docs/usage/security
- Header `X-Twilio-Signature`. HMAC-SHA1, key = account Auth Token, output base64.
- Signed string: the full URL as configured in Twilio (protocol through end of query string) + every POST parameter sorted alphabetically (Unix-style, case-sensitive) appended as name immediately followed by value, no delimiters.
- JSON bodies: Twilio adds a `bodySHA256` query parameter (SHA-256 of the raw body); verify that hash against the raw body, and the URL including that parameter is signed. (Voice TwiML webhooks are form-encoded, so this is not needed for them.)
- Port/credentials: the page says Twilio keeps a port in the URL for SMS and voice callbacks but for HTTPS voice callbacks also drops the port; username/password are dropped for HTTPS. For WebSocket handshakes, try appending a trailing `/`. Practical rule: compute with several URL variants (as-configured, without port, with explicit default port).
- Replay protection: none documented on those pages (no timestamp, no nonce). A header named `I-Twilio-Idempotency-Token` was not found in the fetched pages (UNVERIFIED).
- Documented test vector [P][L]: URL `https://example.com/myapp.php?foo=1&bar=2`, AuthToken `12345`, params `CallSid=CA1234567890ABCDE`, `Caller=+14158675310`, `Digits=1234`, `From=+14158675310`, `To=+18005551212` -> concatenated string `https://example.com/myapp.php?foo=1&bar=2CallSidCA1234567890ABCDECaller+14158675310Digits1234From+14158675310To+18005551212` -> signature `L/OH5YylLD5NRKLltdqwSvS0BnU=`. I recomputed this locally (Python and Node) and it matches.
- The SDK code sample on the same docs shows `https://example.com/myapp` with `Np1nax6uFoY6qpfT5l9jWwJeit0=`; that does NOT reproduce with token `12345` (gives `gVxvIWCj069FxBHABMLOEDo6rzs=`), so it was made with another token. Do not use it as a vector.

**(d) Audio and call control**
- Gather [P] https://www.twilio.com/docs/voice/twiml/gather : attributes and defaults `input=dtmf`, `action=current document URL`, `method=POST`, `timeout=5`, `speechTimeout=timeout value` (or `auto`: "stops recognizing speech at the first pause"), `finishOnKey=#`, `numDigits=unlimited`, `language=en-US`, `speechModel=default`, `enhanced=false`, `profanityFilter=true`, `hints=none`, `actionOnEmptyResult=false`, `partialResultCallback` (+ `partialResultCallbackMethod=POST`). Action parameters: `Digits`, `SpeechResult`, `Confidence` (0.0-1.0). Nested verbs allowed: `Pause`, `Play`, `Say`. No `bargeIn` attribute is documented for Gather.
- speechModel values [P]: `default`, `numbers_and_commands`, `phone_call`, `experimental_conversations`, `experimental_utterances`; Google STT V2: `googlev2_long`, `googlev2_short`, `googlev2_telephony`, `googlev2_telephony_short`, `googlev2_chirp_3`; Deepgram: `deepgram_nova-2`, `deepgram_nova-3`. "Supported languages depend on your chosen speechModel".
- Tamil STT [P]: the language table row "Tamil (India) | ta-IN | enhanced: No | experimental: No" exists ONLY in the deprecated Language Appendix, which "applied only to Google v1 STT APIs used with Gather 1.0, which is being phased out as customers are migrated to Gather 2.0". Whether any Gather 2.0 model transcribes ta-IN is UNVERIFIED. Treat native Tamil ASR as unavailable until proven by a sandbox call.
- Say / Tamil TTS [P] https://www.twilio.com/docs/voice/twiml/say/text-speech : voice names are `{Provider}.{Voice}`; families Basic, Standard (Polly + Google Standard), Neural (Polly Neural, Google WaveNet/Neural2), Generative (Polly Generative, Google Chirp3-HD, ElevenLabs). Tamil voices: `Google.ta-IN-Standard-C` (F), `Google.ta-IN-Standard-D` (M), `Google.ta-IN-Wavenet-C` (F), `Google.ta-IN-Wavenet-D` (M), and Chirp3-HD `Google.ta-IN-Chirp3-HD-Aoede`, `-Charon`, `-Fenrir`, `-Kore`, `-Leda`, `-Orus`, `-Puck`, `-Zephyr`. No Polly Tamil voice is listed. Character limit for `<Say>`: not stated (UNVERIFIED).
- Play external HTTPS audio, Record, Dial, Redirect, Hangup, Pause: verbs confirmed to exist [P]. Their attribute tables and the accepted audio formats were NOT re-fetched (section 5 marks every such attribute UNVERIFIED).
- Media Streams [P] https://www.twilio.com/docs/voice/media-streams/websocket-messages : `audio/x-mulaw`, 8000 Hz, 1 channel, base64 payload without file-header bytes; messages listed in section 5.2.7.
- Timeouts/retries [P] https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides : defaults connect timeout 5000 ms, read timeout 15000 ms, retry count 1; override with URL fragment `#ct=1000&rt=5000&rc=2` (ct 100-10000, rt 100-15000, tt 100-15000, rc 0-5, rp, sni, e); "Twilio imposes a hard upper timeout of 15 seconds on all call-related HTTP requests"; retried voice webhooks are not logged as separate requests; a shorter timeout speeds up failover to a fallback URL (fallback semantics themselves not described on that page).

**(e) Pricing** [P partial] https://www.twilio.com/en-us/voice/pricing/in : outbound to India local $0.0699/min, mobile $0.0496/min; "international numbers starting at $1.15/mo". India toll-free inbound rate and rental: UNVERIFIED (not in fetched text). Google-voice `<Say>` and speech recognition may be billed separately: UNVERIFIED.

**(f) Testing without an Indian number** [P partial] https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account : "You can call or message only verified recipients from a trial account"; each non-Twilio number must be verified; "SMS and voice are limited to your sign-up country"; trial ends 30 days after sign-up; a "75 voice minutes" figure appears in the page summary (UNVERIFIED). The trial "press any key" message and whether a trial can buy a +91 800 number: UNVERIFIED.

### 3.2 Exotel (India-native)

**(a) Numbers/KYC**
- Types [P] https://developer.exotel.com/docs/faqs/number-types : Landline DID `080-XXXXXXX` (city STD code), Mobile virtual `9XX-XXXXXXX`, Toll-free `1800-XXX-XXXX`, vanity numbers; all four support inbound; toll-free: "The receiving business pays for all inbound call minutes" and has higher per-minute inbound charges than DID numbers; each number has a monthly rental; porting takes 7-15 business days; provisioning time for new numbers not stated.
- KYC [P] https://docs.exotel.com/business-phone-system/kyc-verification (this page sits in Exotel's "Business Phone System" docs; that the same KYC applies to the programmable-voice product is UNVERIFIED but likely since both use ExoPhones) : categories Registered Companies (Certificate of Incorporation, PAN, address proof, photo), Partnerships (incorporation certificate or partnership deed, PAN, address proof, photo), NGO/Trust/Societies (trust deed or registration certificate, PAN, address proof, photo), Sole Proprietorship (GST or MSME or incorporation certificate, proprietor PAN, address proof - Aadhaar/Voter ID/Passport/Driving licence - photo). Also IP-PSTN intermix (Bangalore, AP, Mumbai), UAE (Dubai) and CCPL (Delhi) variants. "Due to regulatory requirements, you can only use IP-PSTN-based Exophones from the region where you have done your KYC." Turnaround time: not stated. TRAI/DoT not named on the page.
- Individual developer: no "individual without business registration" category on the KYC page (UNVERIFIED either way); a sole proprietorship with an MSME/Udyam or GST registration is the likely minimum. Foreign company: only the UAE route is listed.

**(b) Webhook model**
- "When an incoming call lands on your ExoPhone, a call flow is automatically initiated. You configure what happens during that call flow using Applets" [P] https://developer.exotel.com/docs/voice-v1/api-reference/incoming-call . It is a flow-builder model, not per-call markup.
- Passthru applet [P] https://developer.exotel.com/docs/voice-v1/applets/passthru : sends an HTTP request with incoming-call details to your Application URL; `200 OK` routes to Choice A, `302 Found` routes to Choice B. The fetched page does not give HTTP method, parameter names, timeout, retry or any authentication (UNVERIFIED). A search summary says a Passthru placed before the stream applet can POST call metadata before the WebSocket opens [S] https://developer.exotel.com/docs/agentstream/getting-started .
- Docs navigation also lists "Program Incoming Call", "StatusCallback" https://developer.exotel.com/docs/voice-v1/api-reference/status-callback and "Authentication" https://developer.exotel.com/docs/voice-api/getting-started/authentication (not read).

**(c) Webhook authenticity**: no signature documented. For the stream: "IP Whitelisting (contact hello@exotel.com) or Basic Auth: `wss://<API_KEY>:<API_TOKEN>@stream.yourdomain.com/<path>` - transmitted as `Authorization: Basic base64(API_KEY:API_TOKEN)`" [P] https://developer.exotel.com/docs/agentstream/stream-voicebot-applet . Replay protection: none documented.

**(d) Audio**
- Stream/Voicebot applet [P] same URL: WebSocket URL (e.g. `ws://127.0.0.1:5001/media`) OR an HTTPS endpoint that dynamically returns the WSS URL; query params `?sample-rate=16000` and custom `?param1=value1&param2=value2` (max 256 chars total); audio "raw/slin (16-bit, 8kHz, mono PCM little-endian)" in base64; sample rates 8000 (default), 16000, 24000; chunks you send must be at least 3.2 KB (the doc labels this "100ms of data"), at most 100 KB, and a multiple of 320 bytes (note: 3.2 KB of 16-bit mono PCM is 100 ms only at 16 kHz and 200 ms at 8 kHz, so the label looks written for 16 kHz - verify in the sandbox); bidirectional: audio you send back is played to the caller in real time; the stream auto-closes before the next applet runs ("no explicit Stop applet needed"). Events: `connected`, `start` (`stream_sid`, `call_sid`, `account_sid`, phone numbers, `custom_parameters`, `media_format`), `media` (`chunk`, `timestamp`, `payload`), `dtmf` (`duration`, `digit`), `mark` (`name`), `clear` (`{"event":"clear","stream_sid":"<stream_sid>"}`), `stop` (`call_sid`, `account_sid`, `reason` = `stopped` (applet ended) or `callended` (caller hung up)).
- No native ASR/TTS is mentioned in the applet doc; Tamil STT/TTS must be ours. DTMF arrives as `dtmf` events on the stream. Gather applet, Greeting-applet TTS languages, recording options, transfer applet names, webhook timeouts/retries: UNVERIFIED.

**(e) Pricing**: no INR rates in docs [P] https://developer.exotel.com/docs/faqs/pricing-plans (pay-as-you-go and bundled plans; "18% GST is added to all invoices"; activation fee + rental for dedicated virtual and toll-free numbers; contact sales / pricing calculator). Search summaries mention "from INR 0.50/min" and a 60 s pulse [S] (conflicts with the pricing FAQ's per-second wording). Treat all INR numbers as UNVERIFIED until quoted in writing.

**(f) Testing**: free trial with limited credits, 15-day expiry and a shared trial number [P] (pricing FAQ). Without an Indian KYC you cannot get a dedicated number.

### 3.3 Plivo

- Numbers/KYC [S] https://www.plivo.com/docs/voice/concepts/india-calling and https://plivo.com/docs/numbers/regulatory-compliance : only businesses with a registered entity in India can rent Indian numbers or use domestic routes; accepted KYC documents are the Certificate of Incorporation and the GST certificate ("no other documents are accepted"); foreign businesses must use international routes with international/US caller ID; for inbound, India-to-India with both legs inside India. Not fetched in full (UNVERIFIED beyond the summary). So an individual developer or a foreign company cannot get an Indian Plivo number.
- GetInput [P] https://www.plivo.com/docs/voice/xml/getinput : attributes/defaults `action` (required), `method=POST`, `inputType` (`dtmf`, `speech`, `dtmf speech`), `executionTimeout=15`, `digitEndTimeout=auto`, `speechEndTimeout=auto`, `startInputTimeout`, `retries=1`, `numDigits=32`, `finishOnKey=#`, `language=en-US`, `speechModel=default`, `hints`, `profanityFilter=false`, `interimSpeechResultsCallback` (+Method POST), `redirect=true`, `log=true`. Action params: `InputType`, `Digits`, `Speech`, `SpeechConfidenceScore`, `BilledAmount` (+ standard call params). Nested: `<Speak>`, `<Play>`. Documented languages: en-US, en-GB, en-AU, es-US, es-ES, fr-FR, de-DE, it-IT, pt-BR, ja-JP, zh-CN ("common languages include"); Tamil not documented; ASR engine not stated.
- Signature V3 [P][L] https://www.plivo.com/docs/voice/concepts/signature-validation.md and SDK source https://raw.githubusercontent.com/plivo/plivo-python/master/plivo/utils/signature_v3.py : exact algorithm in section 5.3.
- Pricing, trial, TTS voices, streaming, answer-URL parameters: UNVERIFIED.

### 3.4 Vonage

- Speech input [P] https://developer.vonage.com/en/voice/voice-api/guides/asr : supported languages include Tamil (India) `ta-IN` (also `hi-IN`, `te-IN`, `en-IN`); NCCO `input` speech can choose `provider` = `deepgram` or `google` with `providerOptions` (`language_code`, `model`); legacy `language` (default en-US) and `context` hints; `saveAudio`. Input callback fields: `speech.results[].text`, `speech.results[].confidence`, `speech.timeout_reason`, `speech.recording_url`, `dtmf.digits`, `dtmf.timed_out`, `uuid`, `conversation_uuid`, `timestamp`. Chargeable (google = Standard, deepgram = Premier pricing).
- Signed webhooks [S] https://developer.vonage.com/en/voice/voice-api/webhook-reference and https://developer.vonage.com/en/video/how-tos/verifying-webhooks/index : Voice/Messages/Dispatch support signed callbacks by default; JWT in the `Authorization: Bearer` header; claim `api_key` identifies which signature secret signed it; HS256; claim `payload_hash` must equal SHA-256 of the RAW body. Exact claim list and `iat`/`jti` replay handling: UNVERIFIED.
- Indian numbers: UNVERIFIED (nothing found). Not a realistic option for an Indian inbound number as far as verified.

### 3.5 Ozonetel

[S] only: https://motech-project.readthedocs.io/en/latest/demos/ivr/kookoo.html and https://cpaas.ozonetel.com/index.php/kookoo-docs (KooKoo): XML response model - `playtext` (text-to-speech), `playaudio`, `collectdtmf` (result delivered to your app as a `GotDTMF` event), `record`, `dial`, `hangup`, `gotourl`, `sendsms`; request parameters `sid`, `cid`, `called_number`, `event` (e.g. `NewCall`). No native Tamil speech recognition and no webhook signature found. A third-party blog calls Ozonetel strong in enterprise contact-centre bundles but "weaker on API-first developer experience" (https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026) - opinion, not a fact. Numbers, KYC, pricing, Tamil: UNVERIFIED.

### 3.6 Knowlarity

[S] only: search results (https://learn.microsoft.com/en-us/answers/questions/1166758/knowlarity-super-receptionist-api-integration-to-a , https://edesy.in/ai-voice-agent/integrations/knowlarity) say SuperReceptionist can route calls to an API/SIP destination and has webhooks and a webhook-management API; marketing text claims multi-language IVR including Tamil. No official developer docs were reached. Webhook model, signature, KYC, pricing, Tamil ASR/TTS: UNVERIFIED.

### 3.7 Indian regulatory summary (not legal advice)

**DoT / OSP status** [S - the two primary pages returned HTTP 403]: DoT liberalised the Other Service Provider (OSP) guidelines on 23 June 2021 (after a 5 Nov 2020 version): registration of OSP centres removed; domestic/international OSP distinction removed; no bank guarantee; Work-From-Home and Work-From-Anywhere in India allowed (remote agents); where the EPABX is at a different location, remote access to CDRs, system logs, configurations and routing tables must be available on demand to the Authority / law-enforcement agencies. Sources located: https://www.pib.gov.in/PressReleasePage.aspx?PRID=1729725 , https://static.pib.gov.in/WriteReadData/userfiles/OSP%20Guidelines%2005.11.2020.pdf , https://www.dot.gov.in/static/uploads/2025/08/37d70ceec29374f291f3a92249bd1f02.pdf . Implications: an AI helpline that merely uses authorised telecom providers' numbers should not need an OSP registration under these guidelines (verify with counsel; the Telecommunications Act 2023 rules were not researched - UNVERIFIED). Cloud telephony itself is delivered by licensed/authorised providers (Exotel etc.) who run the KYC shown above.

**TRAI TCCCPR 2018** [P][L] https://www.trai.gov.in/sites/default/files/2026-05/CA_21052026.pdf (official consolidated PDF, headed "consolidated ... for ease of reference; gazetted text prevails"; I extracted the text locally):
- "Commercial Communication": "any voice call or message using telecommunication services, where the primary purpose is to inform about or advertise or solicit business for (A) goods or services; or (B) a supplier or prospective supplier of offered goods or services; or (C) a business or investment opportunity; or (D) a provider or prospective provider of such an opportunity". Intent "may be inferred from (A) the content ... (B) the manner in which the content ... is presented (C) the content in the communication during call back to phone numbers presented or referred to in the content ...".
- "Consent": "any voluntary permission given by the customer to sender to receive commercial communication related to specific purpose, product or service ... may be explicit or inferred". "Explicit consent": "verified directly from the Recipient in a robust and verifiable manner and recorded by Consent Registrar". "Inferred Consent": "reasonably inferred from the customer's conduct or the Relationship between the Recipient and the Sender ... shall not extend beyond duration / discharge of the contract".
- "Promotional voice call": a commercial voice call containing promotional material or advertisement; promotional content mixed into any commercial call makes it promotional; delivered only to subscribers who have not blocked the category or have given consent in the Consent Register.
- "Service message or Service Call": to the sender's Customer/Subscriber with non-promotional information about a product/service (no explicit consent), or to a Recipient to facilitate/complete an ongoing commercial transaction AFTER Explicit Consent (valid seven days or as directed).
- "Transactional Voice Call": to its Customer in response to a customer-initiated transaction within thirty minutes; non-promotional; no explicit consent.
- "UCC": any commercial communication neither per consent nor per registered preference; excludes transactional calls, service calls and Government/Authority-directed communications.
- "Robo Calls": "any call made to any customer using an artificial or prerecorded voice to interactively deliver a voice message without the involvement of human being on calling side for participating in the dialogue". Regulation 4: "Every Sender shall notify the Originating Access Provider, in advance, about the use of Auto Dialer or Robo-Calls as well as the intended objective of such calls in writing."
- Calling-line identity for senders of promotional/transactional/service voice calls: 140-level series "or any other numbering series directed by the Authority/DoT". The 1600 series for service/transactional calls is mentioned only in search summaries [S]; calling-hour limits were not found in the consolidated text (UNVERIFIED).
- TRAI amendments 2025 (https://www.pib.gov.in/PressReleasePage.aspx?PRID=2102413) and a draft "Third Amendment 2026" (https://www.pib.gov.in/PressReleasePage.aspx?PRID=2239885) exist [S]; their content was not read.

**Reading for AgroSaarthi (analysis)**
1. Inbound calls initiated by farmers are not "sent" commercial communications; TCCCPR's UCC concept regulates communications a Sender sends to a Recipient. No TCCCPR consent step is needed to answer an inbound call.
2. A callback made because the farmer asked for it and whose primary purpose is delivering the requested agronomic diagnosis/advice is arguably NOT a "commercial communication" (it does not inform about, advertise or solicit business for goods/services). Risk factors: the intent test looks at content, manner of presentation and call-back content, so any promotion of inputs, partner shops, paid tiers or schemes with commercial interest turns it into a (promotional) commercial communication - "mixed" content is treated as promotional - requiring consent/preference scrubbing, a registered telemarketer and a 140-series line.
3. An AI-voice callback fits the literal "Robo Calls" definition (artificial voice, no human participating). Regulation 4 binds "Sender" of commercial communication, but notifying the telecom provider in writing about the AI-voice callback and its objective is a cheap precaution.
4. Keep evidence of the callback request (number, timestamp, channel, purpose, language) and offer an opt-out in the first sentence of any callback.
5. CPaaS contract rules apply on top (e.g. Twilio's India guideline: consent for commercial communications, OTP voice not allowed, blocking of short-duration high-volume calling).

**Call recording disclosure**: no statute or TRAI rule was found in the verified sources that prescribes a specific recording-disclosure wording for private-business call recording (UNVERIFIED as a legal requirement). Common practice is a spoken notice at call start ("this call may be recorded for quality and service improvement") with the option to decline. Voice recordings and transcripts are personal data; the Digital Personal Data Protection Rules, 2025 were notified on 14 November 2025 with an 18-month phased commencement and require a clear, standalone notice stating the specific purpose of collection and use [S] https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014 (PDF https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf). Exact start dates per obligation: UNVERIFIED. Design basis: announce recording + AI processing at call start, minimal retention, purpose limitation, deletion on request.

---

## 4. Recommendation with trade-offs

### 4.1 Implement FIRST: Twilio adapter
Why:
- Every adapter ingredient is documented and verified: signature (algorithm + test vector reproduced), request parameter list, Gather (DTMF + speech) attributes, Tamil TTS voices, TwiML verb set, Media Streams audio spec, explicit timeout/retry semantics.
- Fully testable offline (signature and TwiML renderer are pure functions; section 5 gives vectors) and online with a trial account plus an HTTPS tunnel, with no Indian number.
- TwiML is the template for Plivo XML and KooKoo XML, so the renderer abstraction carries over.

Trade-offs:
- Twilio is NOT the production number provider for an Indian entity: the only India number is a +91 800 toll-free that requires a non-Indian address.
- Native Tamil ASR through Gather is unproven (deprecated-table only). Use Gather only for DTMF; capture speech with `<Record>` (or a bidirectional Media Stream) and run Tamil STT in our own service. Treat `Gather input="speech" language="ta-IN"` as an experiment to be benchmarked, never a dependency.
- Trial limits (verified recipients, sign-up country, 30 days).

### 4.2 Most practical for a real Indian deployment: Exotel (Voicebot/Stream applet on a 1800 toll-free or city DID), bring-your-own Tamil STT/TTS
Why:
- Only candidate with verified Indian number types including 1800 toll-free (farmer pays nothing - decisive for button-phone farmers), a published KYC path for Indian companies, partnerships, trusts and sole proprietors, a documented bidirectional streaming applet with an exact audio spec, and a trial with a shared number.
- Indian GST invoicing (18% GST on invoices for Indian customers [P]).

Caveats (honest):
- No per-call markup webhook; behaviour is configured in a visual flow. Passthru is a 200/302 branch, not a response carrier.
- No documented webhook signature; protect the WebSocket with Basic Auth or IP allow-listing, unguessable path, and per-call tokens passed as custom parameters (max 256 chars).
- No native Tamil ASR/TTS: our pipeline must do VAD + STT + Gemini + TTS and send raw 16-bit 8 kHz PCM back in 320-byte multiples.
- Pricing, plan eligibility for the Voicebot applet, concurrency limits, KYC turnaround, individual-developer eligibility: UNVERIFIED - get written answers (section 6 list). KYC lead time is the long pole; start the paperwork now.

### 4.3 Alternatives and non-recommendations
- Plivo: workable for an Indian-registered business (Certificate of Incorporation + GST) [S], good XML + V3 signature (verified), but Tamil ASR is undocumented and numbers/pricing unverified.
- Ozonetel / Knowlarity: India-native, plausible but unverified; likely enterprise-sales-led with weak self-serve docs. Evaluate by contacting sales if Exotel KYC or pricing fails.
- Vonage: has ta-IN ASR but no verified Indian-number route; skip for inbound India.
- If AgroSaarthi has no registered entity yet, partner with a registered FPO/NGO/company for KYC, or register a sole proprietorship (Udyam/MSME or GST) first.

### 4.4 Architecture consequences
- The adapter interface must support two modes: (A) request/response markup (Twilio, Plivo, KooKoo, Vonage NCCO) and (B) full-duplex media stream (Twilio Media Streams, Exotel Voicebot). Build the conversation core on mode B (PCM16 8 kHz in -> VAD -> STT(ta) -> Gemini -> TTS(ta) -> PCM out); mode A needs only DTMF menus, `<Record>` and `<Play>`/`<Say>`.
- Codec bridging: Twilio stream audio is mu-law 8 kHz, Exotel is linear PCM16 8 kHz (or 16/24 kHz): convert once at the adapter edge; STT usually wants 16 kHz PCM16.
- Button-phone UX: DTMF-first menus, short Tamil prompts, "press 0 for expert" transfer, repeat/confirm via digits; never require speech to proceed.
- Webhook latency: keep every webhook response well under 15 s (Twilio hard cap); for slow LLM calls play a filler and `<Redirect>` to a polling endpoint (section 5.2.6).

### 4.5 Suggested sequence
1. Define `VoiceProviderAdapter` (section 5.1), implement Twilio signature + TwiML renderer + tests using the vectors below.
2. Build the stream-mode session core with a Twilio Media Streams endpoint (mu-law) and a local WebSocket simulator.
3. In parallel: start Exotel KYC; request sandbox/trial number and written answers to the section 6 questions.
4. Benchmark Tamil STT on 8 kHz farmer-like audio before choosing engines.
5. Implement the Exotel adapter (Passthru if needed + Voicebot WSS) and add Plivo only if Exotel is blocked.

---

## 5. Implementation details an engineer needs WITHOUT web access

### 5.1 Provider-neutral adapter contract (suggested)

```ts
export type CallAction =
  | { type: 'say'; text: string; lang: string; voice?: string }
  | { type: 'play'; url: string }                       // public HTTPS mp3/wav
  | { type: 'gatherDtmf'; prompt: CallAction[]; numDigits: number; timeoutSec: number; next: string }
  | { type: 'gatherSpeech'; prompt: CallAction[]; lang: string; timeoutSec: number; speechTimeout: 'auto' | number; next: string; hints?: string[] }
  | { type: 'record'; maxLengthSec: number; timeoutSec: number; finishOnKey?: string; next: string; statusCallback?: string }
  | { type: 'redirect'; url: string }
  | { type: 'dial'; number: string; callerId?: string; timeoutSec: number; next?: string }
  | { type: 'stream'; wssUrl: string; params?: Record<string, string> }
  | { type: 'pause'; seconds: number }
  | { type: 'hangup' };

export interface InboundCallEvent {
  provider: 'twilio' | 'plivo' | 'exotel' | 'vonage';
  callId: string; from: string; to: string; direction?: string;
  digits?: string; speechText?: string; speechConfidence?: number; recordingUrl?: string;
  raw: Record<string, string>;
}
export interface VoiceProviderAdapter {
  verify(req: { method: string; url: string; headers: Record<string, string>; rawBody: string; form?: Record<string, string | string[]> }): boolean;
  parse(form: Record<string, string>): InboundCallEvent;
  render(actions: CallAction[]): { status: number; contentType: string; body: string };
}
```

Cross-provider mapping (only items with a [P] verb/element are firm):

| Action | Twilio | Plivo | Exotel | Vonage |
|---|---|---|---|---|
| say | `<Say voice="Google.ta-IN-Standard-C" language="ta-IN">` [P] | `<Speak>` (nested in GetInput [P]; Tamil UNVERIFIED) | no native TTS: pre-render with own TTS and stream/Play | NCCO `talk` (Tamil UNVERIFIED) |
| play | `<Play>` [P] | `<Play>` (nested in GetInput [P]) | send audio frames over WSS | NCCO `stream` (UNVERIFIED) |
| DTMF | `<Gather input="dtmf">` [P] | `<GetInput inputType="dtmf">` [P] | `dtmf` stream event [P] | NCCO `input` type dtmf (UNVERIFIED fields) |
| speech | `<Gather input="speech" language="ta-IN">` (Tamil UNVERIFIED) | `<GetInput inputType="speech">` (Tamil not documented) | own STT on stream | NCCO `input` speech, `ta-IN` [P] |
| record | `<Record>` | UNVERIFIED | capture from stream | NCCO `record` (UNVERIFIED) |
| redirect | `<Redirect>` [P verb] | UNVERIFIED | flow routing | return new NCCO |
| dial/transfer | `<Dial>` [P verb] | UNVERIFIED | next applet in flow (names UNVERIFIED) | NCCO `connect` (UNVERIFIED) |
| hangup | `<Hangup/>` [P verb] | UNVERIFIED | applet end / `stop` | end of NCCO |

### 5.2 Twilio

#### 5.2.1 Configuration
On the Twilio number: Voice URL = `POST https://<public-host>/voice/twilio/inbound`; Fallback URL = `https://<public-host>/voice/twilio/fallback`; Status Callback URL = `https://<public-host>/voice/twilio/status`. Per-URL connection overrides go in the URL fragment: `https://<host>/voice/twilio/inbound#rc=1&rt=10000`. Menu/field names in the Console and the default HTTP method of the number's Voice URL (POST) are UNVERIFIED (recalled).

#### 5.2.2 Inbound request parameters (form-encoded) [P]
`CallSid`, `AccountSid`, `From`, `To`, `CallStatus`, `ApiVersion`, `Direction`, `ForwardedFrom`, `CallerName`, `ParentCallSid`, `CallToken`, and when available `FromCity`, `FromState`, `FromZip`, `FromCountry`, `ToCity`, `ToState`, `ToZip`, `ToCountry`. Gather action adds `Digits`, `SpeechResult`, `Confidence` [P]. Respond with `Content-Type: text/xml`.

#### 5.2.3 Signature validation algorithm [P][L]
1. `url` = the exact public URL Twilio was configured with, including scheme, host, optional port and query string (take it from a configured `PUBLIC_BASE_URL` + `req.originalUrl`; never trust the Host header).
2. Sort POST parameter names ascending (byte/ASCII order, case-sensitive).
3. `data = url + name1 + value1 + name2 + value2 ...` (values URL-decoded, UTF-8, no delimiters).
4. `sig = base64(HMAC_SHA1(key = AuthToken, data))`.
5. Compare with header `X-Twilio-Signature` in constant time. Try URL variants without port / with explicit `:443` (`:80` for http) because of the documented port behaviour.
6. JSON bodies: parse `bodySHA256` from the query string, SHA-256 the raw body, compare, and sign the URL (with that query param) with no params.

Test vectors:
- Twilio documented [P][L]: token `12345`, URL `https://example.com/myapp.php?foo=1&bar=2`, params `CallSid=CA1234567890ABCDE`, `Caller=+14158675310`, `Digits=1234`, `From=+14158675310`, `To=+18005551212` -> `L/OH5YylLD5NRKLltdqwSvS0BnU=`.
- SELF-COMPUTED UTF-8/Tamil vector [L] (not from Twilio): token `testtoken123`, URL `https://api.example.com/voice/twilio/speech?lang=ta&attempt=1`, params `AccountSid=AC00000000000000000000000000000001`, `CallSid=CA00000000000000000000000000000001`, `CallStatus=in-progress`, `Confidence=0.87`, `Direction=inbound`, `From=+919876543210`, `SpeechResult=நெல் இலை மஞ்சளாகிறது`, `To=+911800000000` -> `YwigqKPGBrm7Txo3WOD8XvSh+9Y=` (sorted key order: AccountSid, CallSid, CallStatus, Confidence, Direction, From, SpeechResult, To).

Reference code (Node 20 / Express 5 / TypeScript; the JS equivalent was executed and reproduces both vectors):

```ts
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function twilioExpected(authToken: string, url: string, params: Record<string, unknown>): string {
  let data = url;
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (Array.isArray(v)) { for (const item of [...v].map(String).sort()) data += k + item; } // repeated keys: UNVERIFIED behaviour
    else data += k + String(v ?? '');
  }
  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}
export function urlVariants(fullUrl: string): string[] {
  const m = /^(https?:\/\/)([^\/:?#]+)(?::(\d+))?(.*)$/i.exec(fullUrl);
  if (!m) return [fullUrl];
  const [, scheme, host, port, rest] = m;
  const defPort = scheme.toLowerCase() === 'https://' ? '443' : '80';
  return [...new Set([fullUrl, `${scheme}${host}${rest}`, `${scheme}${host}:${port ?? defPort}${rest}`])];
}
const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const twilioAuth = (authToken: string, publicBaseUrl: string) => (req: Request, res: Response, next: NextFunction) => {
  const header = String(req.header('X-Twilio-Signature') ?? '');
  const fullUrl = publicBaseUrl.replace(/\/$/, '') + req.originalUrl;           // express.urlencoded({ extended: false }) must run first
  const ok = urlVariants(fullUrl).some(u => safeEqual(twilioExpected(authToken, u, req.body ?? {}), header));
  if (!ok) return res.status(403).type('text/plain').send('invalid signature');
  next();
};
```

Replay/idempotency (Twilio documents no timestamp or nonce): keep a per-`CallSid` state machine and make each step idempotent; put your own expiring HMAC token in each `action` URL query (the signature already protects the query string) so a captured request cannot be replayed to a different step or after expiry.

#### 5.2.4 TwiML snippets (Tamil)
Escape `&` as `&amp;` inside XML. Verbs and Gather attributes are [P]; Record/Dial/Play attribute names below are UNVERIFIED (recalled from the TwiML reference; check in a sandbox).

A. Greeting + recording notice + DTMF language menu (Say/Pause/Play nesting inside Gather is [P]):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ta-IN" voice="Google.ta-IN-Standard-C">வணக்கம்! அக்ரோசாரதி உதவி எண்ணுக்கு வரவேற்கிறோம். இந்த அழைப்பு தரத்திற்காகப் பதிவு செய்யப்படலாம்.</Say>
  <Gather input="dtmf" numDigits="1" timeout="6" action="https://api.example.com/voice/twilio/menu" method="POST">
    <Say language="ta-IN" voice="Google.ta-IN-Standard-C">தமிழுக்கு ஒன்றை அழுத்தவும்.</Say>
    <Pause length="1"/>
    <Say language="en-US" voice="Polly.Joanna-Generative">For English, press two.</Say>
  </Gather>
  <Redirect method="POST">https://api.example.com/voice/twilio/menu?retry=1</Redirect>
</Response>
```
If `Gather` times out with no input the flow falls through to `<Redirect>` (because `actionOnEmptyResult` defaults to false [P]); count `retry` and after 2 loops default to Tamil or hang up.

B. Speech gather in ta-IN with timeouts (Tamil support UNVERIFIED; always pair with a record fallback):

```xml
<Response>
  <Gather input="speech dtmf" language="ta-IN" speechTimeout="auto" timeout="6" numDigits="1"
          actionOnEmptyResult="true" profanityFilter="false"
          action="https://api.example.com/voice/twilio/speech" method="POST">
    <Play>https://cdn.example.com/prompts/ta/ask-problem.mp3</Play>
  </Gather>
</Response>
```
Action request adds `SpeechResult`, `Confidence`, `Digits` [P]. With `actionOnEmptyResult="true"` the action is called even with nothing recognised (then `SpeechResult` is absent). Optional `speechModel` values to try for ta-IN (one at a time): `googlev2_telephony`, `googlev2_chirp_3`, `deepgram_nova-3` [model names P; ta-IN support UNVERIFIED].

C. Play an MP3/WAV from an external HTTPS URL (nested `Play` inside Gather is [P]; accepted formats UNVERIFIED, MP3 and WAV are the expected ones):

```xml
<Response>
  <Play>https://cdn.example.com/audio/advice-8f3a.mp3</Play>
</Response>
```

D. Record the farmer (more reliable than Gather speech for Tamil; send the file to your own STT):

```xml
<Response>
  <Say language="ta-IN" voice="Google.ta-IN-Standard-C">பீப் ஒலிக்குப் பிறகு உங்கள் பயிரில் என்ன பிரச்சினை என்று சொல்லுங்கள். முடித்ததும் # பொத்தானை அழுத்தவும்.</Say>
  <Record action="https://api.example.com/voice/twilio/recorded" method="POST" maxLength="30" timeout="4"
          playBeep="true" finishOnKey="#" trim="trim-silence"
          recordingStatusCallback="https://api.example.com/voice/twilio/recording-status"
          recordingStatusCallbackEvent="completed"/>
  <Say language="ta-IN" voice="Google.ta-IN-Standard-C">மன்னிக்கவும், உங்கள் குரல் பதிவாகவில்லை.</Say>
  <Hangup/>
</Response>
```
Record callback fields (UNVERIFIED, recalled): `RecordingUrl` (add `.mp3` or `.wav`), `RecordingSid`, `RecordingDuration`, `RecordingStatus`, `Digits`. Download recordings with Basic Auth (AccountSid:AuthToken) (UNVERIFIED).

E. Redirect (flow control; also used for polling):

```xml
<Response>
  <Redirect method="POST">https://api.example.com/voice/twilio/next?step=advice</Redirect>
</Response>
```

F. Dial/transfer to a human expert (outbound to India must use a non-Indian Twilio caller ID per Twilio's India guideline [P]):

```xml
<Response>
  <Say language="ta-IN" voice="Google.ta-IN-Standard-C">நிபுணருடன் இணைக்கிறோம். தயவுசெய்து காத்திருங்கள்.</Say>
  <Dial timeout="25" callerId="+1XXXXXXXXXX" answerOnBridge="true"
        action="https://api.example.com/voice/twilio/dial-result" method="POST">
    <Number>+91XXXXXXXXXX</Number>
  </Dial>
</Response>
```
`<Dial>` action fields (UNVERIFIED, recalled): `DialCallStatus` (`completed|answered|busy|no-answer|failed|canceled`), `DialCallSid`, `DialCallDuration`. If the expert does not answer, the dial-result handler must return fallback TwiML (record a message or hang up).

G. Hangup:

```xml
<Response>
  <Say language="ta-IN" voice="Google.ta-IN-Standard-C">நன்றி. வணக்கம்.</Say>
  <Hangup/>
</Response>
```

H. Hold / slow-LLM polling pattern (each hop must finish well under the 15 s hard cap):

```xml
<Response>
  <Play>https://cdn.example.com/prompts/ta/please-wait.mp3</Play>
  <Pause length="2"/>
  <Redirect method="POST">https://api.example.com/voice/twilio/poll?job=JOB123&amp;n=2</Redirect>
</Response>
```
The poll endpoint returns the answer `<Play>` when ready, or this document again with `n+1`, up to a max count, then an apology and hangup. Queue-style hold with `<Enqueue>`/`<Leave>` also exists [P verbs].

I. Bidirectional media stream (syntax UNVERIFIED, recalled; message formats [P], see 5.2.7):

```xml
<Response>
  <Connect>
    <Stream url="wss://api.example.com/voice/twilio/stream">
      <Parameter name="sessionToken" value="signed-token-here"/>
    </Stream>
  </Connect>
</Response>
```

#### 5.2.5 Timeouts, retries, fallback, status callbacks [P unless noted]
- Hard cap 15 s on all call-related HTTP requests; default connect timeout 5000 ms, read timeout 15000 ms, retry count 1; override via URL fragment `#ct=…&rt=…&tt=…&rc=…`.
- Fallback URL: configured on the number; Twilio fails over to it after failures (details such as extra `ErrorCode`/`ErrorUrl` parameters are UNVERIFIED).
- Error codes (UNVERIFIED, recalled): 11200 HTTP retrieval failure, 11205 HTTP connection failure, 12100 document parse failure, 12300 invalid Content-Type.
- Status callbacks: reply 204 (or 200 + empty `<Response/>`) [P]; event names/fields (`CallSid`, `CallStatus`, `CallDuration`, `Timestamp`) UNVERIFIED.
- TLS: use a publicly trusted certificate; Twilio will not call self-signed endpoints (UNVERIFIED).

#### 5.2.6 Latency rule of thumb
Respond to every Gather/Record action in < 3 s whenever possible; if the LLM/STT pipeline may exceed that, return the pattern H document immediately and compute asynchronously.

#### 5.2.7 Media Streams protocol [P] https://www.twilio.com/docs/voice/media-streams/websocket-messages
- Audio: `audio/x-mulaw`, 8000 Hz, 1 channel, base64, no file-header bytes (both directions).
- Twilio -> you (all have `event`, `sequenceNumber` (string, starts "1"), `streamSid`): `connected` `{"event":"connected","protocol":"Call","version":"1.0.0"}`; `start` with `start.streamSid`, `start.accountSid`, `start.callSid`, `start.tracks[]` ("inbound"/"outbound"), `start.customParameters{}`, `start.mediaFormat{encoding,sampleRate,channels}`; `media` with `media.track`, `media.chunk`, `media.timestamp` (ms), `media.payload` (base64); `dtmf` with `dtmf.track`, `dtmf.digit`; `stop` with `stop.accountSid`, `stop.callSid`; `mark` with `mark.name`.
- You -> Twilio (bidirectional streams only): `{"event":"media","streamSid":"...","media":{"payload":"<base64 mulaw 8k>"}}`; `{"event":"mark","streamSid":"...","mark":{"name":"..."}}` (sent after media; Twilio echoes it when the audio before it has played); `{"event":"clear","streamSid":"..."}` (empties queued audio; pending marks are returned).
- The docs' WebSocket troubleshooting note ("if you are having trouble verifying a WebSocket handshake request ... try appending a trailing `/` to the URL") implies the handshake is signed with `X-Twilio-Signature` and validated with the same algorithm; exact URL scheme (`wss` vs `https`) used in the signed string is UNVERIFIED - try variants.

#### 5.2.8 Testing without an Indian number
1. Unit tests: the two Twilio vectors above; TwiML renderer snapshot tests (XML escaping, Tamil UTF-8).
2. Local integration: `curl -X POST` the inbound URL with a form body and a signature computed by the test helper; assert 200 `text/xml`, then 403 on a bad signature.
3. Live: trial account + an HTTPS tunnel (any); a number in the sign-up country; verify your own phone as a recipient (trial rule [P]); call it; expect trial restrictions (30-day expiry, verified recipients only). The trial announcement behaviour is UNVERIFIED.
4. India-specific behaviour (toll-free routing, button-phone DTMF tones, 8 kHz Tamil audio quality) cannot be validated this way; use the Exotel trial (shared number, 15-day credits [P]) or a KYC-complete Exotel number.

### 5.3 Plivo

Headers on every request Plivo makes [P]: `X-Plivo-Signature-V3`, `X-Plivo-Signature-Ma-V3` (always signed with the MAIN account Auth Token), `X-Plivo-Signature-V3-Nonce`. If several Auth Tokens are active Plivo sends a comma-separated list of signatures.

Algorithm [P][L] (official SDK `plivo/utils/signature_v3.py`, read verbatim):
1. Take scheme://netloc/path of the URL (no query). Parse the URL's own query into a map; sort keys; render `k=v` joined by `&` (values of a repeated key sorted) = `Q`.
2. GET: base = `scheme://netloc/path` + (`?` + `Q` if `Q` non-empty).
3. POST with NO POST params: same as GET.
4. POST with POST params: base = `scheme://netloc/path` + `?` + `Q` (the `?` is added even if `Q` is empty) + (`.` only if `Q` is non-empty) + sorted POST params as `key+value` concatenated with no delimiter (repeated keys: each value sorted).
5. `data = base + "." + nonce` (nonce from `X-Plivo-Signature-V3-Nonce`).
6. `sig = base64(HMAC_SHA256(key = AuthToken, data))`; valid if `sig` is one of `header.split(',')`.
7. Replay: nonces are unique per request; store seen nonces for a few minutes and reject repeats.

Self-computed vectors [L] (NOT published by Plivo; my replication reproduces the doc's assembly string `https://example.com/abcd?foo=bar.CallUuid4vbcpem8-0u46-x1ha-9af1-438vc92bf374Digits1234From+15551111111To+15555555555`):
- POST: token `my_auth_token`, nonce `kjsdhfsd87sd7yisud2`, URL `https://example.com/abcd?foo=bar`, params `CallUuid=4vbcpem8-0u46-x1ha-9af1-438vc92bf374`, `Digits=1234`, `From=+15551111111`, `To=+15555555555` -> `1tUmqoa/6s1CO84kJ13OxS6Gnj/YIv8SQMD7yptP+A0=`.
- POST, URL `https://example.com/abcd` (no query), same params/token/nonce -> `NmcvDIsX2z0I7ev3ATtmRmvRSgFBeftdES/X8i0rGrE=`.
- GET `https://example.com/abcd?foo=bar&a=1` (base `https://example.com/abcd?a=1&foo=bar`) -> `mytPuQrfQyDwFvJd+cH2mpj0QMUterWkgItDLainrJs=`.

```ts
export function plivoV3Expected(method: string, uri: string, nonce: string, authToken: string, post: Record<string, string | string[]> = {}): string {
  const m = /^(https?:\/\/[^\/?#]+)([^?#]*)(?:\?([^#]*))?/i.exec(uri)!;
  const query: Record<string, string[]> = {};
  for (const [k, v] of new URLSearchParams(m[3] ?? '')) (query[k] ??= []).push(v);
  const q = Object.keys(query).sort().map(k => [...query[k]].sort().map(v => `${k}=${v}`).join('&')).join('&');
  const isPost = method.toUpperCase() === 'POST';
  const hasPost = isPost && Object.keys(post).length > 0;
  let base = m[1] + m[2];
  if (q.length > 0 || hasPost) base += '?' + q;
  if (q.length > 0 && hasPost) base += '.';
  if (isPost) base += Object.keys(post).sort().map(k => Array.isArray(post[k]) ? [...(post[k] as string[])].sort().map(v => k + v).join('') : k + String(post[k])).join('');
  return crypto.createHmac('sha256', authToken).update(`${base}.${nonce}`, 'utf8').digest('base64');
}
// valid = header.split(',').some(s => safeEqual(plivoV3Expected(...), s.trim()))
```
(The JS above was executed and reproduces all three vectors.)

GetInput markup (attributes [P]; answer-URL mechanics and `<Speak>` attributes UNVERIFIED):

```xml
<Response>
  <GetInput action="https://api.example.com/voice/plivo/input" method="POST" inputType="dtmf speech"
            executionTimeout="15" digitEndTimeout="auto" speechEndTimeout="auto" numDigits="1" language="en-US" redirect="true">
    <Speak>Welcome to AgroSaarthi. Press 1 for Tamil.</Speak>
  </GetInput>
</Response>
```
Action params: `InputType`, `Digits`, `Speech`, `SpeechConfidenceScore`, `BilledAmount` + standard call params. Tamil `language` value is not documented - do not rely on it.

### 5.4 Exotel

Flow: ExoPhone -> flow (applets) -> optional Passthru (HTTP to your URL; return `200` for Choice A or `302` for Choice B; parameter names UNVERIFIED - capture a real request in the sandbox; recalled names, UNVERIFIED: `CallSid`, `CallFrom`, `CallTo`, `Direction`, `Created`, `CallType`, `flow_id`, `tenant_id`, `From`, `To`, `CurrentTime`) -> Voicebot/Stream applet.

Stream applet configuration [P]: WSS URL (or HTTPS endpoint that returns the WSS URL); `?sample-rate=8000|16000|24000`; custom parameters `?a=b&c=d` (<= 256 chars total) arrive in `custom_parameters`; auth by IP allow-list or Basic Auth `wss://API_KEY:API_TOKEN@host/path` (header `Authorization: Basic base64(API_KEY:API_TOKEN)`).

Audio [P]: raw/slin = signed 16-bit little-endian PCM, mono, base64; 8 kHz default. Frames you SEND: minimum 3.2 KB, maximum 100 KB (stay at or below 99,840 bytes = 312 x 320 to satisfy both readings of "KB"), always a multiple of 320 bytes (320 bytes = 160 samples = 20 ms at 8 kHz); smaller chunks risk distortion and larger ones cause timeouts (search summary [S]). Use `clear` to cancel queued audio on barge-in and `mark` to learn when audio finished.

Event field names [P]: `connected`; `start` (`stream_sid`, `call_sid`, `account_sid`, phone numbers, `custom_parameters`, `media_format`); `media` (`chunk`, `timestamp`, `payload`); `dtmf` (`duration`, `digit`); `mark` (`name`); `clear` (`{"event":"clear","stream_sid":"<stream_sid>"}`); `stop` (`call_sid`, `account_sid`, `reason`: `stopped` | `callended`). Exact JSON nesting of the messages you send back (`media`, `mark`) is UNVERIFIED - mirror what you receive and test in the sandbox.

Limits/transfer/recording/timeouts: UNVERIFIED. To transfer to an expert, end the stream so the flow continues to the next applet configured as a connect-to-number step (applet name UNVERIFIED); how a bot ends the stream deliberately (close the socket?) is UNVERIFIED.

### 5.5 Vonage (reference only; not recommended for Indian numbers)

- NCCO `input` with speech: `provider` (`google`|`deepgram`), `providerOptions.language_code` (e.g. `ta-IN`), `providerOptions.model`; legacy `language`, `context`; callback JSON fields `speech.results[].text`, `speech.results[].confidence`, `speech.timeout_reason`, `speech.recording_url`, `dtmf.digits`, `dtmf.timed_out`, `uuid`, `conversation_uuid`, `timestamp` [P]. Other NCCO field names (`eventUrl`, `speech.endOnSilence`, `startTimeout`, `maxDuration`, `dtmf.maxDigits`, `timeOut`) are UNVERIFIED.
- Signature [S]: read `Authorization: Bearer <JWT>`; decode claims (unverified) to find `api_key`; choose the matching signature secret; verify HS256; compute SHA-256 over the RAW body and compare to claim `payload_hash`; reject on mismatch. Replay fields UNVERIFIED.

---

## 6. Risks, limitations, open questions

Risks
1. Tamil ASR quality/availability: no vendor-native Tamil ASR is proven for telephony. 8 kHz narrowband mu-law/PCM plus rural accents will raise WER; plan an own STT, a benchmark set, and DTMF fallbacks.
2. Indian number access is gated by KYC and (for Twilio) by address location. Lead time unknown; individual developers may not qualify without a business registration.
3. Webhook authenticity gaps: Exotel documents no signature (use Basic Auth/IP allow-list/unguessable paths/per-call tokens); Twilio documents no replay protection (use per-call state + own expiring tokens); Plivo's nonce needs a store.
4. Latency: Twilio hard-caps HTTP at 15 s; LLM + STT + TTS in the request path can exceed it; use polling pattern or streaming.
5. Regulation: promotional content in callbacks, AI-voice (Robo Call) classification, DPDP notice/consent for voice recordings, CPaaS acceptable-use (short-duration high-volume calls get blocked). Foreign-provisioned +91 800 number for a domestic service: legal posture unknown.
6. Provider lock-in and cost: pricing for Indian toll-free inbound is unknown for every provider; toll-free is billed to the receiver.
7. Evidence quality: PIB/DoT pages returned 403; several facts rest on search summaries [S]; the Twilio pricing page text lacked the inbound table.

Open questions (ask vendors / verify in sandbox)
- Exotel: per-minute price for 1800 inbound, ExoPhone rental/activation, plan needed for the Voicebot applet, concurrency limit, KYC turnaround, is a sole proprietor with Udyam/MSME enough, do they offer webhook signatures/IP list for Passthru and WSS, Passthru parameter names/method/timeout, how to end the stream, Tamil TTS in the Greeting applet, recording options, TRAI position on AI voice bots on their numbers.
- Twilio: does any Gather 2.0 model transcribe `ta-IN`; is the +91 800 number inbound-capable and its per-minute/rental price; can a trial buy it; trial announcement behaviour; Play audio formats and Record/Dial attribute tables (re-verify section 5.2.4); ConversationRelay Tamil support (not researched).
- Plivo: Tamil ASR/TTS support, India inbound price, individual accounts, answer-URL parameters.
- Vonage, Ozonetel, Knowlarity: Indian number availability, KYC, pricing, webhook model and signatures.
- Regulatory: current DoT stance after the Telecommunications Act 2023; TRAI 2025 amendments and 2026 draft third amendment; calling-hour rules for callbacks; whether non-commercial AI-voice callbacks need Regulation 4 intimation; DPDP commencement dates and call-recording specifics; recording-announcement wording acceptable to the telecom provider.

---

## 7. Sources

Primary [P]
- https://www.twilio.com/docs/usage/webhooks/webhooks-security - X-Twilio-Signature, HMAC-SHA1, JSON bodySHA256, no replay guidance.
- https://www.twilio.com/docs/usage/security - manual validation steps, worked example (test vector), port/credentials notes, WebSocket trailing slash.
- https://www.twilio.com/docs/voice/twiml - inbound request parameters, Content-Type rule, verb list.
- https://www.twilio.com/docs/voice/twiml/gather - Gather attributes/defaults/models, action parameters, Tamil only in deprecated table.
- https://www.twilio.com/docs/voice/twiml/say/text-speech - voice families and Tamil voices.
- https://www.twilio.com/docs/voice/media-streams/websocket-messages - Media Streams audio format and message schemas.
- https://www.twilio.com/docs/usage/webhooks/webhooks-connection-overrides - timeouts, retries, 15 s hard cap.
- https://www.twilio.com/en-us/guidelines/in/regulatory - India toll-free only, address outside India, no docs.
- https://www.twilio.com/en-us/guidelines/in/voice - India voice rules (outbound only from non-Indian numbers, OTP, consent, enforcement).
- https://www.twilio.com/en-us/voice/pricing/in - outbound India prices, number price (partial).
- https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account - trial limits (partial).
- https://developer.exotel.com/docs/voice-v1/api-reference/incoming-call - flow/applet model.
- https://developer.exotel.com/docs/voice-v1/applets/passthru - 200 -> A, 302 -> B.
- https://developer.exotel.com/docs/agentstream/stream-voicebot-applet - WSS, auth, audio format, events, chunk rules.
- https://developer.exotel.com/docs/faqs/number-types - number types, inbound, toll-free billing, porting.
- https://developer.exotel.com/docs/faqs/pricing-plans - GST, activation/rental, free trial (15 days, shared number).
- https://docs.exotel.com/business-phone-system/kyc-verification - KYC categories and documents.
- https://developer.exotel.com/api/make-a-call-api - docs navigation (status callback, authentication pages exist).
- https://www.plivo.com/docs/voice/xml/getinput - GetInput attributes, languages, parameters.
- https://www.plivo.com/docs/voice/concepts/signature-validation.md - V3 headers, HMAC-SHA256, nonce, multiple signatures.
- https://raw.githubusercontent.com/plivo/plivo-python/master/plivo/utils/signature_v3.py - exact V3 algorithm (read verbatim).
- https://developer.vonage.com/en/voice/voice-api/guides/asr - ta-IN support, providers, callback fields.
- https://www.trai.gov.in/sites/default/files/2026-05/CA_21052026.pdf - TCCCPR 2018 consolidated text (definitions, Robo Calls, Regulation 4, 140 series), extracted locally.

Secondary / leads [S]
- https://www.twilio.com/en-us/guidelines/in/voice (search snippet) and search summaries - claim that new Indian domestic numbers are not sold.
- https://developer.exotel.com/docs/agentstream/getting-started - Passthru before stream (search summary).
- https://support.exotel.com/support/solutions/articles/104600-why-am-i-charged-for-incoming-calls- and https://www.cloudtalk.io/blog/exotel-pricing/ - inbound charging rationale and "from INR 0.50/min" (conflicts with pricing FAQ).
- https://www.plivo.com/docs/voice/concepts/india-calling.md , https://plivo.com/docs/numbers/regulatory-compliance - Plivo India KYC/domestic rules (summary).
- https://www.plivo.com/docs/voice/xml/request/validation/ - Plivo V3 headers (summary).
- https://developer.vonage.com/en/voice/voice-api/webhook-reference , https://developer.vonage.com/en/video/how-tos/verifying-webhooks/index - Vonage signed webhooks/JWT (summary).
- https://motech-project.readthedocs.io/en/latest/demos/ivr/kookoo.html , https://cpaas.ozonetel.com/index.php/kookoo-docs , https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026 - Ozonetel KooKoo XML model and opinion.
- https://learn.microsoft.com/en-us/answers/questions/1166758/knowlarity-super-receptionist-api-integration-to-a , https://edesy.in/ai-voice-agent/integrations/knowlarity - Knowlarity API/webhook mentions.
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=1729725 (HTTP 403 on fetch), https://static.pib.gov.in/WriteReadData/userfiles/OSP%20Guidelines%2005.11.2020.pdf , https://www.dot.gov.in/static/uploads/2025/08/37d70ceec29374f291f3a92249bd1f02.pdf (HTTP 403) - OSP 2020/2021 guideline statements (search summaries).
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2102413 and https://www.pib.gov.in/PressReleasePage.aspx?PRID=2239885 - TCCCPR 2025 amendments and 2026 draft third amendment (titles only).
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014 and https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf - DPDP Rules 2025 notified 14 Nov 2025, 18-month phasing, consent notice (summary).

Local reproductions [L]
- Twilio documented vector recomputed (Python hmac-sha1 + Node): `L/OH5YylLD5NRKLltdqwSvS0BnU=`.
- Plivo V3 algorithm re-implemented in Python and Node; self-computed vectors in section 5.3.
- TRAI PDF text extracted with `pdftotext -layout`; definitions quoted in section 3.7.
