const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');
class Runner extends EventEmitter {
  constructor(root, spawnProcess = spawn, dataRoot = root) { super(); this.root = root; this.dataRoot = dataRoot; this.spawnProcess = spawnProcess; this.busy = false; }
  start(mode) {
    if (!['run', 'check', 'retry'].includes(mode)) return Promise.reject(new Error('Unknown setup action.'));
    if (this.busy) return Promise.reject(new Error('Setup is already active.'));
    this.busy = true;
    this.emit('state', { busy: true, mode, completed: 0, total: 25, message: mode === 'check' ? 'Checking this PC…' : 'Running setup…' });
    return new Promise((resolve, reject) => {
      let child;
      let completed = 0, total = 25;
      const buffers = new Map();
      const decoders = new Map();
      const line = text => {
        this.emit('log', text);
        const stage = text.match(/^\s*\[(\d+)\/(\d+)\]\s*(.+)/);
        if (stage) { completed = Number(stage[1]) - 1; total = Number(stage[2]); this.emit('state', { busy: true, mode, completed, total, message: stage[3] }); }
        if (text.startsWith('Result: ') || (mode === 'check' && /^\[(READY|NEEDS SETUP|ERROR)\]/.test(text))) {
          completed = Math.min(completed + 1, total);
          this.emit('state', { busy: true, mode, completed, total });
        }
      };
      const chunk = (stream, bytes) => {
        const text = (buffers.get(stream) || '') + decoders.get(stream).write(bytes);
        const parts = text.split(/\r?\n/); buffers.set(stream, parts.pop()); parts.forEach(line);
      };
      let settled = false;
      const finish = (code, error) => {
        if (settled) return; settled = true;
        for (const [stream, decoder] of decoders) { const tail = (buffers.get(stream) || '') + decoder.end(); if (tail) line(tail); }
        this.busy = false;
        const message = error ? error.message : code === 0 ? (mode === 'check' ? 'Check complete. Review the results below.' : 'Setup complete.') : 'Setup finished with failures. Review the output and retry.';
        this.emit('state', { busy: false, mode, completed: error ? completed : total, total, code, message });
        if (error) reject(error); else resolve({ code, message });
      };
      try {
        child = this.spawnProcess(path.join(this.root, 'InstallStreet.Cli.exe'), [mode === 'check' ? '--check' : '--run', 'all'], { cwd: this.root, windowsHide: true, shell: false, env: { ...process.env, INSTALLSTREET_DATA_ROOT: this.dataRoot } });
        for (const stream of [child.stdout, child.stderr]) { decoders.set(stream, new StringDecoder('utf8')); stream.on('data', bytes => chunk(stream, bytes)); }
        child.once('error', error => finish(null, error));
        child.once('close', code => finish(code, null));
      } catch (error) { finish(null, error); }
    });
  }
}
module.exports = { Runner };








