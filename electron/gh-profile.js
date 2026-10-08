const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateIdentity } = require('./git-identity');
function createProfileStore(directory) {
  const file = path.join(directory, 'gh-profile.json');
  return {
    async load() {
      let text;
      try { text = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      const value = JSON.parse(text);
      const identity = validateIdentity({ name: value.username, email: value.email });
      return { username: identity.name, email: identity.email };
    },
    async save(value) {
      const identity = validateIdentity(value);
      const profile = { username: identity.name, email: identity.email };
      await fs.mkdir(directory, { recursive: true });
      const temporary = path.join(directory, '.gh-profile-' + crypto.randomUUID() + '.tmp');
      try { await fs.writeFile(temporary, JSON.stringify(profile, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, file); }
      finally { await fs.rm(temporary, { force: true }); }
      return profile;
    }
  };
}
module.exports = { createProfileStore };
