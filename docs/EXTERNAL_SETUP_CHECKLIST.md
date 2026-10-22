# External Setup Checklist

Things that require accounts, credentials, or actions outside this repository. Nothing here has been
configured yet. Never paste credentials into source files or chat — set them in `backend/.env`
locally (git-ignored) or in the hosting provider's secret manager.

| # | Item | Needed for | Status |
|---|---|---|---|
| 1 | Gemini API key (Google AI Studio) + verified model ID | Conversational AI (`AI_PROVIDER=gemini`) | ☐ Not configured |
| 2 | Managed MongoDB (e.g. MongoDB Atlas) with least-privilege user + network allowlist | Production database | ☐ Not configured |
| 3 | Private S3-compatible bucket (AWS S3 / Cloudflare R2 / Backblaze B2) | Production image/audio storage | ☐ Not configured |
| 4 | Speech-to-text provider credentials (Tamil-capable) | Voice input | ☐ Pending research |
| 5 | Text-to-speech provider credentials (Tamil-capable) | Spoken responses | ☐ Pending research |
| 6 | Telephony provider account + Indian phone number + KYC | Real incoming calls | ☐ Pending research |
| 7 | Hosting: backend (Node 22/24), frontend (static SPA), model service (Python) | Deployment | ☐ Pending research |
| 8 | Domain / HTTPS (provided by hosts by default) | Production URLs | ☐ |
| 9 | Legal review: DPDP Act/Rules, telecom, call-recording consent, pesticide advice | Production launch in India | ☐ Pending research |
| 10 | Native Tamil speaker review of UI and voice prompts | Production quality | ☐ |
| 11 | Agricultural expert review of knowledge-base content | Marking documents EXPERT_REVIEWED | ☐ |
| 12 | Upgrade local Node.js to 22 or 24 LTS (20 is end-of-life) | Security / parity with deployment | ☐ Recommended |

Details for each item will be expanded with exact steps in `docs/DEPLOYMENT.md`, `docs/TELEPHONY.md`
and `docs/VOICE_PIPELINE.md` as those modules are completed.
