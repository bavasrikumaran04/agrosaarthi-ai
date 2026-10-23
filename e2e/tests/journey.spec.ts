import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Full user journey through the real browser UI, backend, MongoDB and model service:
 * farmer registers -> uploads a crop photo -> sees the model result -> requests a call back;
 * admin creates an expert; expert takes, assesses and resolves the case; farmer sees the answer.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@agrosaarthi.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin-E2E-pass-2026';
const run = Date.now().toString().slice(-7);
const farmerPhone = `98${run}${Math.floor(Math.random() * 10)}`.slice(0, 10);
const farmerPassword = 'paddy-field-2026';
const expertEmail = `expert${run}@agrosaarthi.local`;
const expertPassword = 'expert-field-2026';

async function leafPhoto(): Promise<Buffer> {
  // Synthetic green "leaf" image with texture (test input only).
  const w = 480;
  const h = 360;
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3;
    const c = ((x >> 3) + (y >> 3)) % 2 ? 20 : -20;
    px[o] = 40 + c; px[o + 1] = 150 + c; px[o + 2] = 50 + c;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/Mobile number or email/).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Sign-in applies the user's saved language (Tamil for most accounts); these tests read English labels.
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Sign in');
  await page.getByRole('button', { name: 'English' }).click();
}

async function signOut(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click(); // only shown on narrow screens
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
}

test.describe.serial('AgroSaarthi user journey', () => {
  let caseNumber = '';

  test('home page is Tamil by default and switches to English', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('உங்கள் பயிருக்கு');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Is your crop sick? We can help.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('crop information pages load from the database', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto('/crops/tomato');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tomato');
    await expect(page.getByText('Tomato early blight')).toBeVisible();
  });

  test('farmer registers, uploads a photo and gets a real model-service result', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto('/register');
    await page.getByLabel('Your name').fill('E2E Farmer');
    await page.getByLabel('Mobile number').fill(farmerPhone);
    await page.getByLabel('Password', { exact: true }).fill(farmerPassword);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This is required.').first()).toBeVisible(); // consents missing
    await page.getByLabel(/read the privacy notice/).check();
    await page.getByLabel(/processed by computer programs/).check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello, E2E Farmer');

    await page.getByRole('link', { name: 'Check my crop' }).first().click();
    await page.locator('#photo').setInputFiles({ name: 'leaf.jpg', mimeType: 'image/jpeg', buffer: await leafPhoto() });
    await expect(page.getByAltText('Photo preview')).toBeVisible();
    await page.getByLabel('Which crop is it?').selectOption('tomato');
    await page.getByLabel(/What do you see/).fill('Brown spots on lower leaves for a week');
    await page.getByRole('button', { name: 'Check the photo' }).click();

    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 30_000 });
    // The local stack runs the labelled TEST FIXTURE model through the real HTTP integration.
    await expect(page.getByText(/Checked by: TEST FIXTURE/)).toBeVisible();
    const number = await page.getByText(/Request number:/).textContent();
    caseNumber = number!.replace(/.*Request number:\s*/, '').trim();
    expect(caseNumber).toMatch(/^AGS-\d{4}-\d{6}$/);

    await page.getByRole('link', { name: 'Open this request' }).click();
    await page.getByLabel('Morning').check();
    await page.getByRole('button', { name: /Request call back/ }).click();
    await expect(page.getByText(/will try to call you\. We cannot promise an exact time/).first()).toBeVisible();
  });

  test('farmer cannot open the admin area', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await signIn(page, farmerPhone, farmerPassword);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello');
    await page.goto('/admin');
    // Full reload drops the in-memory token; the session is restored from the refresh cookie, then the guard redirects.
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('admin creates an expert account', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/(account\/password|admin)$/);
    if (page.url().includes('/account/password')) {
      // First sign-in of the bootstrap admin: the one-time password must be replaced.
      await page.getByLabel('Current password').fill(ADMIN_PASSWORD);
      await page.getByLabel('New password').fill(`${ADMIN_PASSWORD}-${run}`);
      await page.getByRole('button', { name: 'Change password' }).click();
      console.log(`Admin password changed to: ${ADMIN_PASSWORD}-${run} (local E2E account)`);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Administration');
    await expect(page.getByText('Open call backs')).toBeVisible();
    await page.getByRole('tab', { name: 'Users' }).click();
    await page.getByLabel('Your name').fill('E2E Expert');
    await page.getByLabel('Email').fill(expertEmail);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    const notice = await page.getByText(/One-time password for/).textContent();
    const temp = notice!.match(/: (\S+) —/)![1]!;

    await signOut(page);
    await signIn(page, expertEmail, temp);
    await expect(page).toHaveURL(/account\/password/);
    await page.getByLabel('Current password').fill(temp);
    await page.getByLabel('New password').fill(expertPassword);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Expert desk');
  });

  test('expert takes, assesses and resolves the case; farmer sees the answer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await signIn(page, expertEmail, expertPassword);
    await page.getByRole('tab', { name: 'Unassigned' }).click();
    await page.getByRole('link', { name: caseNumber }).click();
    await expect(page.getByText(/Triage view/)).toBeVisible();
    await page.getByRole('button', { name: 'Take this case' }).click();
    await expect(page.getByRole('heading', { name: 'Your assessment' })).toBeVisible();
    await expect(page.getByText(/\*{6}\d{4}/)).toBeVisible();

    await page.getByLabel('Diagnosis').fill('Possible early blight — needs a closer photo');
    await page.getByLabel('Recommendations').fill('Remove badly affected lower leaves. Ask the local agricultural officer before any spray.');
    await page.getByLabel('Do you agree with the computer?').selectOption('NOT_APPLICABLE');
    await page.getByRole('button', { name: 'Save assessment' }).click();
    await expect(page.getByText('Possible early blight — needs a closer photo').first()).toBeVisible();

    await page.getByLabel('Change status', { exact: true }).selectOption('RESOLVED');
    await page.getByLabel('Note', { exact: true }).fill('Advice given');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('RESOLVED');

    await signOut(page);
    await signIn(page, farmerPhone, farmerPassword);
    await page.goto('/cases');
    await page.getByText(caseNumber).click();
    await expect(page.getByText('Answered')).toBeVisible();
    await expect(page.getByText('Possible early blight — needs a closer photo')).toBeVisible();
    await page.getByRole('button', { name: 'தமிழ்' }).click();
    await expect(page.getByText('பதில் அளிக்கப்பட்டது')).toBeVisible();
  });

  test('phone-line simulator: guest walkthrough saves nothing; signed-in farmer creates a real request', async ({ page }) => {
    const callThrough = async () => {
      await page.getByRole('button', { name: 'Call', exact: true }).click();
      for (const k of ['2', '1', '2']) await page.getByRole('button', { name: `Key ${k}`, exact: true }).click(); // English, report problem, tomato
      await page.getByLabel(/Or type what the caller says/).fill('Yellow patches on tomato leaves since last week');
      await page.getByRole('button', { name: 'Use this text' }).click();
      await page.getByRole('button', { name: 'Key 1', exact: true }).click(); // send to expert
      await page.getByRole('button', { name: 'Key 1', exact: true }).click(); // morning
    };
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto('/phone-demo');
    await expect(page.getByText(/SIMULATOR/)).toBeVisible();
    await callThrough();
    await expect(page.getByText(/This is a demonstration only/).first()).toBeVisible();

    await signIn(page, farmerPhone, farmerPassword);
    await page.goto('/phone-demo');
    await callThrough();
    await expect(page.getByText(/Your request is registered\. Request number AGS-/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Open the saved request' }).click();
    await expect(page.getByText(/\[Phone line simulator\] Yellow patches/)).toBeVisible();
    await expect(page.getByText(/will try to call you/).first()).toBeVisible();
  });
});
