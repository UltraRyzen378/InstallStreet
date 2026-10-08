const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { Runner } = require('./runner');
const { createGitIdentity } = require('./git-identity');
const { createProfileStore } = require('./gh-profile');
const { SetupWorkflow } = require('./setup-workflow');
const { isAdministrator, elevate, ensureAdministrator } = require('./admin');
const gitIdentity = createGitIdentity();

const root = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.resolve(__dirname, '..');
const dataRoot = app.isPackaged ? path.join(app.getPath('appData'), 'InstallStreet') : root;
const page = pathToFileURL(path.join(__dirname, 'index.html')).href;
const smoke = process.argv.includes('--smoke-test');
app.setPath('userData', path.join(dataRoot, 'tmp', smoke ? 'electron-smoke-profile' : 'electron-user-data'));
app.setPath('crashDumps', path.join(dataRoot, 'tmp', 'electron-crashes'));
const runner = new Runner(root, undefined, dataRoot);
let window, workflow;
const profile = createProfileStore(dataRoot);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const allowed = await ensureAdministrator(isAdministrator, () => elevate(app.isPackaged ? process.execPath : path.join(root, 'InstallStreet.exe'), smoke));
    if (!allowed) { app.quit(); return; }
    window = new BrowserWindow({ width: 1100, height: 780, minWidth: 800, minHeight: 600, show: false, backgroundColor: '#101419', title: 'InstallStreet — Administrator', icon: path.join(root, 'VaultHouse/icons/.running/running.ico'), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
    window.removeMenu();
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const validate = event => { if (event.sender !== window.webContents || event.senderFrame?.url !== page) throw new Error('Invalid application request.'); };
    workflow = new SetupWorkflow(runner, profile, gitIdentity, async identity => {
      const answer = await dialog.showMessageBox(window, {
        type: 'warning', title: 'Change Git configuration?', message: 'Also use this profile for Git?',
        detail: `user.name: ${identity.name}\nuser.email: ${identity.email}\n\nThis replaces your global Git author name and email for this Windows account. It affects future commits in repositories that do not override these values. These details may be visible in published commits. Your local profile remains saved if you skip this step. This does not sign you into GitHub.`,
        buttons: ['Set Git identity', 'Keep Git configuration'], defaultId: 1, cancelId: 1, noLink: true
      });
      return answer.response === 0;
    });
    ipcMain.handle('setup:git-status', async event => { validate(event); return { ...await gitIdentity.status(), profile: await profile.load() }; });
    ipcMain.handle('setup:start', (event, mode, value) => { validate(event); return workflow.start(mode, value); });
    ipcMain.handle('setup:logs', async event => {
      validate(event);
      const folder = path.join(dataRoot, 'StatusHQ');
      try { await fs.access(folder); } catch { return 'No logs yet. Run setup first.'; }
      return shell.openPath(folder);
    });
    workflow.on('log', text => { if (!window.isDestroyed()) window.webContents.send('setup:log', text); });
    workflow.on('state', state => { if (!window.isDestroyed()) window.webContents.send('setup:state', state); });
    window.on('close', event => { if (workflow.busy || runner.busy) { event.preventDefault(); window.webContents.send('setup:log', 'Setup is active. Wait for it to finish before closing.'); } });
    await window.loadFile(path.join(__dirname, 'index.html'));
    if (!smoke) window.show();
    else {
      try {
        const canceled = await window.webContents.executeJavaScript("(async () => { const pending = requestIdentity({ name: 'Existing Git Author', email: 'existing@example.org', profile: null }); if (!document.getElementById('git-dialog').open) throw new Error('Profile dialog did not open'); document.getElementById('git-skip').click(); return await pending; })()");
        if (canceled !== null) throw new Error('Skipping profile configuration did not cancel the profile.');
        const result = await window.webContents.executeJavaScript("(async () => { if (document.querySelector('input[type=checkbox],select') || !window.installstreet) throw new Error('Invalid UI'); return await window.installstreet.start('check'); })()");
        if (result.code !== 0) throw new Error('Read-only backend check failed.');
        await new Promise(resolve => setTimeout(resolve, 300));
        const complete = await window.webContents.executeJavaScript("document.getElementById('count').textContent === '21 / 21 tasks' && !document.getElementById('run').disabled" );
        if (!complete) throw new Error('Renderer did not finish the read-only check.');
        const screenshot = await window.webContents.capturePage();
        await fs.mkdir(path.join(dataRoot, 'tmp'), { recursive: true });
        await fs.writeFile(path.join(dataRoot, 'tmp/electron-preview.png'), screenshot.toPNG());
        console.log('Electron smoke test passed. Preview: tmp/electron-preview.png');
        app.exit(0);
      } catch (error) { console.error(error); app.exit(1); }
    }
  }).catch(error => { console.error(error); if (!smoke) dialog.showErrorBox('InstallStreet', error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}













