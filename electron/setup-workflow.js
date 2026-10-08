const { EventEmitter } = require('node:events');
const { validateIdentity } = require('./git-identity');
class SetupWorkflow extends EventEmitter {
  constructor(runner, profile, git, confirm) {
    super(); this.runner = runner; this.profile = profile; this.git = git; this.confirm = confirm; this.busy = false; this.identityPending = false;
    runner.on('log', text => this.emit('log', text));
    runner.on('state', state => this.emit('state', !state.busy && this.identityPending ? { ...state, busy: true, message: 'Saving Git identity…' } : state));
  }
  async start(mode, value) {
    if (!['run','retry','check'].includes(mode)) throw new Error('Unknown setup action.');
    if (this.busy || this.runner.busy) throw new Error('Setup is already active.');
    if (mode === 'check' && value != null) throw new Error('Check only cannot save a profile or change Git configuration.');
    const identity = value == null ? null : validateIdentity(value);
    this.busy = true;
    try {
      if (identity) {
        await this.profile.save(identity);
        this.emit('log', 'Local GitHub profile saved in InstallStreet. No authentication settings were changed.');
        this.identityPending = await this.confirm(identity);
      }
      const outcome = await this.runner.start(mode);
      if (this.identityPending) {
        try { await this.git.apply(identity); this.emit('log', 'Git global author name and email saved and verified.'); }
        catch (error) { this.emit('log', 'Git identity could not be fully saved: ' + error.message); outcome.code = 1; outcome.message = 'Setup finished, but Git configuration failed. Review the output.'; }
        this.emit('state', { busy: false, mode, completed: 24, total: 24, code: outcome.code, message: outcome.message });
      }
      return outcome;
    } finally { this.busy = false; this.identityPending = false; }
  }
}
module.exports = { SetupWorkflow };


