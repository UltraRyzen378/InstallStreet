const updateDialog=document.getElementById('update-dialog');
const updateStatus=document.getElementById('update-status');
let updateAction=false;
function updateState(state){
  updateStatus.textContent=state.message;
  document.getElementById('settings').textContent=['available','ready'].includes(state.phase)?'Settings · Update available':'Settings';
  document.getElementById('update-download-now').disabled=state.phase!=='available';
  document.getElementById('update-install-now').disabled=state.phase!=='ready';
  document.getElementById('update-check-now').disabled=['checking','downloading'].includes(state.phase);
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
for(const [id,method] of [['update-check-now','checkUpdates'],['update-download-now','downloadUpdate'],['update-install-now','installUpdate']])document.getElementById(id).addEventListener('click',async()=>{
  if(updateAction)return;updateAction=true;
  try{const result=await window.installstreet[method]();if(result.canceled)updateStatus.textContent='Update installation canceled.';}
  catch(error){updateStatus.textContent=error.message;}
  finally{updateAction=false;}
});
