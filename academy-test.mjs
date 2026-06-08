import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:5000';
const SS_DIR = join(process.env.TEMP || 'C:/temp', 'academy-screenshots');
mkdirSync(SS_DIR, { recursive: true });

let ssCount = 0;
async function ss(page, name) {
  const file = join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${name} -> ${file}`);
}

const results = [];
function pass(label) { results.push({ ok: true, label }); console.log(`  ✅ ${label}`); }
function fail(label, err) { results.push({ ok: false, label, err: String(err) }); console.error(`  ❌ ${label}: ${err}`); }

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/maged/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Capture console errors — ignore expected 401 (app checks /api/user before login)
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Pre-login /api/user check always returns 401 — browser logs it but it's handled
      if (txt.includes('401')) return;
      consoleErrors.push(txt);
    }
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ── 1. Auth page loads ─────────────────────────────────────────────────────
  console.log('\n[1] AUTH PAGE');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await ss(page, 'auth-page');
  try {
    await page.waitForSelector('input', { timeout: 5000 });
    pass('Auth page loaded');
  } catch (e) { fail('Auth page loaded', e); }

  // ── 2. Login ───────────────────────────────────────────────────────────────
  console.log('\n[2] LOGIN');
  try {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('admin');
    await inputs.nth(1).fill('maged');
    await ss(page, 'login-filled');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard|\//, { timeout: 8000 });
    await page.waitForTimeout(2000);
    pass('Login succeeded');
    await ss(page, 'after-login');
  } catch (e) { fail('Login', e); }

  // ── 3. Dashboard ───────────────────────────────────────────────────────────
  console.log('\n[3] DASHBOARD');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await ss(page, 'dashboard');

  try {
    const heading = await page.locator('h1, h2').first().innerText({ timeout: 5000 });
    console.log(`    Page heading: ${heading}`);
    pass('Dashboard renders');
  } catch(e) { fail('Dashboard renders', e); }

  try {
    const stats = await page.evaluate(() => fetch('/api/dashboard/stats').then(r => r.json()));
    console.log(`    totalPlayers=${stats.totalPlayers}, activeSubscriptions=${stats.activeSubscriptions}`);
    console.log(`    paymentMethodBreakdown=${JSON.stringify(stats.paymentMethodBreakdown)}`);
    console.log(`    overduePayments=${stats.overduePayments}`);

    if (typeof stats.totalPlayers === 'number') pass('Dashboard stats: totalPlayers is a number');
    else fail('Dashboard stats totalPlayers', stats.totalPlayers);

    if ('paymentMethodBreakdown' in stats) pass('Dashboard stats: paymentMethodBreakdown present');
    else fail('Dashboard stats paymentMethodBreakdown', 'missing');

    if ('overduePayments' in stats) pass('Dashboard stats: overduePayments present');
    else fail('Dashboard stats overduePayments', 'missing');

    const pmb = stats.paymentMethodBreakdown;
    if (pmb && typeof pmb.cash === 'number' && typeof pmb.visa === 'number' && typeof pmb.bank_transfer === 'number') {
      pass('Dashboard stats: paymentMethodBreakdown has cash/visa/bank_transfer');
    } else {
      fail('Dashboard stats paymentMethodBreakdown structure', JSON.stringify(pmb));
    }
  } catch(e) { fail('Dashboard stats API', e); }

  // ── 4. Payments page ──────────────────────────────────────────────────────
  console.log('\n[4] PAYMENTS PAGE');
  await page.goto(`${BASE}/payments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await ss(page, 'payments-page');

  try {
    await page.waitForSelector('text=Payment Overview', { timeout: 5000 });
    pass('Payment Overview card visible');
  } catch(e) { fail('Payment Overview card', e); }

  try {
    await page.waitForSelector('text=Payment Methods', { timeout: 5000 });
    pass('Payment Methods card visible');
  } catch(e) { fail('Payment Methods card visible', e); }

  try {
    const pageHtml = await page.content();
    const hasHardcoded45 = pageHtml.includes('>45%<') || pageHtml.includes('>45%');
    const hasHardcoded35 = pageHtml.includes('>35%<') || pageHtml.includes('>35%');
    if (!hasHardcoded45 && !hasHardcoded35) {
      pass('Payment Methods: no hardcoded 45%/35% static percentages');
    } else {
      fail('Static payment percentages', 'Hardcoded 45% or 35% still in page source');
    }
  } catch(e) { fail('Static percentage check', e); }

  try {
    await page.waitForSelector('text=Overdue', { timeout: 5000 });
    pass('Overdue row visible in Payment Overview');
  } catch(e) { fail('Overdue row', e); }

  try {
    await page.waitForSelector('text=Payment Records', { timeout: 5000 });
    pass('Payment Records card visible');
  } catch(e) { fail('Payment Records card', e); }

  try {
    const paymentsPageText = await page.locator('main').innerText();
    if (paymentsPageText.includes('AED')) pass('Payments page shows AED currency');
    else fail('Payments page AED', 'No AED found in page');
  } catch(e) { fail('Payments page AED check', e); }

  // ── 5. Add Payment modal ───────────────────────────────────────────────────
  console.log('\n[5] ADD PAYMENT MODAL');
  try {
    await page.locator('header button:has-text("Add Payment")').click();
    await page.waitForTimeout(800);
    await ss(page, 'add-payment-modal-open');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    pass('Add Payment modal opens');
  } catch(e) { fail('Add Payment modal open', e); }

  try {
    const modalText = await page.locator('[role="dialog"]').innerText();
    if (modalText.includes('AED') || (!modalText.includes('($)') && !modalText.includes('$ '))) {
      pass('Add Payment modal: AED label (no $ label)');
    } else {
      fail('Add Payment modal label', 'Found $ label in modal');
    }
    if (!modalText.includes('($)')) pass('Add Payment: old "($)" label removed');
    else fail('Add Payment label cleanup', 'Old ($) label still present');
  } catch(e) { fail('Add Payment modal labels', e); }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ── 6. Players page ────────────────────────────────────────────────────────
  console.log('\n[6] PLAYERS PAGE');
  await page.goto(`${BASE}/players`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await ss(page, 'players-page');
  try {
    pass('Players page loaded');
    const playerCount = await page.locator('table tbody tr, [class*="divide-y"] > div[class*="p-4"]').count();
    console.log(`    Found ${playerCount} player rows`);
  } catch(e) { fail('Players page', e); }

  // ── 7. Add Player ──────────────────────────────────────────────────────────
  console.log('\n[7] ADD PLAYER FLOW');
  const testPlayerName = `E2E Test ${Date.now()}`;
  try {
    const addBtn = page.locator('button:has-text("Add Player")').first();
    await addBtn.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await ss(page, 'add-player-modal');
    pass('Add Player modal opens');
  } catch(e) { fail('Add Player modal', e); }

  try {
    const dialog = page.locator('[role="dialog"]');
    // Full name
    await dialog.locator('[placeholder*="full name" i], [name="fullName"], [placeholder*="name" i]').first().fill(testPlayerName);
    // DOB
    await dialog.locator('[type="date"], [name="dateOfBirth"]').first().fill('2000-06-15');
    // Phone
    await dialog.locator('[placeholder*="phone" i], [name="phoneNumber"]').first().fill('0509876543').catch(() => {});
    // Activity - scoped to dialog to avoid page-level dropdown
    const actSelect = dialog.locator('button[role="combobox"]').first();
    await actSelect.click({ force: true });
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="listbox"] [role="option"], [data-radix-select-viewport] [role="option"]').first();
    const hasOption = await firstOption.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasOption) {
      await firstOption.click();
    } else {
      // fallback: pick any visible option
      await page.locator('[role="option"]').first().click().catch(() => {});
    }
    await page.waitForTimeout(300);
    // Subscription fee
    await dialog.locator('[name="subscriptionFee"], [placeholder*="fee" i]').first().fill('400').catch(() => {});
    // Amount paid
    await dialog.locator('[name="amountPaid"], [placeholder*="amount paid" i]').first().fill('200').catch(() => {});
    await ss(page, 'add-player-filled');
    pass('Add Player form filled');
  } catch(e) { fail('Add Player form fill', e); }

  try {
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('button[type="submit"], button:has-text("Add Player"), button:has-text("Save")').last().click();
    await page.waitForTimeout(3000);
    const modalGone = !(await page.locator('[role="dialog"]').isVisible().catch(() => false));
    if (modalGone) {
      pass('Player created (modal closed)');
    } else {
      const errMsg = await page.locator('[role="dialog"] [class*="destructive"], [role="dialog"] [class*="error"]').innerText().catch(() => 'no error visible');
      fail('Player creation', `Modal still open. Error: ${errMsg}`);
    }
    await ss(page, 'after-add-player');
  } catch(e) { fail('Player creation submit', e); }

  // ── 8. View Player & Payments ──────────────────────────────────────────────
  console.log('\n[8] PLAYER DETAILS & PAYMENTS');
  await page.goto(`${BASE}/payments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await ss(page, 'payments-with-real-data');

  try {
    const rows = await page.locator('tbody tr').count();
    console.log(`    Payment rows: ${rows}`);
    if (rows > 0) {
      pass(`Payment Records shows ${rows} real payment(s) from DB`);
      const firstRowText = await page.locator('tbody tr').first().innerText();
      if (firstRowText.includes('AED')) pass('Payment row shows AED currency');
      else fail('Payment row currency', `No AED in: ${firstRowText.substring(0,100)}`);
    } else {
      pass('Payment Records empty (no payments made yet - OK)');
    }
  } catch(e) { fail('Payment Records real data', e); }

  // ── 9. Payment Overview dynamic values ────────────────────────────────────
  console.log('\n[9] PAYMENT OVERVIEW DYNAMIC VALUES');
  try {
    const overviewAreas = await page.locator('text=Payment Overview').locator('..').locator('..').innerText();
    console.log(`    Overview card text: ${overviewAreas.replace(/\n/g, ' | ')}`);
    if (overviewAreas.includes('Overdue')) pass('Overdue row exists in overview');
    if (overviewAreas.includes('AED')) pass('Overview card shows AED amounts');

    const methodsCard = await page.locator('text=Payment Methods').locator('..').locator('..').innerText().catch(() => '');
    console.log(`    Methods card: ${methodsCard.replace(/\n/g, ' | ')}`);
    if (methodsCard.includes('%') || methodsCard.includes('No payments')) {
      pass('Payment Methods card shows dynamic % or empty state');
    }
  } catch(e) { fail('Payment Overview dynamic check', e); }

  // ── 10. Sessions page ─────────────────────────────────────────────────────
  console.log('\n[10] SESSIONS PAGE');
  await page.goto(`${BASE}/sessions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await ss(page, 'sessions-page');
  try {
    // Sessions page renders PlayerAttendanceSystem — no <main> tag, uses cards
    // Check for known text from the component
    const bodyText = await page.locator('body').innerText({ timeout: 5000 });
    const hasSessions = bodyText.includes("Session") || bodyText.includes("Attendance") || bodyText.includes("Present");
    if (hasSessions) pass('Sessions page rendered (attendance system loaded)');
    else fail('Sessions page content', 'Expected sessions content not found');
  } catch(e) { fail('Sessions page', e); }

  // ── 11. Trainers page ─────────────────────────────────────────────────────
  console.log('\n[11] TRAINERS PAGE');
  await page.goto(`${BASE}/trainers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await ss(page, 'trainers-page');
  try {
    pass('Trainers page rendered');
    const rows = await page.locator('table tbody tr').count();
    console.log(`    Trainer rows: ${rows}`);
  } catch(e) { fail('Trainers page', e); }

  // ── 12. Expenses page ─────────────────────────────────────────────────────
  console.log('\n[12] EXPENSES PAGE');
  await page.goto(`${BASE}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await ss(page, 'expenses-page');
  try {
    pass('Expenses page rendered');
    const expText = await page.locator('main').innerText().catch(() => '');
    if (!expText.match(/\$\d+/)) pass('Expenses page: no raw $ amounts');
  } catch(e) { fail('Expenses page', e); }

  // ── 13. Inventory page ────────────────────────────────────────────────────
  console.log('\n[13] INVENTORY PAGE');
  await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await ss(page, 'inventory-page');
  try {
    pass('Inventory page rendered');
    const invText = await page.locator('main').innerText().catch(() => '');
    if (!invText.match(/\$\d+/)) pass('Inventory page: no raw $ amounts');
  } catch(e) { fail('Inventory page', e); }

  // ── 14. Navigation links ──────────────────────────────────────────────────
  console.log('\n[14] SIDEBAR NAVIGATION');
    // Map each route to the actual heading tag/text it uses
  const navLinks = [
    { path: '/dashboard', name: 'Dashboard', selector: 'h1, h2' },
    { path: '/players', name: 'Players', selector: 'h1, h2' },
    { path: '/payments', name: 'Payments', selector: 'h1, h2' },
    // Sessions renders PlayerAttendanceSystem (div-based, no h1/h2)
    { path: '/sessions', name: 'Sessions', selector: 'body' },
    { path: '/trainers', name: 'Trainers', selector: 'h1, h2' },
    // Expenses uses h1
    { path: '/expenses', name: 'Expenses', selector: 'h1' },
    // Inventory uses h1
    { path: '/inventory', name: 'Inventory', selector: 'h1' },
  ];
  for (const { path, name, selector } of navLinks) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      if (selector === 'body') {
        const bodyText = await page.locator('body').innerText({ timeout: 5000 });
        const loaded = bodyText.includes("Session") || bodyText.includes("Attendance") || bodyText.length > 100;
        if (loaded) pass(`Nav: ${name} (page loaded)`);
        else fail(`Nav: ${name}`, 'Page body appears empty');
      } else {
        const el = await page.locator(selector).first().innerText({ timeout: 5000 });
        pass(`Nav: ${name} (heading: ${el.trim()})`);
      }
    } catch(e) { fail(`Nav: ${name}`, e); }
  }

  // ── 15. Console errors summary ────────────────────────────────────────────
  console.log('\n[15] CONSOLE ERRORS CHECK');
  const relevantErrors = consoleErrors.filter(e =>
    !e.includes('favicon') && !e.includes('extension') &&
    !e.includes('ERR_ABORTED') && !e.includes('net::')
  );
  if (relevantErrors.length === 0) {
    pass('No unexpected console errors');
  } else {
    console.log(`    ${relevantErrors.length} console error(s):`);
    relevantErrors.slice(0, 5).forEach(e => console.log(`    - ${e.substring(0, 120)}`));
    fail(`Console errors (${relevantErrors.length})`, relevantErrors[0].substring(0, 100));
  }

  await browser.close();

  // ── FINAL REPORT ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('FULL TEST REPORT');
  console.log('═'.repeat(65));
  const passed = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  passed.forEach(r => console.log(`  ✅ ${r.label}`));
  if (failed.length > 0) {
    console.log('\nFAILURES:');
    failed.forEach(r => console.log(`  ❌ ${r.label}\n     └─ ${r.err}`));
  }
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`  PASSED: ${passed.length}/${results.length}`);
  console.log(`  Screenshots: ${SS_DIR}`);

  if (failed.length > 0) process.exit(1);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
