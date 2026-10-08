const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createProfileStore } = require('./gh-profile');
test('local profile round-trips and replaces only its own JSON file', async () => {
  const directory = path.join(__dirname,'../tmp/profile-tests',crypto.randomUUID());
  const store = createProfileStore(directory);
  assert.equal(await store.load(), null);
  await store.save({ name: 'first-user', email: 'first@example.org' });
  assert.deepEqual(await store.load(), { username: 'first-user', email: 'first@example.org' });
  await store.save({ name: 'second-user', email: 'second@example.org' });
  assert.deepEqual(await store.load(), { username: 'second-user', email: 'second@example.org' });
  assert.deepEqual(await fs.readdir(directory), ['gh-profile.json']);
});
