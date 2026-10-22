# AgroSaarthi AI — Master Specification (as received)

> **Provenance note:** This file reproduces the specification pasted by the project owner on
> 2026-10-22. The paste was **truncated by the chat client at 50,000 characters, part-way
> through Section 26** ("Required project directory organization"). Sections after that point
> were never received. Anything the truncated sections may have required is therefore unknown;
> see `docs/DECISIONS.md` (D-000) for how the gap is handled.

---

## Part A — Critical implementation requirement (preamble)

CRITICAL IMPLEMENTATION REQUIREMENT

Your task is to build a functioning, integrated, deployable application,
not merely generate a project structure, prototype UI, documentation,
or a collection of disconnected modules.

Follow these rules throughout implementation:

1. Inspect the repository and available development environment before
   making changes.

2. Implement the project in small, verifiable phases. Complete and test
   each phase before proceeding to the next.

3. Do not mark a feature as complete merely because its files exist.
   Verify that its frontend, backend, database, and required external
   services work together.

4. Do not use fake API responses, hardcoded AI predictions, mock
   authentication, or placeholder success messages in production paths.

5. Mocks and simulators may be used for automated testing and local
   development, but label them clearly. Never claim that simulated
   telephone calls are real calls.

6. If an external API requires credentials, implement the integration,
   validate its configuration, document the required setup, and report
   honestly if live verification is blocked by missing credentials.

7. Run the relevant tests after each phase. Fix failures before
   proceeding. Never claim that tests passed unless you ran them and
   inspected their results.

8. Test complete user journeys, including:
   - Farmer registration and login.
   - Uploading a crop image and receiving an actual model result.
   - Asking an agricultural question and receiving an AI-generated
     response grounded in the configured knowledge base.
   - Regional-language speech input and spoken output.
   - Telephone call handling, if the required provider is configured.
   - Expert escalation and case management.
   - Role-based authorization and rejection of unauthorized requests.

9. Test failure scenarios, including unavailable AI services, invalid
   images, unsupported languages, missing credentials, network failures,
   malformed webhooks, and database errors.

10. Never invent disease detection accuracy, test results, deployment
    status, or successful external API calls.

11. Before deployment, verify environment variables, CORS configuration,
    database connectivity, secrets handling, logging, error handling,
    and production build settings.

12. Deploy the application where credentials and account permissions
    permit. Then run production smoke tests and report the actual result.

13. Maintain a progress log identifying completed features, test results,
    unresolved defects, external setup requirements, and the next task.

14. If you encounter a context limit, stop safely, update the progress
    files, and resume from the exact unfinished task in the next session.
    Do not restart completed work unnecessarily.

FINAL ACCEPTANCE RULE:
The project is complete only when the implemented features have been
verified, the available automated tests pass, deployment checks have
been performed, and all remaining limitations are documented.

Distinguish clearly between:
- Implemented and locally tested.
- Integrated and tested with live external services.
- Deployed and production-tested.
- Blocked by missing credentials or external dependencies.
- Not implemented.

---

## Part B — Project master specification

# PROJECT MASTER SPECIFICATION
# AGROSAARTHI AI
# AI-POWERED CROP DISEASE DETECTION AND MULTILINGUAL
# VOICE-BASED AGRICULTURAL ASSISTANCE PLATFORM

You are acting as a Principal Software Architect, Senior Full-Stack
Engineer, AI/ML Engineer, DevOps Engineer, QA Engineer, Security
Engineer, and Technical Documentation Lead.

Your responsibility is to design, implement, test, document, and deploy
a complete, integrated, production-minded prototype of AgroSaarthi AI.

Do not merely provide code snippets, a project outline, a mockup, or a
tutorial. Work directly in the repository, inspect existing files,
create and modify the necessary files, run commands, execute tests,
fix failures, and produce a complete deployable application.

The project must be developed incrementally, with working components,
verifiable integrations, clear documentation, and a deployment plan.

Do not claim that a feature works unless you have actually implemented
and tested it or clearly identify the external verification still needed.

============================================================
1. PROJECT VISION
============================================================

Project name:
AgroSaarthi AI

Full title:
AI-Powered Crop Disease Detection and Multilingual Voice-Based
Agricultural Assistance Platform.

Primary mission:
Help farmers identify possible crop diseases and pest infestations
early and access understandable agricultural guidance in their
preferred regional language, including through ordinary telephone calls.

The system must address two problems simultaneously:

1. Farmers may lack access to reliable, early crop disease and pest
   identification.
2. Many farmers cannot comfortably use smartphone applications,
   navigate digital interfaces, or understand English-language
   agricultural advice.

The solution must combine image-based AI, conversational AI,
regional-language speech processing, telephone support, a verified
agricultural knowledge base, and human agricultural expert escalation.

The application must be useful to both:

A. Farmers using basic button phones.
B. Farmers, agricultural field workers, and administrators using
   smartphones or computers.

The primary initial language is Tamil.

Design the architecture to support additional Indian languages later,
including Telugu, Kannada, Malayalam, and Hindi, provided the selected
speech and language services support them adequately.

The initial deployment context is India.

============================================================
2. NON-NEGOTIABLE REQUIREMENTS
============================================================

Build an integrated application rather than disconnected demonstrations.

The system must include:

1. Responsive farmer-facing web application.
2. Image upload for crop disease and pest analysis.
3. AI-powered image classification.
4. Multilingual conversational agricultural assistant.
5. Tamil-first voice interaction.
6. Telephone-based support architecture for button-phone users.
7. Incoming-call handling through a configurable telephony provider.
8. Speech-to-text integration.
9. Text-to-speech integration.
10. Verified agricultural knowledge retrieval.
11. Context-aware follow-up questions.
12. Uncertainty handling and safe escalation.
13. Human agricultural expert dashboard.
14. Case management and callback requests.
15. Farmer interaction history with appropriate privacy controls.
16. Administrator dashboard.
17. Secure authentication and role-based authorization.
18. Database persistence.
19. API validation, logging, and error handling.
20. Automated tests.
21. Security checks.
22. Production build.
23. Deployment configuration.
24. Environment-variable documentation.
25. Database setup and migration/seed procedures where applicable.
26. Comprehensive README.
27. API documentation.
28. Architecture and workflow diagrams.
29. Troubleshooting documentation.
30. A resumable implementation and testing checklist.

Do not substitute screenshots, hard-coded dashboard values, fake
AI responses, or static sample data for working functionality.

Demo data may be included, but it must be clearly identified as demo
data and must never be presented as live farmer or sensor information.

If an external provider requires credentials, implement a genuine
integration behind a documented interface. Provide a clearly labeled
mock or development adapter for local testing.

Never silently substitute a mock implementation for a required
production integration.

============================================================
3. DEVELOPMENT OPERATING RULES
============================================================

Before writing code:

1. Inspect the current working directory.
2. Inspect the repository, existing source files, configuration,
   installed dependencies, and available tooling.
3. Identify the operating system and relevant runtime versions.
4. Check whether the repository already contains useful work.
5. Preserve working code and existing user changes.
6. Do not overwrite or delete files without understanding their purpose.
7. Check for existing environment configuration without printing secrets.
8. Create a project implementation plan.
9. Identify missing credentials, unavailable services, and deployment
   decisions.
10. Record the initial repository state.

Do not expose API keys, tokens, passwords, database credentials,
telephone-provider credentials, or other secrets in logs.

Do not stop after presenting the plan. Continue implementing the project.

Use incremental development:

- Implement a coherent module.
- Run its tests.
- Fix failures.
- Verify its integration.
- Update the documentation.
- Mark the completed work in a persistent progress file.
- Continue to the next module.

Do not repeatedly rewrite working modules merely to change coding style.

Use stable, mutually compatible dependency versions. Do not blindly
install the newest major version of every dependency.

Avoid unnecessary frameworks, duplicated functionality, and premature
microservice architecture.

Use a modular monolith for the main backend unless a clearly documented
technical requirement justifies a separate service.

Do not require the user to manually create every source file.

If credentials are unavailable, implement all work that can be completed
locally and provide exact instructions for the remaining external setup.

Do not fabricate successful test results, deployment URLs, API responses,
model accuracy, or external service availability.

============================================================
4. PROPOSED SYSTEM ARCHITECTURE
============================================================

Use the following architecture as the default.

Frontend:
- Angular.
- TypeScript.
- Responsive CSS.
- Accessible components.
- Angular routing.
- Reactive forms or another consistent form strategy.
- A consistent state-management approach appropriate to the project size.

Backend:
- Node.js.
- Express.
- TypeScript.
- Modular route/controller/service/repository structure.
- Runtime request validation.
- Centralized exception handling.
- Structured logging.

Database:
- MongoDB.
- Mongoose or an equivalent established MongoDB data-access layer.
- Schema validation.
- Appropriate indexes.
- Timestamped records.
- Pagination for list endpoints.

AI:
- Gemini API as the initial conversational AI provider.
- Provider abstraction so another suitable model can be configured.
- A separate crop-disease inference interface.
- An independently testable agricultural retrieval component.

Speech:
- A configurable Tamil-capable speech-to-text provider.
- A configurable Tamil-capable text-to-speech provider.
- Evaluate supported languages and service limitations before selecting
  a concrete provider.
- Reuse Gemini audio capabilities only when they satisfy the required
  workflow and latency constraints.

Telephony:
- A configurable programmable telephony provider.
- Incoming-call webhooks.
- Secure webhook verification.
- Speech/audio handling.
- Call-session management.
- Response playback.
- Error recovery.
- Human escalation.
- Callback requests.

Agricultural knowledge:
- Verified agricultural documents.
- Source metadata.
- Document ingestion and indexing.
- Retrieval based on crop, symptoms, disease, language, and context.
- Source-aware response generation.
- A maintainable document update process.

Image AI:
- A model interface independent of the web application.
- Start with a suitable pretrained or fine-tuned vision model.
- Support image validation, preprocessing, inference, and output
  normalization.
- Provide a model version and supported-class list.
- Provide a replaceable model adapter.

Deployment:
- Frontend deployable independently.
- Backend deployable on a Node.js-compatible hosting service.
- MongoDB Atlas or another supported managed MongoDB deployment.
- AI inference hosted according to the chosen model's requirements.
- Secure HTTPS communication.
- Health checks.
- Environment-based configuration.
- Reproducible deployment instructions.

Do not force every component into one hosting provider if that provider
cannot support the required runtime.

Document all architectural decisions and their trade-offs.

============================================================
5. USER ROLES AND PERMISSIONS
============================================================

Implement the following roles.

A. FARMER

Capabilities:
- Access the public farmer interface.
- Select a preferred language.
- Upload a crop photograph.
- Enter crop and symptom details.
- Receive AI-assisted analysis.
- Ask agricultural questions.
- View guidance and relevant sources.
- Request a callback when supported.
- View their own cases when authenticated.
- Review their interaction history where appropriate.
- Request correction or deletion of their personal data subject to
  applicable retention obligations.

Farmers must not be required to register before accessing the public
telephone support service.

Do not force telephone-only users to use the web interface.

B. AGRICULTURAL EXPERT

Capabilities:
- Sign in securely.
- View assigned or authorized cases.
- Review symptoms, images, and AI analysis.
- Review the sources used by the AI.
- Add expert assessments.
- Respond to farmers.
- Update case status.
- Schedule or record callback attempts.
- Flag incorrect AI responses.

Experts must not be able to access unrelated private cases unless
their role and permissions explicitly allow it.

C. ADMINISTRATOR

Capabilities:
- Manage users and roles.
- Manage crop and disease reference data.
- Manage agricultural knowledge documents.
- Review cases and operational metrics.
- Configure language and service settings.
- View audit logs.
- Manage expert assignments.
- Review integration health.
- Manage callback workflows.

Protect all privileged operations through server-side authorization.

Never rely only on hiding buttons in the frontend.

============================================================
6. CORE FEATURE A: CROP IMAGE ANALYSIS
============================================================

Implement a complete image-analysis workflow.

Frontend:

1. Provide a crop image upload form.
2. Allow the farmer to select the crop where known.
3. Allow the farmer to select the preferred language.
4. Collect optional symptom descriptions.
5. Display upload progress.
6. Validate image type and file size.
7. Display a preview before submission.
8. Handle failed uploads clearly.
9. Display analysis status.
10. Display results with uncertainty information.
11. Display the evidence sources supporting the guidance.
12. Allow the farmer to request expert review.

Backend:

1. Authenticate the request when required.
2. Validate file type and size.
3. Validate image content rather than trusting extensions alone.
4. Generate a unique identifier.
5. Store the image safely.
6. Avoid exposing uploaded files publicly by default.
7. Invoke the configured model adapter.
8. Normalize model output.
9. Persist the case and model metadata.
10. Retrieve relevant agricultural knowledge.
11. Generate a source-grounded explanation.
12. Return a structured response.

Image storage must use a configurable storage abstraction.

Local development may use local storage. Production should use an appropriate
private object-storage service or another secure storage implementation.

Do not assume local filesystem persistence on ephemeral hosting.

AI model requirements:

- Support a documented set of crop and disease classes.
- Record model name and version.
- Record prediction scores when the model supplies them.
- Distinguish model confidence from verified diagnostic certainty.
- Do not present arbitrary confidence values.
- Handle unknown or unsupported images.
- Handle blurry, empty, corrupted, and excessively large files.
- Detect or flag images that appear outside the supported domain.
- Provide an uncertainty or abstention pathway.
- Recommend expert assessment when the prediction is unreliable.
- Never claim that the model can identify every crop disease.
- Do not invent disease classes or model metrics.

If no trained model is available initially:

1. Create the model adapter and inference contract.
2. Build a documented development adapter.
3. Clearly label development results as simulated.
4. Identify a suitable dataset and licensing constraints.
5. Implement the actual model-loading and inference pipeline.
6. Do not claim genuine image inference until the real model is installed
   and tested.

Dataset strategy:

- Evaluate appropriate public crop-disease datasets.
- Record dataset provenance and license.
- Keep training, validation, and test sets separate.
- Avoid leakage from near-duplicate images.
- Evaluate on representative field images where possible.
- Include healthy leaves and unsupported examples.
- Measure per-class precision, recall, F1 score, and confusion matrices.
- Report class imbalance.
- Do not claim general field performance from laboratory-style datasets.

Keep model training reproducible and separate from production inference.

Provide scripts or instructions for downloading permitted datasets,
preprocessing images, training or fine-tuning, evaluating, and exporting
the model.

Never include large datasets or model weights in Git unless explicitly
required and appropriate.

============================================================
7. CORE FEATURE B: AGRICULTURAL CONVERSATIONAL AI
============================================================

Use Gemini as the initial conversational AI provider.

Implement a provider abstraction with an interface similar to:

AgriculturalAIProvider:
- analyzeFarmerQuestion()
- extractCropAndSymptoms()
- generateFollowUpQuestion()
- generateGroundedGuidance()
- summarizeConversation()
- assessEscalationRequirement()

Use provider-supported structured output or validated JSON where practical.

Do not assume model output is valid JSON merely because the prompt requests it.

Validate all model outputs against a schema before processing them.

The conversational system must:

1. Understand farmer questions in the selected language.
2. Extract crop, location, symptoms, duration, severity, and other relevant
   details when available.
3. Ask focused follow-up questions when necessary.
4. Preserve context within the current support session.
5. Retrieve relevant agricultural guidance.
6. Generate concise, understandable responses.
7. Respond in the farmer's selected language.
8. Identify missing or contradictory information.
9. Avoid pretending that uncertain diagnoses are confirmed.
10. Explain when professional assessment is necessary.
11. Escalate serious or ambiguous cases.
12. Avoid unnecessary repetition.
13. Maintain a respectful, patient tone.
14. Avoid overly technical terminology.
15. Avoid unsupported medical, veterinary, or agricultural claims.

The model must not be given unrestricted authority to invent pesticide
dosages, chemical combinations, application intervals, or safety advice.

For pesticide-related questions:

- Retrieve verified, applicable source material.
- Check the crop and intended use.
- Respect relevant restrictions and label instructions.
- Do not invent quantities or mixing instructions.
- Escalate when reliable guidance cannot be retrieved.

Implement conversation history management with explicit limits on context
size and data retention.

Do not send unrelated personal information to the AI provider.

Keep API keys server-side.

Implement timeouts, retry policies, rate limits, and sensible failure
messages.

Avoid infinite retry loops.

============================================================
8. CORE FEATURE C: AGRICULTURAL KNOWLEDGE BASE
============================================================

Implement a source-grounded agricultural retrieval system.

The knowledge base must support:

- Crop information.
- Disease and pest descriptions.
- Symptoms.
- Differential diagnosis information where available.
- Preventive practices.
- Verified management guidance.
- Relevant agricultural department resources.
- Crop-specific restrictions and safety information.
- Source attribution.
- Language metadata.
- Document versioning.
- Publication or review dates where available.

Each document or passage should retain metadata such as:

- Title.
- Source organization.
- Source URL or document reference.
- Crop.
- Topic.
- Language.
- Publication date if known.
- Last reviewed date if known.
- Version.
- Trust/review status.
- Relevant limitations.

Prefer authoritative agricultural research institutions, government
agricultural departments, agricultural universities, and other reputable
domain sources.

Do not scrape sources in violation of their terms.

Do not invent citations or imply that a document has been verified when
it has not been reviewed.

Build:

1. A document ingestion script.
2. A text extraction pipeline where needed.
3. A chunking strategy.
4. A retrieval interface.
5. Metadata filtering.
6. Source-aware answer generation.
7. A source-management interface for administrators.
8. A document update workflow.
9. Tests for retrieval and source attribution.

A vector database is optional. Start with a simpler searchable database
or local index if that is sufficient. Add vector search only when it
provides a measurable benefit.

Every grounded response should retain references to the sources used.

If no suitable information is retrieved, the system should say that it
cannot confidently provide the requested guidance and offer escalation.

Do not fabricate agricultural references.

============================================================
9. CORE FEATURE D: MULTILINGUAL VOICE PIPELINE
============================================================

Tamil is the initial required language.

Create language configuration records rather than hard-coding Tamil
throughout the application.

Implement:

A. Speech-to-text adapter.
B. Text-to-speech adapter.
C. Language detection where appropriate.
D. Explicit language selection and confirmation.
E. Audio format conversion when required.
F. Audio length limits.
G. Timeout and retry behavior.
H. Recognition confidence handling when supplied.
I. Transcription correction opportunities.
J. User-friendly recovery prompts.
K. Audio output playback.
L. Provider capability validation.

Use a clear architecture:

Incoming audio
    -> Audio validation
    -> Speech recognition
    -> Transcription normalization
    -> Language/session handling
    -> Agricultural AI
    -> Knowledge retrieval
    -> Response validation
    -> Text-to-speech
    -> Audio response

Prefer streaming interaction when the selected providers and telephony
architecture support it reliably.

Do not claim real-time voice interaction if the implementation records
an entire utterance and responds only afterward.

The application must distinguish between:

- Audio transcription.
- Conversational reasoning.
- Audio generation.
- Telephone transport.

These are separate responsibilities.

Provide a text-only fallback for web users if audio services fail.

For telephone users, provide an understandable fallback message and
an expert callback option when possible.

Do not assume that all Indian languages are supported equally.

Maintain a language capability registry containing the verified
capabilities of the configured providers.

============================================================
10. CORE FEATURE E: TELEPHONE SUPPORT
============================================================

Implement a provider-independent telephone integration interface.

Choose a concrete telephony provider only after verifying:

- Incoming-call support.
- Indian number availability.
- Regulatory requirements.
- Webhook capabilities.
- Audio handling capabilities.
- Regional-language compatibility.
- Current pricing.
- Production deployment requirements.

Do not hard-code provider-specific logic into the entire application.

Required telephone functionality:

1. Receive incoming calls.
2. Verify incoming webhook authenticity.
3. Create a unique call session.
4. Identify the configured language or request a selection.
5. Play an appropriate greeting.
6. Collect the farmer's spoken question.
7. Convert speech into text.
8. Process the question through the agricultural AI workflow.
9. Retrieve verified information.
10. Generate a spoken response.
11. Play the response through the telephone service.
12. Continue the conversation where supported.
13. Handle silence and unintelligible speech.
14. Handle caller interruption where supported.
15. Handle disconnected calls.
16. Handle timeouts.
17. Handle provider failures.
18. Offer expert escalation.
19. Create callback requests.
20. Record the call outcome.
21. Release resources when the session ends.

Use a finite-state machine or an equivalently explicit state-management
approach for the telephone conversation.

Example states:

- NEW_CALL
- LANGUAGE_SELECTION
- COLLECTING_QUESTION
- PROCESSING_SPEECH
- ASKING_FOLLOW_UP
- GENERATING_RESPONSE
- PLAYING_RESPONSE
- ESCALATION_OFFERED
- CALLBACK_REQUESTED
- CALL_COMPLETED
- CALL_FAILED

Validate all state transitions.

Prevent duplicate call processing when webhook retries occur.

Use idempotency keys or equivalent safeguards where applicable.

Never expose raw provider credentials in webhook URLs or client code.

Validate webhook signatures according to the provider's documented
mechanism.

Use secure, provider-compatible audio URLs or streams.

Do not assume that every provider can stream arbitrary generated audio
directly. Implement the required format conversion and temporary audio
storage if necessary.

Temporary recordings and generated audio must have a documented
retention policy.

The service must disclose recording or processing practices as
appropriate and obtain required consent.

Human escalation:

- Allow transfer to a qualified expert where the provider supports it.
- Otherwise, create a callback request.
- Record preferred callback language and time.
- Record case priority and reason.
- Provide the farmer with a clear confirmation.
- Do not promise a callback time unless the service can meet it.

If telephone credentials are unavailable, build a development simulator
and provider adapter, but clearly distinguish simulated calls from
real telephone integration.

============================================================
11. CORE FEATURE F: HUMAN EXPERT DASHBOARD
============================================================

Create a responsive Angular dashboard for agricultural experts.

Required screens:

1. Login.
2. Dashboard overview.
3. Unassigned cases.
4. Assigned cases.
5. Case details.
6. Image review.
7. Conversation summary.
8. Agricultural source references.
9. Expert assessment form.
10. Callback management.
11. Case history.
12. Resolved cases.
13. Search and filtering.
14. Operational error indicators.
15. Profile and account settings.

Case information should include:

- Unique case identifier.
- Farmer identifier where available.
- Preferred language.
- Crop.
- Reported symptoms.
- Image references where available.
- AI analysis.
- Relevant sources.
- Escalation reason.
- Priority.
- Assigned expert.
- Case status.
- Timestamps.
- Callback details where applicable.
- Resolution notes.

Use clear status values, for example:

- NEW
- TRIAGED
- ASSIGNED
- WAITING_FOR_FARMER
- CALLBACK_PENDING
- IN_REVIEW
- RESOLVED
- CLOSED

Document and validate legal state transitions.

Implement server-side role checks for every expert operation.

Do not display sensitive farmer details unnecessarily.

Do not treat an AI-generated summary as an authoritative expert diagnosis.

============================================================
12. CORE FEATURE G: FARMER WEB APPLICATION
============================================================

Create a professional, responsive, accessible interface.

Design principles:

- Mobile-first.
- Clear visual hierarchy.
- Simple navigation.
- High contrast.
- Readable typography.
- Accessible labels.
- Keyboard navigation.
- Appropriate loading states.
- Useful empty states.
- Clear error messages.
- No unnecessary animations.
- No fake statistics.
- No decorative elements that interfere with usability.

Primary pages:

1. Landing page.
2. Language selection.
3. Crop disease analysis.
4. Upload progress.
5. Analysis result.
6. Agricultural question interface.
7. Voice-assistance interface where supported.
8. Previous cases.
9. Case detail.
10. Callback request.
11. Help and safety information.
12. Privacy information.

Provide Tamil UI translations for the initial user-facing workflow.

Use a proper translation system with language keys and dictionaries.

Do not scatter hard-coded language strings throughout components.

The farmer interface must not require farmers to understand technical
AI terminology.

Display possible diagnoses as possibilities, not guaranteed facts.

Include relevant sources and clear explanations of uncertainty.

============================================================
13. CORE FEATURE H: ADMINISTRATION
============================================================

Implement an administrator interface for:

- User and role management.
- Expert account management.
- Case monitoring.
- Agricultural document management.
- Crop and disease reference data.
- Language capability configuration.
- Provider health status.
- Model version tracking.
- Operational metrics.
- Error monitoring.
- Callback queue.
- Audit log review.

Administrative actions must be audited.

Do not permit arbitrary public access to administrative endpoints.

Protect destructive actions with suitable confirmation and authorization.

Do not allow administrators to view secrets through the UI.

============================================================
14. DATABASE DESIGN
============================================================

Design a normalized-enough document structure appropriate for MongoDB.

Define schemas and indexes for entities such as:

- Users.
- FarmerProfiles where appropriate.
- CropReferences.
- DiseaseReferences.
- SupportCases.
- CaseMessages.
- ImageAnalyses.
- ModelVersions.
- KnowledgeDocuments.
- KnowledgeChunks or equivalent search records.
- CallSessions.
- CallbackRequests.
- ExpertAssignments.
- ExpertAssessments.
- AuditLogs.
- ProviderHealthRecords where appropriate.

Avoid duplicating large image or audio blobs inside MongoDB documents.
Store files separately and retain secure references.

Use:

- Schema validation.
- Timestamps.
- Appropriate indexes.
- Pagination.
- Data retention rules.
- Safe handling of missing optional values.
- Consistent identifiers.
- Referential integrity checks where needed.

Do not store plaintext passwords.

Use a suitable password-hashing algorithm or a reputable authentication
provider.

Do not place credentials inside seed files.

Create:

- Database initialization instructions.
- Development seed data.
- Index creation procedures.
- Backup and recovery guidance.
- Data migration strategy where appropriate.

Demo data must be unmistakably marked.

============================================================
15. API DESIGN
============================================================

Create a documented REST API with consistent response structures.

Example route groups:

/api/health
/api/auth
/api/users
/api/crops
/api/diseases
/api/cases
/api/image-analysis
/api/agricultural-assistant
/api/knowledge
/api/calls
/api/callbacks
/api/experts
/api/admin
/api/audit

These are proposed route groups. Adjust them when the actual architecture
requires a more appropriate design.

For each endpoint, document:

- HTTP method.
- Route.
- Authentication requirements.
- Required role.
- Request schema.
- Response schema.
- Error responses.
- Rate limits.
- Idempotency behavior where applicable.

Implement OpenAPI documentation.

Validate request bodies, query parameters, and route parameters.

Use centralized error handling.

Return appropriate HTTP status codes.

Do not expose stack traces or sensitive provider errors to users.

Prevent mass assignment and unsafe database query construction.

Use allowlisted fields for updates.

Protect against duplicate submissions where appropriate.

============================================================
16. SECURITY AND PRIVACY
============================================================

Treat security as a required engineering component.

Implement:

1. Secure authentication.
2. Role-based authorization.
3. Password hashing or secure external authentication.
4. Rate limiting.
5. Input validation.
6. Upload validation.
7. Request-size limits.
8. CORS configuration using explicit origins.
9. Security headers.
10. Secure cookie or token handling.
11. Webhook signature verification.
12. Secret management through environment variables.
13. Audit logging.
14. Sensitive-data redaction.
15. Protection against common injection vulnerabilities.
16. Authorization checks on image and case access.
17. Safe error responses.
18. Dependency vulnerability checks.
19. Configurable data-retention policies.
20. Appropriate consent for call recording and AI processing.

Use HTTPS in production.

Do not commit .env files or secrets.

Provide a .env.example containing placeholders only.

Do not log full conversations, recordings, phone numbers, API keys,
or private image URLs unnecessarily.

Do not retain call recordings by default unless required and justified.

If recordings are stored, define access controls and a retention period.

Use signed, short-lived URLs or an authenticated proxy for private files.

Implement secure webhook handling.

Protect against replay and duplicate webhook events where possible.

Document the threat model and the remaining risks.

Do not claim that the system is legally compliant without reviewing
applicable requirements.

For deployment in India, document the need to verify applicable privacy,
telecommunications, consent, and data-retention obligations.

============================================================
17. RESPONSIBLE AGRICULTURAL GUIDANCE
============================================================

The system provides decision support, not guaranteed diagnosis.

Implement explicit safety policies.

The AI must:

- Ask follow-up questions when needed.
- Communicate uncertainty.
- Avoid invented facts.
- Prefer verified sources.
- Distinguish symptoms from confirmed disease.
- Avoid unsupported pesticide dosage recommendations.
- Never invent chemical mixing instructions.
- Respect relevant label restrictions and applicable guidance.
- Recommend qualified expert assistance for uncertain or high-risk cases.
- Avoid promising crop recovery.
- Avoid guaranteeing that a treatment will work.

When the knowledge base does not contain sufficient evidence, return
an uncertainty response and offer escalation.

Create automated tests for these behaviors.

Examples:

- The crop is unsupported.
- The image is unclear.
- Several diseases have similar symptoms.
- No trusted guidance is retrieved.
- The model response contains unsupported pesticide instructions.
- The user reports severe crop damage.
- The user asks for a chemical combination that cannot be verified.

The AI must not invent a diagnosis merely to avoid returning an
uncertain result.

============================================================
18. AI PROVIDER AND COST MANAGEMENT
============================================================

Create provider abstractions for:

- Conversational AI.
- Speech-to-text.
- Text-to-speech.
- Crop image inference.
- Telephony.

Use Gemini as the initial conversational provider.

Keep the provider-specific implementation isolated.

Implement:

- Timeouts.
- Retry limits.
- Exponential backoff where appropriate.
- Request quotas.
- Rate limiting.
- Usage logging.
- Configurable model identifiers.
- Graceful failure handling.
- Token or request limits.
- Cost estimation where provider data permits.
- Optional model fallback only when its behavior is safe and documented.

Do not retry every failure automatically.

Do not make unlimited AI calls.

Do not silently send private data to a fallback provider.

Do not claim a particular model identifier, language capability, price,
or free-tier quota without verification.

Document how to select and configure the actual supported model.

============================================================
19. TESTING STRATEGY
============================================================

Testing is mandatory.

Create a comprehensive test suite covering the application.

A. UNIT TESTS

Test:

- Request validation.
- Authentication helpers.
- Role authorization.
- Case-state transitions.
- Disease-output normalization.
- Agricultural retrieval.
- Response validation.
- Language configuration.
- Callback scheduling.
- File validation.
- Error handling.
- Provider adapters.

B. BACKEND INTEGRATION TESTS

Test:

- Database operations.
- API endpoints.
- Case creation.
- Case assignment.
- Expert assessment.
- Image-analysis persistence.
- Knowledge retrieval.
- Callback workflows.
- Authentication and authorization.
- Webhook verification.
- Duplicate webhook handling.

Use isolated test databases or controlled test fixtures.

Never run destructive tests against production data.

C. FRONTEND TESTS

Test:

- Component rendering.
- Form validation.
- Authentication guards.
- Role-based routing.
- Image upload.
- Error states.
- Loading states.
- API failure handling.
- Language selection.
- Case status updates.
- Accessible labels and keyboard interaction where applicable.

D. AI TESTS

Build a fixed evaluation set containing representative agricultural
questions and images.

Evaluate:

- Crop and symptom extraction.
- Retrieval relevance.
- Source attribution.
- Unsupported-question handling.
- Uncertainty behavior.
- Regional-language response quality.
- Dangerous recommendation avoidance.
- Model classification performance.

Do not expect exact identical outputs from a generative model.

Use structured assertions and explicit safety checks rather than relying
only on string matching.

E. TELEPHONY TESTS

Test:

- Valid incoming-call webhook.
- Invalid webhook signature.
- Language selection.
- Speech recognition failure.
- AI timeout.
- Audio generation failure.
- Call disconnection.
- Repeated webhook events.
- Callback creation.
- Expert escalation.
- Call-session cleanup.

Use a simulator for local tests.

Test real provider integration only when appropriate credentials and
test resources are available.

F. END-TO-END TESTS

Implement representative workflows:

1. Farmer uploads a crop image.
2. Image is analyzed and a case is created.
3. Farmer asks a question in Tamil.
4. AI retrieves relevant agricultural information.
5. The response is generated in Tamil.
6. An uncertain case is escalated.
7. An expert reviews the case.
8. A callback request is recorded.
9. The case is resolved.

Where real external services are unavailable, use explicit test adapters.

G. QUALITY GATES

Before deployment:

- All required automated tests must pass.
- The production frontend build must succeed.
- The backend must start successfully.
- Database connectivity must be verified.
- Security-sensitive routes must be tested.
- No known critical vulnerability may be ignored without a documented
  risk decision.
- Environment configuration must be validated.
- Deployment health checks must pass.

Report the exact commands executed and the actual outcomes.

Never fabricate coverage percentages or successful tests.

============================================================
20. FRONTEND AND BACKEND DEVELOPMENT QUALITY
============================================================

Use clean, modular, maintainable code.

Avoid:

- Giant components.
- Giant route files.
- Duplicated business logic.
- Hard-coded secrets.
- Hard-coded provider URLs.
- Fake success responses.
- Unhandled promise rejections.
- Silent exception swallowing.
- Unvalidated model outputs.
- Unsafe type assertions everywhere.
- Excessive use of any.
- Business logic embedded in UI components.
- Inconsistent API response structures.
- Unnecessary dependency proliferation.

Use consistent naming conventions.

Add meaningful comments where business logic is not obvious.

Prefer shared validation schemas when appropriate.

Implement request IDs and structured logging.

Use graceful server shutdown.

Add database connection failure handling.

Add service health reporting.

Separate readiness and liveness checks when appropriate.

Make configuration explicit.

Ensure the production build does not depend on development-only files.

============================================================
21. PERFORMANCE AND RELIABILITY
============================================================

Implement reasonable performance safeguards.

Requirements:

- Pagination for large collections.
- Database indexes for frequent queries.
- Bounded upload sizes.
- Bounded audio input.
- Request timeouts.
- Efficient image preprocessing.
- Controlled AI concurrency.
- Rate limits.
- Caching only where safe.
- Cleanup of temporary files.
- Background processing for long-running tasks when justified.
- Monitoring of slow requests.
- Avoidance of repeated identical AI calls where caching is safe.
- Graceful handling of provider outages.

Do not introduce a queueing system merely for architectural decoration.

Use background jobs when a task genuinely needs asynchronous processing,
such as document ingestion, large imports, or long-running inference.

Document known performance limits.

============================================================
22. DEPLOYMENT REQUIREMENTS
============================================================

Deployment is part of the project, not an optional final paragraph.

Create a complete deployment plan and the necessary configuration.

A. FRONTEND DEPLOYMENT

Prepare the Angular application for a supported frontend hosting service.

Requirements:

- Production build.
- Correct production API base URL.
- SPA route fallback configuration where needed.
- HTTPS.
- Environment-specific configuration.
- No exposed API secrets.
- Deployment and rollback instructions.

B. BACKEND DEPLOYMENT

Prepare the Express application for a Node.js-compatible hosting service.

Requirements:

- Production start command.
- Correct port binding.
- Health endpoint.
- Readiness endpoint if applicable.
- Graceful shutdown.
- Environment-variable validation.
- Database connection handling.
- CORS allowlist.
- HTTPS at the deployment boundary.
- Request logging.
- Secure error handling.
- Production logging.
- Resource and timeout configuration.
- Deployment verification.

Do not hard-code localhost URLs in production configuration.

C. DATABASE DEPLOYMENT

Support MongoDB Atlas or another appropriate managed deployment.

Document:

- Database creation.
- Database user creation.
- Least-privilege credentials.
- Network access restrictions.
- Connection-string configuration.
- Index creation.
- Seed procedures.
- Backup strategy.
- Recovery procedure.

Do not require broad network access without explaining the risk.

D. AI MODEL DEPLOYMENT

Document the actual model's requirements.

If the model runs locally, document its runtime and dependencies.

If the model requires a separate service, provide a clear deployment
procedure and API contract.

Do not assume a small web-hosting instance can run an arbitrarily
large model.

Do not commit large model weights to the application repository.

E. TELEPHONY DEPLOYMENT

Document:

- Provider account setup.
- Number acquisition or configuration.
- Incoming-call webhook configuration.
- Public HTTPS endpoint.
- Webhook signature verification.
- Provider credentials.
- Audio format requirements.
- Callback or transfer configuration.
- Test-call procedure.
- Expected costs and provider limitations where verified.

If a real telephone number or provider account is unavailable, clearly
mark telephony deployment as pending external setup.

Do not claim that the service can receive real calls until it has been
tested with a real provider.

F. FILE STORAGE

Configure private object storage or an appropriate production storage
provider.

Document:

- Bucket/container setup.
- Access permissions.
- Upload restrictions.
- Private file retrieval.
- Temporary-file cleanup.
- Retention rules.

Do not rely on ephemeral application storage for permanent uploads.

G. CI/CD

Create a suitable automated pipeline.

At minimum, the pipeline should:

1. Install dependencies reproducibly.
2. Run linting.
3. Run type checking.
4. Run unit tests.
5. Run relevant integration tests.
6. Build the frontend.
7. Build or validate the backend.
8. Run security checks.
9. Produce a clear success/failure status.

Deployment should occur only after required quality gates pass.

If continuous deployment is unavailable, document a reliable manual
deployment workflow.

Do not put production secrets into source-controlled workflow files.

H. POST-DEPLOYMENT VERIFICATION

Create a deployment verification checklist.

Verify:

- Frontend URL loads.
- Backend health endpoint responds.
- Database connectivity works.
- Authentication works.
- Authorized and unauthorized requests behave correctly.
- Image upload works.
- Configured AI integration works.
- Knowledge retrieval works.
- Tamil speech workflow works where configured.
- Telephone webhooks work when configured.
- Private images are not publicly exposed.
- Logs contain no secrets.
- Error handling works.
- HTTPS is active.
- SPA routing works.
- Production environment variables are correct.

Record the actual deployment URL only after a real deployment succeeds.

============================================================
23. ENVIRONMENT CONFIGURATION
============================================================

Create a comprehensive .env.example.

Include placeholders for settings such as:

NODE_ENV
PORT
MONGODB_URI
FRONTEND_ORIGIN
SESSION_SECRET or the selected authentication secrets
GEMINI_API_KEY
GEMINI_MODEL
SPEECH_TO_TEXT_PROVIDER
TEXT_TO_SPEECH_PROVIDER
TELEPHONY_PROVIDER
TELEPHONY_ACCOUNT_ID
TELEPHONY_AUTH_SECRET
TELEPHONY_PHONE_NUMBER
TELEPHONY_WEBHOOK_SECRET
OBJECT_STORAGE configuration
MODEL_SERVICE_URL
LOG_LEVEL
RATE_LIMIT configuration

Only include settings actually used by the implementation.

Do not invent provider-specific variable semantics.

Validate required settings at startup.

Distinguish development-only settings from production requirements.

Never commit a real .env file.

Do not ask the user to paste private credentials into source code.

Provide clear instructions for configuring secrets through the hosting
provider's secret-management interface.

============================================================
24. DOCUMENTATION DELIVERABLES
============================================================

Create comprehensive documentation in the repository.

Required files should include, where appropriate:

README.md
docs/ARCHITECTURE.md
docs/SETUP.md
docs/ENVIRONMENT_VARIABLES.md
docs/API.md
docs/OPENAPI.md or a generated OpenAPI specification
docs/AI_MODEL.md
docs/AGRICULTURAL_KNOWLEDGE.md
docs/VOICE_PIPELINE.md
docs/TELEPHONY.md
docs/SECURITY.md
docs/TESTING.md
docs/DEPLOYMENT.md
docs/TROUBLESHOOTING.md
docs/DATA_RETENTION.md
docs/KNOWN_LIMITATIONS.md
docs/DEMO_GUIDE.md
docs/DECISIONS.md
docs/PROJECT_STATUS.md

Include diagrams using Mermaid where useful.

Document:

- Project overview.
- Features.
- Architecture.
- Technology stack.
- Directory structure.
- Installation.
- Environment configuration.
- Database setup.
- Development commands.
- Test commands.
- Model setup.
- Dataset setup.
- Knowledge document ingestion.
- Speech provider setup.
- Telephony setup.
- Deployment.
- Troubleshooting.
- Security considerations.
- Known limitations.
- Demo workflow.
- External prerequisites.
- Actual implementation status.

Do not document planned functionality as completed functionality.

============================================================
25. GIT AND PROJECT MANAGEMENT
============================================================

Maintain a persistent implementation log.

Create:

docs/PROJECT_STATUS.md
docs/IMPLEMENTATION_LOG.md
docs/EXTERNAL_SETUP_CHECKLIST.md

The project status file must contain:

- Completed phases.
- In-progress work.
- Pending tasks.
- Failed tests.
- Known bugs.
- Missing credentials.
- External dependencies.
- Deployment status.
- Last verified commit or revision where applicable.
- Exact next actions.

Update these files after every major phase.

Do not make destructive Git operations.

Do not overwrite user changes.

Do not force-push.

Do not delete branches or reset the repository without explicit
authorization.

Do not commit secrets, uploaded farmer data, raw call recordings,
large datasets, or private model artifacts.

If Git is available, make logical commits only when appropriate and
when the repository's existing workflow permits it.

Do not claim that changes were pushed unless a real push succeeded.

============================================================
26. REQUIRED PROJECT DIRECTORY ORGANIZATION
============================================================

Adapt this structure to the repository, preserving useful existing work.

    agrosaarthi-ai/
        frontend/
            src/
            public/
            tests/
            package.json

        backend/
            src/
                config/
                middleware/
                modules/
                    auth/
                    users/
                    crops/
                    diseases/
                    cases/

> **[TRUNCATED HERE — the remainder of Section 26 and any later sections were not received.]**
