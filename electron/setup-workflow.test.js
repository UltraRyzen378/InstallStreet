const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { SetupWorkflow } = require('./setup-workflow');
function fixture(approval) {
  const calls = [];
  const runner = new EventEmitter(); runner.busy = false;
  runner.start = async mode => { calls.push('run:' + mode); runner.emit('state', { busy: false, completed: 24, total: 24, code: 0 }); return { code: 0, message: 'Done' }; };
  const profile = { save: async value => calls.push('profile:' + value.name) };
  const git = { apply: async value => calls.push('git:' + value.name) };
  const workflow = new SetupWorkflow(runner, profile, git, async () => { calls.push('warning'); return approval; });
  return { workflow, calls, git };
}
test('declining Git configuration saves only the local profile and runs setup', async () => {
  const { workflow, calls } = fixture(false);
  await workflow.start('run', { name: 'developer', email: 'dev@example.org' });
  assert.deepEqual(calls, ['profile:developer','warning','run:run']);
});
test('Git identity changes only after explicit warning acceptance and installation', async () => {
  const { workflow, calls } = fixture(true);
  const states = []; workflow.on('state', state => states.push(state));
  await workflow.start('retry', { name: 'developer', email: 'dev@example.org' });
  assert.deepEqual(calls, ['profile:developer','warning','run:retry','git:developer']);
  assert.equal(states[0].busy, true); assert.equal(states.at(-1).busy, false);
});
test('check only cannot change the local profile or Git configuration', async () => {
  const { workflow, calls } = fixture(true);
  await assert.rejects(workflow.start('check', { name: 'developer', email: 'dev@example.org' }), /Check only/);
  assert.deepEqual(calls, []);
  await workflow.start('check', null); assert.deepEqual(calls, ['run:check']);
});
test('skipping the profile still installs every task without warning or config writes', async () => {
  const { workflow, calls } = fixture(true);
  await workflow.start('run', null); assert.deepEqual(calls, ['run:run']);
});
test('Git configuration failure is reported and releases the workflow lock', async () => {
  const { workflow, git } = fixture(true); git.apply = async () => { throw new Error('fixture write denied'); };
  assert.equal((await workflow.start('run', { name: 'developer', email: 'dev@example.org' })).code, 1);
  assert.equal(workflow.busy, false);
});


