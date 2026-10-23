import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestApplication, type TestApplication } from '../test/helpers/app.js';
import { useTestDatabase } from '../test/helpers/db.js';
import { createUser, type CreatedUser } from '../test/helpers/factories.js';
import { AuditLogModel } from './db/models/audit-log.model.js';
import { CropModel } from './db/models/crop.model.js';
import type { CropDiseaseModel, ModelResult } from './providers/image-model/image-model.js';
import { PRIVACY_NOTICE_VERSION } from './shared/language-registry.js';

useTestDatabase();

/** TEST FIXTURE model: returns a fixed, clearly fake result so the workflow can be asserted. */
function fixtureModel(overrides: Partial<ModelResult> = {}): CropDiseaseModel & { calls: number } {
  const m = {
    name: 'test-fixture',
    simulated: false,
    calls: 0,
    async predict() {
      m.calls += 1;
      return {
        provider: 'test-fixture',
        model: { name: 'fixture-model', version: '1.0.0' },
        simulated: false,
        predictions: [
          { classKey: 'Tomato___Early_blight', label: 'Tomato — early blight', score: 0.91 },
          { classKey: 'Tomato___Septoria_leaf_spot', label: 'Tomato — Septoria leaf spot', score: 0.05 },
        ],
        uncertainty: { maxProbability: 0.91, margin: 0.86, abstain: false, reasons: [] },
        outOfDomain: { flagged: false, score: 1.2, threshold: 10, method: 'mahalanobis' },
        quality: { ok: true, issues: [], metrics: {} },
        inferenceMs: 5,
        ...overrides,
      } satisfies ModelResult;
    },
    async modelCard() {
      return { name: 'fixture-model', version: '1.0.0' };
    },
    async health() {
      return { ok: true };
    },
  };
  return m;
}

async function leafJpeg(width = 400, height = 300, seed = 0): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 40 + seed, g: 150, b: 50 } } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'gps-test' } } })
    .toBuffer();
}

let t: TestApplication;
let model: ReturnType<typeof fixtureModel>;
let farmer: CreatedUser;
let otherFarmer: CreatedUser;
let expert: CreatedUser;
let expert2: CreatedUser;
let admin: CreatedUser;

beforeAll(async () => {
  model = fixtureModel();
  const storageDir = mkdtempSync(join(tmpdir(), 'agro-storage-'));
  t = await createTestApplication({ LOCAL_STORAGE_DIR: storageDir, PUBLIC_BASE_URL: 'http://127.0.0.1:4000' }, {}, { imageModel: model });
  farmer = await createUser(t.core, { role: 'FARMER' });
  otherFarmer = await createUser(t.core, { role: 'FARMER' });
  expert = await createUser(t.core, { role: 'EXPERT' });
  expert2 = await createUser(t.core, { role: 'EXPERT' });
  admin = await createUser(t.core, { role: 'ADMIN' });
});

describe('reference data', () => {
  it('seeds crops and diseases once (idempotent) and localises names', async () => {
    const before = await CropModel.countDocuments();
    await t.services.reference.ensureSeeded();
    expect(await CropModel.countDocuments()).toBe(before);
    const crops = await t.http().get('/api/v1/crops?language=ta');
    expect(crops.status).toBe(200);
    const tomato = crops.body.data.find((c: { key: string }) => c.key === 'tomato');
    expect(tomato.name).toBe('தக்காளி');
    expect(tomato.supportedByModel).toBe(true);
    expect(crops.body.data.find((c: { key: string }) => c.key === 'rice').supportedByModel).toBe(false);
    const detail = await t.http().get('/api/v1/crops/tomato?language=en');
    expect(detail.body.data.diseases.length).toBe(10);
    expect((await t.http().get('/api/v1/crops/not_a_crop')).status).toBe(404);
  });

  it('never overwrites an administrator edit when re-seeding', async () => {
    const patch = await t.http().patch('/api/v1/crops/rice').set('Authorization', admin.authorization).send({ names: { ta: 'நெல் (திருத்தம்)' } });
    expect(patch.status).toBe(200);
    await t.services.reference.ensureSeeded();
    const rice = await t.http().get('/api/v1/crops/rice?language=ta');
    expect(rice.body.data.name).toBe('நெல் (திருத்தம்)');
    expect((await t.http().patch('/api/v1/crops/rice').set('Authorization', farmer.authorization).send({ active: false })).status).toBe(403);
  });
});

describe('crop image analysis journey', () => {
  let analysisId: string;
  let caseId: string;

  it('analyses an uploaded photo with the configured model and creates a case', async () => {
    const res = await t.http()
      .post('/api/v1/image-analysis')
      .set('Authorization', farmer.authorization)
      .field('language', 'ta')
      .field('cropKey', 'tomato')
      .field('symptomsText', 'brown rings on lower leaves')
      .attach('image', await leafJpeg(), { filename: 'leaf.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    const a = res.body.data;
    expect(a.outcome).toBe('LIKELY_MATCH');
    expect(a.simulated).toBe(false);
    expect(a.predictions[0]).toMatchObject({ classKey: 'Tomato___Early_blight', diseaseKey: 'tomato_early_blight', cropKey: 'tomato' });
    expect(a.caseNumber).toMatch(/^AGS-\d{4}-\d{6}$/);
    expect(model.calls).toBe(1);
    analysisId = a.id;
    caseId = a.caseId;
  });

  it('strips image metadata and serves the photo only through a short-lived signed URL', async () => {
    const urlRes = await t.http().get(`/api/v1/image-analysis/${analysisId}/image-url`).set('Authorization', farmer.authorization);
    expect(urlRes.status).toBe(200);
    const path = new URL(urlRes.body.data.url).pathname;
    const img = await t.http().get(path);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/jpeg');
    const meta = await sharp(img.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect((await t.http().get(path.replace(/.$/, 'x'))).status).toBe(404);
    expect((await t.http().get(`/api/v1/image-analysis/${analysisId}/image-url`).set('Authorization', otherFarmer.authorization)).status).toBe(404);
  });

  it('returns the earlier result for a duplicate submission instead of re-running the model', async () => {
    const res = await t.http()
      .post('/api/v1/image-analysis')
      .set('Authorization', farmer.authorization)
      .field('language', 'ta')
      .field('cropKey', 'tomato')
      .attach('image', await leafJpeg(), 'leaf.jpg');
    expect(res.body.data.id).toBe(analysisId);
    expect(model.calls).toBe(1);
  });

  it('rejects non-images, tiny photos and unauthenticated uploads', async () => {
    const fake = await t.http().post('/api/v1/image-analysis').set('Authorization', farmer.authorization).field('language', 'ta').attach('image', Buffer.from('not an image'), 'x.jpg');
    expect(fake.status).toBe(415);
    const tiny = await t.http().post('/api/v1/image-analysis').set('Authorization', farmer.authorization).field('language', 'ta').attach('image', await leafJpeg(40, 40), 'x.jpg');
    expect(tiny.status).toBe(422);
    expect((await t.http().post('/api/v1/image-analysis').field('language', 'ta').attach('image', await leafJpeg(), 'x.jpg')).status).toBe(401);
  });

  it('reports unsupported crops and uncertain results without claiming a match, and escalates them', async () => {
    const res = await t.http()
      .post('/api/v1/image-analysis')
      .set('Authorization', farmer.authorization)
      .field('language', 'en')
      .field('cropKey', 'rice')
      .attach('image', await leafJpeg(400, 300, 30), 'rice.jpg');
    expect(res.body.data.outcome).toBe('UNSUPPORTED_CROP');
    expect(res.body.data.escalationRecommended).toBe(true);
    const c = await t.http().get(`/api/v1/cases/${res.body.data.caseId}`).set('Authorization', farmer.authorization);
    expect(c.body.data.escalation.required).toBe(true);
  });

  it('responds 503 SERVICE_NOT_CONFIGURED when no model is configured (no fake result)', async () => {
    const noModel = await createTestApplication({}, {}, { imageModel: null });
    const f = await createUser(noModel.core, { role: 'FARMER' });
    const res = await noModel.http().post('/api/v1/image-analysis').set('Authorization', f.authorization).field('language', 'ta').attach('image', await leafJpeg(), 'x.jpg');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_NOT_CONFIGURED');
  });

  it('marks the case FAILED-analysis and escalates when the model errors', async () => {
    const broken = await createTestApplication({}, {}, {
      imageModel: { ...fixtureModel(), predict: async () => { throw new Error('boom'); } },
    });
    const f = await createUser(broken.core, { role: 'FARMER' });
    const res = await broken.http().post('/api/v1/image-analysis').set('Authorization', f.authorization).field('language', 'ta').attach('image', await leafJpeg(), 'x.jpg');
    expect(res.status).toBe(500);
    const cases = await broken.http().get('/api/v1/cases').set('Authorization', f.authorization);
    expect(cases.body.data[0].escalated).toBe(true);
  });

  describe('expert workflow on that case', () => {
    it('farmer sees own case; another farmer gets 404 and the denial is audited', async () => {
      const mine = await t.http().get('/api/v1/cases').set('Authorization', farmer.authorization);
      expect(mine.body.data.some((c: { id: string }) => c.id === caseId)).toBe(true);
      const theirs = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', otherFarmer.authorization);
      expect(theirs.status).toBe(404);
      expect(await AuditLogModel.exists({ action: 'authz.denied', targetId: caseId })).not.toBeNull();
      const others = await t.http().get('/api/v1/cases').set('Authorization', otherFarmer.authorization);
      expect(others.body.data.some((c: { id: string }) => c.id === caseId)).toBe(false);
    });

    it('an unassigned expert gets only the triage view (no farmer identity)', async () => {
      const queue = await t.http().get('/api/v1/cases?scope=unassigned').set('Authorization', expert.authorization);
      expect(queue.body.data.some((c: { id: string }) => c.id === caseId)).toBe(true);
      const view = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', expert.authorization);
      expect(view.body.data.view).toBe('TRIAGE');
      expect(view.body.data.farmer).toBeUndefined();
      expect(view.body.data.messages).toEqual([]);
      const assess = await t.http().post(`/api/v1/cases/${caseId}/assessments`).set('Authorization', expert.authorization).send({ diagnosis: 'x', certainty: 'PROBABLE', aiAgreement: 'AGREES' });
      expect(assess.status).toBe(404);
    });

    it('two experts race to take the case: exactly one wins', async () => {
      const [a, b] = await Promise.all([
        t.http().post(`/api/v1/cases/${caseId}/assign`).set('Authorization', expert.authorization).send({ expertId: expert.id }),
        t.http().post(`/api/v1/cases/${caseId}/assign`).set('Authorization', expert2.authorization).send({ expertId: expert2.id }),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it('the assigned expert assesses, messages and resolves; invalid transitions are refused', async () => {
      const c = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', farmer.authorization);
      const winner = c.body.data.assignedExpert.id === expert.id ? expert : expert2;
      const loser = winner === expert ? expert2 : expert;
      expect((await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', loser.authorization)).status).toBe(404);

      const detail = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', winner.authorization);
      expect(detail.body.data.view).toBe('FULL');
      expect(detail.body.data.farmer.phoneMasked).toMatch(/^\*{6}\d{4}$/);

      const bad = await t.http().post(`/api/v1/cases/${caseId}/status`).set('Authorization', winner.authorization).send({ to: 'RESOLVED', note: 'x' });
      expect(bad.status).toBe(409);
      expect(bad.body.error.code).toBe('INVALID_STATE_TRANSITION');

      const assess = await t.http().post(`/api/v1/cases/${caseId}/assessments`).set('Authorization', winner.authorization).send({
        diagnosis: 'Early blight is likely',
        certainty: 'PROBABLE',
        recommendations: 'Remove affected lower leaves; consult local officer before any spray.',
        aiAgreement: 'AGREES',
      });
      expect(assess.status).toBe(201);

      expect((await t.http().post(`/api/v1/cases/${caseId}/messages`).set('Authorization', winner.authorization).send({ text: 'Internal note', internal: true })).status).toBe(204);
      expect((await t.http().post(`/api/v1/cases/${caseId}/messages`).set('Authorization', winner.authorization).send({ text: 'Please send a closer photo' })).status).toBe(204);
      expect((await t.http().post(`/api/v1/cases/${caseId}/messages`).set('Authorization', farmer.authorization).send({ text: 'x', internal: true })).status).toBe(403);

      const farmerView = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', farmer.authorization);
      expect(farmerView.body.data.messages.map((m: { text: string }) => m.text)).toEqual(['Please send a closer photo']);
      expect(farmerView.body.data.assessments[0].diagnosis).toBe('Early blight is likely');

      const noNote = await t.http().post(`/api/v1/cases/${caseId}/status`).set('Authorization', winner.authorization).send({ to: 'RESOLVED' });
      expect(noNote.status).toBe(400);

      const cb = await t.http().post(`/api/v1/cases/${caseId}/callback`).set('Authorization', farmer.authorization).send({ preferredTimeWindow: 'MORNING' });
      expect(cb.status).toBe(201);
      expect(cb.body.data.message).toContain('cannot be guaranteed');
      const again = await t.http().post(`/api/v1/cases/${caseId}/callback`).set('Authorization', farmer.authorization).send({});
      expect(again.status).toBe(200);
      expect(again.body.data.id).toBe(cb.body.data.id);

      const reveal = await t.http().post(`/api/v1/cases/${caseId}/reveal-contact`).set('Authorization', winner.authorization);
      expect(reveal.status).toBe(200);
      expect(reveal.body.data.phone).toBe(`+91${farmer.phone}`);
      expect(await AuditLogModel.exists({ action: 'case.contact_reveal', targetId: caseId })).not.toBeNull();

      for (let i = 0; i < 3; i += 1) {
        await t.http().post(`/api/v1/cases/callbacks/${cb.body.data.id}/attempts`).set('Authorization', winner.authorization).send({ outcome: 'NO_ANSWER' });
      }
      const afterAttempts = await t.http().get(`/api/v1/cases/${caseId}`).set('Authorization', winner.authorization);
      expect(afterAttempts.body.data.callbacks[0]).toMatchObject({ status: 'FAILED', attempts: 3 });

      const toReview = await t.http().post(`/api/v1/cases/${caseId}/status`).set('Authorization', winner.authorization).send({ to: 'IN_REVIEW' });
      expect(toReview.status).toBe(200);
      const resolved = await t.http().post(`/api/v1/cases/${caseId}/status`).set('Authorization', winner.authorization).send({ to: 'RESOLVED', note: 'Advice given' });
      expect(resolved.body.data.status).toBe('RESOLVED');

      const dash = await t.http().get('/api/v1/cases/dashboard').set('Authorization', winner.authorization);
      expect(dash.body.data.resolvedLast7Days).toBe(1);
      expect((await t.http().get('/api/v1/cases/dashboard').set('Authorization', farmer.authorization)).status).toBe(403);
    });
  });
});

describe('farmer manual case + registration journey', () => {
  it('registers through the API and asks an expert without a photo', async () => {
    const reg = await t.http().post('/api/v1/auth/register').send({
      name: 'Kavitha',
      phone: '9123456780',
      password: 'banana-field-77',
      preferredLanguage: 'ta',
      consent: { acceptPrivacyNotice: true, aiProcessing: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION },
    });
    expect(reg.status).toBe(201);
    const token = `Bearer ${reg.body.data.accessToken}`;
    const created = await t.http().post('/api/v1/cases').set('Authorization', token).send({ language: 'ta', cropKey: 'banana', symptomsText: 'இலைகள் மஞ்சளாக மாறுகின்றன' });
    expect(created.status).toBe(201);
    const list = await t.http().get('/api/v1/cases').set('Authorization', token);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ origin: 'MANUAL', escalated: true });
    expect((await t.http().post('/api/v1/cases').set('Authorization', token).send({ language: 'xx', symptomsText: 'a' })).status).toBe(400);
  });
});

describe('administration', () => {
  it('admin creates an expert with a one-time password that must be changed', async () => {
    const res = await t.http().post('/api/v1/admin/users').set('Authorization', admin.authorization).send({ name: 'Dr. Expert', email: 'dr.expert@example.test', role: 'EXPERT' });
    expect(res.status).toBe(201);
    expect(res.body.data.temporaryPassword).toEqual(expect.any(String));
    const login = await t.http().post('/api/v1/auth/login').send({ identifier: 'dr.expert@example.test', password: res.body.data.temporaryPassword });
    expect(login.body.data.user.mustChangePassword).toBe(true);
    expect(await AuditLogModel.exists({ action: 'user.create' })).not.toBeNull();
    expect((await t.http().post('/api/v1/admin/users').set('Authorization', expert.authorization).send({ name: 'x', email: 'x@example.test', role: 'ADMIN' })).status).toBe(403);
  });

  it('metrics come from real data; providers are reported without secrets', async () => {
    const m = await t.http().get('/api/v1/admin/metrics').set('Authorization', admin.authorization);
    expect(m.status).toBe(200);
    expect(m.body.data.analysesByOutcome.LIKELY_MATCH).toBeGreaterThanOrEqual(1);
    const p = await t.http().get('/api/v1/admin/providers').set('Authorization', admin.authorization);
    expect(p.body.data.checks.storage.ok).toBe(true);
    expect(JSON.stringify(p.body)).not.toMatch(/secret|password/i);
    expect((await t.http().get('/api/v1/admin/metrics').set('Authorization', farmer.authorization)).status).toBe(403);
    const audit = await t.http().get('/api/v1/admin/audit?action=case.assign').set('Authorization', admin.authorization);
    expect(audit.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('admin disables a user and their token stops working immediately', async () => {
    const victim = await createUser(t.core, { role: 'EXPERT' });
    const res = await t.http().patch(`/api/v1/admin/users/${victim.id}`).set('Authorization', admin.authorization).send({ status: 'DISABLED' });
    expect(res.status).toBe(200);
    expect((await t.http().get('/api/v1/auth/me').set('Authorization', victim.authorization)).status).toBe(401);
  });

  it('public languages endpoint lists enabled languages', async () => {
    const res = await t.http().get('/api/v1/languages');
    expect(res.body.data.map((l: { code: string }) => l.code).sort()).toEqual(['en', 'ta']);
  });
});
