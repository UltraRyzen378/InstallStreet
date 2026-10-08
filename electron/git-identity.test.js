const test = require('node:test');
const assert = require('node:assert/strict');
const { createGitIdentity, validateIdentity } = require('./git-identity');
test('validates identity before executing any Git command', async () => {
  let calls = 0;
  const identity = createGitIdentity(async () => { calls++; return { stdout: '' }; }, () => false, {});
  await assert.rejects(identity.apply({ name: 'Developer', email: 'invalid-email' }), /valid email/);
  await assert.rejects(identity.apply({ name: 'Developer\nInjected', email: 'dev@example.org' }), /author name/);
  assert.equal(calls, 0);
  assert.deepEqual(validateIdentity({ name: ' Developer ', email: ' dev+test@example.org ' }), { name: 'Developer', email: 'dev+test@example.org' });
});
test('writes literal values with explicit global scope and verifies both values', async () => {
  const values = new Map(), calls = [];
  const execute = async (file, args, options) => {
    calls.push({ file, args, options });
    if (file === 'gh.exe') { const error = new Error('missing'); error.code = 'ENOENT'; throw error; }
    if (args[0] === '--version') return { stdout: 'git version 2.53.0' };
    const key = args[args.indexOf('--') + 1];
    if (args.includes('--replace-all')) { values.set(key, args.at(-1)); return { stdout: '' }; }
    if (!values.has(key)) { const error = new Error('unset'); error.code = 1; throw error; }
    return { stdout: values.get(key) + '\n' };
  };
  const identity = createGitIdentity(execute, () => false, {});
  const state = await identity.status();
  assert.equal(state.ghInstalled, false); assert.equal(state.gitInstalled, true);
  const input = { name: 'Dev $(command) & "Quoted"', email: 'dev+test@example.org' };
  assert.deepEqual(await identity.apply(input), input);
  const writes = calls.filter(call => call.args.includes('--replace-all'));
  assert.equal(writes.length, 2);
  for (const call of writes) { assert.equal(call.options.shell, false); assert.ok(call.args.includes('--global')); assert.ok(call.args.includes('--')); }
  assert.equal(writes[0].args.at(-1), input.name);
  assert.equal(writes[1].args.at(-1), input.email);
  assert.equal(calls.some(call => call.args.includes('auth')), false);
});
test('existing gh is detected without authenticating', async () => {
  const calls = [];
  const execute = async (file, args) => {
    calls.push(args);
    if (args[0] === '--version') return { stdout: file === 'gh.exe' ? 'gh version 2.80.0' : 'git version 2.53.0' };
    const error = new Error('unset'); error.code = 1; throw error;
  };
  const state = await createGitIdentity(execute, () => false, {}).status();
  assert.equal(state.ghInstalled, true);
  assert.equal(calls.some(args => args.includes('auth')), false);
});
