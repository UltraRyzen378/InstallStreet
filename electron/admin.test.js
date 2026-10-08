const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureAdministrator } = require('./admin');
test('administrator session continues without another elevation request', async () => {
  let relaunched = false;
  assert.equal(await ensureAdministrator(async () => true, async () => { relaunched = true; }), true);
  assert.equal(relaunched, false);
});
test('unelevated session only requests an elevated relaunch and cannot continue', async () => {
  let requests = 0;
  assert.equal(await ensureAdministrator(async () => false, async () => { requests++; }), false);
  assert.equal(requests, 1);
});
test('canceling elevation does not continue the app', async () => {
  await assert.rejects(ensureAdministrator(async () => false, async () => { throw new Error('UAC canceled'); }), /UAC canceled/);
});
