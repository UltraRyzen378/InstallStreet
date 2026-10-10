const output = document.querySelector('#output');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const count = document.querySelector('#count');
const result = document.querySelector('#result');
const buttons = ['run', 'check', 'retry'].map(id => document.getElementById(id));
window.installstreet.onLog(text => {
  output.textContent += text + '\n';
  if (output.textContent.length > 250000) output.textContent = output.textContent.slice(-200000);
  output.scrollTop = output.scrollHeight;
});
window.installstreet.onState(state => {
  document.body.classList.toggle('busy', state.busy);
  buttons.forEach(button => { button.disabled = state.busy; });
  progress.max = state.total; progress.value = state.completed;
  count.textContent = `${state.completed} / ${state.total} tasks`;
  if (state.message) status.textContent = state.message;
  result.textContent = state.busy ? 'In progress' : state.code === 0 ? 'Complete' : 'Needs attention';
});
let preparing = false;
const gitDialog = document.getElementById('git-dialog');
const gitForm = document.getElementById('git-form');
function requestIdentity(info) {
  document.getElementById('git-name').value = info.profile?.username || '';
  document.getElementById('git-email').value = info.profile?.email || '';
  document.getElementById('git-existing').textContent = info.name || info.email ? `Current Git identity: ${info.name || '(unset)'} <${info.email || '(unset)'}>` : 'No global Git identity is currently configured.';
  return new Promise(resolve => {
    let finished = false;
    const done = value => { if (finished) return; finished = true; gitDialog.close(); gitForm.removeEventListener('submit', submit); gitDialog.removeEventListener('cancel', cancel); document.getElementById('git-skip').removeEventListener('click', skip); resolve(value); };
    const submit = event => { event.preventDefault(); done({ name: document.getElementById('git-name').value.trim(), email: document.getElementById('git-email').value.trim() }); };
    const skip = () => done(null);
    const cancel = event => { event.preventDefault(); done(null); };
    gitForm.addEventListener('submit', submit); gitDialog.addEventListener('cancel', cancel); document.getElementById('git-skip').addEventListener('click', skip);
    gitDialog.showModal();
  });
}
for (const mode of ['run', 'check', 'retry']) document.getElementById(mode).addEventListener('click', async () => {
  if (preparing) return; preparing = true; buttons.forEach(button => { button.disabled = true; });
  output.textContent = '';
  try {
    let identity = null;
    const tasks = window.selectedTasks();
    if (!tasks.length) throw new Error('Select at least one app or setting.');
    if (mode !== 'check' && tasks.includes('gh')) { const info = await window.installstreet.gitStatus(); if (!info.ghInstalled) identity = await requestIdentity(info); }
    await window.installstreet.start(mode, identity, tasks);
  } catch (error) { status.textContent = error.message; }
  finally { preparing = false; buttons.forEach(button => { button.disabled = false; }); }
});
document.getElementById('logs').addEventListener('click', async () => {
  try { const error = await window.installstreet.openLogs(); if (error) status.textContent = error; } catch (error) { status.textContent = error.message; }
});



document.getElementById('storage').addEventListener('click',async()=>{try{await window.installstreet.openStorage();}catch(error){status.textContent=error.message;}});
