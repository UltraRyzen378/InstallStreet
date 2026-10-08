const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
function validateIdentity(value) {
  if (!value || typeof value.name !== 'string' || typeof value.email !== 'string') throw new Error('Enter your username / author name and email.');
  const name = value.name.trim(), email = value.email.trim();
  if (!name || name.length > 256 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Enter a valid username / author name.');
  if (email.length > 254 || /[\x00-\x1f\x7f]/.test(email) || !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return { name, email };
}
function createGitIdentity(execute = exec, exists = fs.existsSync, environment = process.env) {
  const options = { windowsHide: true, shell: false, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024, env: environment };
  async function find(tool) {
    const folders = [environment.ProgramFiles, environment['ProgramFiles(x86)'], environment.LOCALAPPDATA && path.join(environment.LOCALAPPDATA, 'Programs')].filter(Boolean);
    const relative = tool === 'git' ? ['Git','cmd','git.exe'] : ['GitHub CLI','gh.exe'];
    const candidates = folders.map(folder => path.join(folder, ...relative));
    candidates.push(tool + '.exe');
    for (const candidate of candidates) {
      if (path.isAbsolute(candidate) && !exists(candidate)) continue;
      try { const result = await execute(candidate, ['--version'], options); if (/\d+\.\d+/.test(result.stdout)) return candidate; }
      catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code) && path.isAbsolute(candidate)) throw new Error(`Unable to check ${tool}: ${error.message}`); }
    }
    return null;
  }
  async function get(git, key) {
    try { return (await execute(git, ['config','--global','--get','--',key], options)).stdout.trim(); }
    catch (error) { if (error.code === 1) return ''; throw error; }
  }
  return {
    async status() {
      const [git, gh] = await Promise.all([find('git'), find('gh')]);
      return { gitInstalled: !!git, ghInstalled: !!gh, name: git ? await get(git, 'user.name') : '', email: git ? await get(git, 'user.email') : '' };
    },
    async apply(value) {
      const identity = validateIdentity(value);
      const git = await find('git');
      if (!git) throw new Error('Git was not installed. Your Git identity could not be saved.');
      await execute(git, ['config','--global','--replace-all','--','user.name',identity.name], options);
      await execute(git, ['config','--global','--replace-all','--','user.email',identity.email], options);
      if (await get(git, 'user.name') !== identity.name || await get(git, 'user.email') !== identity.email) throw new Error('Git identity verification failed.');
      return identity;
    }
  };
}
module.exports = { createGitIdentity, validateIdentity };
