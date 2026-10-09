const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const defaults = { checkOnStartup: false, autoDownload: false, autoInstall: false };
function createUpdateSettings(root, encryption) {
  const file = path.join(root, 'update-settings.json');
  let current = { ...defaults }, encryptedToken = null;
  const visible = () => ({ ...current, tokenConfigured: !!encryptedToken, encryptionAvailable: encryption.isEncryptionAvailable() });
  return {
    async load() {
      try {
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        for (const key of Object.keys(defaults)) if (typeof value[key] === 'boolean') current[key] = value[key];
        encryptedToken = typeof value.encryptedToken === 'string' ? value.encryptedToken : null;
      } catch (error) { if (error.code !== 'ENOENT') throw new Error('Update settings could not be read.'); }
      return visible();
    },
    view: visible,
    token() {
      if (!encryptedToken) return null;
      if (!encryption.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
      try { return encryption.decryptString(Buffer.from(encryptedToken, 'base64')); }
      catch { throw new Error('The saved update token cannot be decrypted. Save a new token in Settings.'); }
    },
    async save(value) {
      if (!value || Object.keys(defaults).some(key => typeof value[key] !== 'boolean')) throw new Error('Invalid update settings.');
      if (value.autoInstall && (!value.autoDownload || !value.checkOnStartup)) throw new Error('Automatic installation requires automatic checks and downloads.');
      if (value.autoDownload && !value.checkOnStartup) throw new Error('Automatic downloads require automatic checks.');
      let nextToken = encryptedToken;
      if (value.clearToken === true) nextToken = null;
      else if (value.token) {
        if (typeof value.token !== 'string' || value.token.length > 512 || /\s/.test(value.token)) throw new Error('Invalid GitHub token.');
        if (!encryption.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable. The token was not saved.');
        nextToken = encryption.encryptString(value.token).toString('base64');
      }
      const next = Object.fromEntries(Object.keys(defaults).map(key => [key, value[key]]));
      await fs.mkdir(root, { recursive: true });
      const temporary = path.join(root, '.update-settings-' + crypto.randomUUID() + '.tmp');
      try { await fs.writeFile(temporary, JSON.stringify({ ...next, encryptedToken: nextToken }, null, 2), { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
      finally { await fs.rm(temporary, { force: true }); }
      current = next; encryptedToken = nextToken;
      return visible();
    }
  };
}
module.exports = { createUpdateSettings };
