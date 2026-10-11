const updateDialog=document.getElementById('update-dialog');
const updateStatus=document.getElementById('update-status');
let updateAction=false;
let updatePhase='idle';
function updateState(state){
  updatePhase=state.phase;
  updateStatus.textContent=state.message;
  document.getElementById('settings').textContent=['available','ready'].includes(state.phase)?'Settings · Update available':'Settings';
  document.getElementById('update-install-latest').disabled=updateAction||['checking','downloading','installing'].includes(state.phase);
}
function applyUpdateSettings(value){
  for(const [id,key] of [['update-check','checkOnStartup'],['update-download','autoDownload'],['update-install','autoInstall']])document.getElementById(id).checked=value[key];
}
window.installstreet.onUpdateState(updateState);
document.getElementById('settings').addEventListener('click',async()=>{
  try{const value=await window.installstreet.updateSettings();applyUpdateSettings(value);updateState(value.state);if(!value.packaged)updateStatus.textContent='Development build: update installation is available in packaged releases.';updateDialog.showModal();}
  catch(error){document.getElementById('status').textContent=error.message;}
});
document.getElementById('update-close').addEventListener('click',()=>updateDialog.close());
document.getElementById('update-check').addEventListener('change',event=>{if(!event.target.checked){document.getElementById('update-download').checked=false;document.getElementById('update-install').checked=false;}});
document.getElementById('update-download').addEventListener('change',event=>{if(event.target.checked)document.getElementById('update-check').checked=true;else document.getElementById('update-install').checked=false;});
document.getElementById('update-install').addEventListener('change',event=>{if(event.target.checked){document.getElementById('update-check').checked=true;document.getElementById('update-download').checked=true;}});
document.getElementById('update-form').addEventListener('submit',async event=>{
  event.preventDefault();if(updateAction)return;updateAction=true;
  try{
    const value=await window.installstreet.saveUpdateSettings({checkOnStartup:document.getElementById('update-check').checked,autoDownload:document.getElementById('update-download').checked,autoInstall:document.getElementById('update-install').checked});
    if(value.canceled)updateStatus.textContent='Automatic installation was not enabled. Settings were not saved.';
    else{applyUpdateSettings(value);updateStatus.textContent='Update settings saved.';}
  }catch(error){updateStatus.textContent=error.message;}
  finally{updateAction=false;}
});
document.getElementById('update-install-latest').addEventListener('click',async()=>{
  if(updateAction)return;updateAction=true;
  updateStatus.textContent='Checking for updates…';document.getElementById('update-install-latest').disabled=true;
  try{const result=await window.installstreet.installLatestUpdate();if(result.canceled)updateStatus.textContent='Update installation canceled.';}
  catch(error){updateStatus.textContent=error.message;}
  finally{updateAction=false;document.getElementById('update-install-latest').disabled=['checking','downloading','installing'].includes(updatePhase);}
});
