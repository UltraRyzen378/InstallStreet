const appRoster = [
  ['winget','WinGet'],['git','Git'],['gh','GitHub CLI'],['chrome','Google Chrome'],
  ['codex','OpenAI Codex'],['rufus','Rufus'],['vscode','Visual Studio Code'],['dotnet10','.NET 10 SDK'],
  ['roblox','Roblox Player'],['nvm-windows','nvm · Node.js · npm'],['dimmer','Dimmer'],['python','Python · pip'],
  ['itunes','iTunes'],['icloud','iCloud'],['iloader','iLoader'],['veracrypt','VeraCrypt'],
  ['winrar','WinRAR'],['iconsextract','IconsExtract']
];
const appRosterRoot=document.getElementById('app-roster');
for(const [id,name] of appRoster){
  const item=document.createElement('li');item.dataset.app=id;
  const well=document.createElement('span');well.className='app-logo';
  const logo=document.createElement('img');logo.src=`assets/apps/${id}.${id==='iloader'?'svg':'png'}`;logo.alt='';logo.width=32;logo.height=32;well.append(logo);
  const text=document.createElement('span');text.textContent=name;
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=id;checkbox.setAttribute('aria-label',name);checkbox.className='task-choice';
  item.append(checkbox,well,text);appRosterRoot.append(item);
}
document.getElementById('icons8-credit').addEventListener('click',async()=>{try{await window.installstreet.openIcons8();}catch(error){document.getElementById('status').textContent=error.message;}});
document.getElementById('finish').addEventListener('click',async()=>{try{await window.installstreet.closeSetup();}catch(error){document.getElementById('status').textContent=error.message;}});
window.installstreet.onState(state=>{
  const title=document.getElementById('wizard-title'),description=document.getElementById('wizard-description');
  const active=state.busy?2:state.code===undefined?1:3;
  document.querySelectorAll('[data-wizard-step]').forEach(item=>{item.classList.toggle('active',Number(item.dataset.wizardStep)===active);item.classList.toggle('completed',Number(item.dataset.wizardStep)<active);});
  document.getElementById('finish').disabled=state.busy;
  document.getElementById('finish').textContent=state.busy?'Close':state.code===0?'Finish':'Close';
  document.getElementById('run').textContent=state.busy?(state.mode==='check'?'Checking…':'Installing…'):state.code===undefined || state.mode==='check'?'Install':'Run again';
  if(state.busy){title.textContent=state.mode==='check'?'Checking this computer':'Installing applications';description.textContent=state.mode==='check'?'InstallStreet is checking the current configuration.':'Please wait while InstallStreet completes the setup tasks.';}
  else if(state.code!==undefined){title.textContent=state.code===0?(state.mode==='check'?'Check completed':'Setup completed'):'Setup needs attention';description.textContent=state.code===0?'Review the results below, then choose Finish.':'Review the output below and use Retry setup after resolving the reported issues.';}
});
