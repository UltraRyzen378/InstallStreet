const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const defaults = { checkOnStartup: false, autoDownload: false, autoInstall: false };
function createUpdateSettings(root) {
  const file = path.join(root, 'update-settings.json');
  let current = { ...defaults };
  const visible = () => ({ ...current });
  return {
    async load() {
      try {
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        for (const key of Object.keys(defaults)) if (typeof value[key] === 'boolean') current[key] = value[key];
        if (Object.hasOwn(value, 'encryptedToken')) await this.save(current);
      } catch (error) { if (error.code !== 'ENOENT') throw new Error('Update settings could not be read.'); }
      return visible();
    },
    view: visible,
    async save(value) {
      if (!value || Object.keys(defaults).some(key => typeof value[key] !== 'boolean')) throw new Error('Invalid update settings.');
      if (value.autoInstall && (!value.autoDownload || !value.checkOnStartup)) throw new Error('Automatic installation requires automatic checks and downloads.');
      if (value.autoDownload && !value.checkOnStartup) throw new Error('Automatic downloads require automatic checks.');
      const next = Object.fromEntries(Object.keys(defaults).map(key => [key, value[key]]));
      await fs.mkdir(root, { recursive: true });
      const temporary = path.join(root, '.update-settings-' + crypto.randomUUID() + '.tmp');
      try { await fs.writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
      finally { await fs.rm(temporary, { force: true }); }
      current = next;
      return visible();
    }
  };
}
module.exports = { createUpdateSettings };
