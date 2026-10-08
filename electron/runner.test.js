const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { Runner } = require('./runner');
function fixture() { const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); return child; }
test('all setup actions run the complete catalog and capture fragmented output', async () => {
  for (const mode of ['run', 'retry', 'check']) {
    const child = fixture(); let invocation;
    const runner = new Runner('E:\\InstallStreet', (...args) => { invocation = args; return child; });
    const logs = [], states = []; runner.on('log', text => logs.push(text)); runner.on('state', state => states.push(state));
    const pending = runner.start(mode);
    assert.deepEqual(invocation[1], [mode === 'check' ? '--check' : '--run', 'all']);
    assert.equal(invocation[2].shell, false);
    child.stdout.write('[1/21] Goo'); child.stdout.write('gle Chrome\r\n');
    child.stderr.write('diagnostic\n'); child.stdout.write('Result: done\n');
    child.stdout.write('tail'); child.emit('close', 0);
    assert.equal((await pending).code, 0); assert.equal(runner.busy, false);
    assert.deepEqual(logs, ['[1/21] Google Chrome', 'diagnostic', 'Result: done', 'tail']);
    assert.equal(states.at(-1).completed, 21);
  }
});
test('rejects simultaneous and unknown actions', async () => {
  const child = fixture(); const runner = new Runner('.', () => child);
  const pending = runner.start('run');
  await assert.rejects(runner.start('run'), /already active/);
  await assert.rejects(runner.start('anything'), /Unknown/);
  child.emit('close', 1); assert.equal((await pending).code, 1);
});
test('spawn errors restore controls and reject the request', async () => {
  const child = fixture(); const runner = new Runner('.', () => child);
  const states = []; runner.on('state', state => states.push(state));
  const pending = runner.start('check'); child.emit('error', new Error('fixture missing backend')); child.emit('close', 1);
  await assert.rejects(pending, /missing backend/); assert.equal(runner.busy, false);
  assert.equal(states.filter(state => !state.busy).length, 1);
});



test('packaged app directs mutable state outside the installation directory', async () => {
  const child = fixture(); let options;
  const runner = new Runner('C:\\Program Files\\InstallStreet\\resources\\backend', (_exe, _args, value) => { options = value; return child; }, 'C:\\Users\\Example\\AppData\\Roaming\\InstallStreet');
  const pending = runner.start('check'); child.emit('close', 0); await pending;
  assert.equal(options.env.INSTALLSTREET_DATA_ROOT, 'C:\\Users\\Example\\AppData\\Roaming\\InstallStreet');
  assert.equal(options.cwd, 'C:\\Program Files\\InstallStreet\\resources\\backend');
});




