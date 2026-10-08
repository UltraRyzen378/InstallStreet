const output=document.getElementById('storage-output');
const status=document.getElementById('storage-status');
const progress=document.getElementById('storage-progress');
const step=document.getElementById('storage-step');
let preparing=false,wasBusy=false;
function controls(busy){document.querySelectorAll('[data-operation]').forEach(button=>{button.disabled=busy;});}
async function startOperation(id){
  if(preparing)return;preparing=true;controls(true);output.textContent='';
  try{const result=await window.installstreet.maintenanceStart(id);if(result.canceled)status.textContent='Canceled. No maintenance command was started.';}
  catch(error){status.textContent=error.message;}
  finally{preparing=false;controls(false);}
}
document.getElementById('storage-run-all').addEventListener('click',()=>startOperation('run-all'));
window.installstreet.onMaintenanceLog(text=>{output.textContent+=text+'\n';if(output.textContent.length>250000)output.textContent=output.textContent.slice(-200000);output.scrollTop=output.scrollHeight;});
window.installstreet.onMaintenanceState(state=>{
  if(state.busy && !wasBusy)document.getElementById('storage-status').scrollIntoView({block:'nearest'});wasBusy=state.busy;
  controls(state.busy);document.body.classList.toggle('busy',state.busy);
  if(state.message)status.textContent=state.message;
  if(state.total)step.textContent=`${state.completed||0} / ${state.total} steps`;
  if(state.busy){progress.removeAttribute('value');document.getElementById('storage-result').textContent='In progress';}
  else {progress.value=state.ok?100:0;document.getElementById('storage-result').textContent=state.restart?'Restart needed':state.ok?'Finished':'Needs attention';}
});
window.installstreet.onMaintenanceProgress(value=>{progress.value=value;});
(async()=> {
  try {
    const catalog=await window.installstreet.maintenanceCatalog();
    const root=document.getElementById('operations');
    for(const group of ['Check','Repair','Cleanup']){
      const section=document.createElement('section');section.className='maintenance-group';
      const heading=document.createElement('h2');heading.textContent=group;section.append(heading);
      const grid=document.createElement('div');grid.className='maintenance-cards';section.append(grid);
      for(const operation of catalog.filter(item=>item.group===group)){
        const card=document.createElement('article');card.className='maintenance-card';
        const title=document.createElement('h3');title.textContent=operation.name;
        const description=document.createElement('p');description.textContent=operation.description;
        const command=document.createElement('div');command.className='command';command.textContent=operation.commands.join(' → ');
        const button=document.createElement('button');button.textContent=group==='Check'?'Run check':group==='Repair'?'Run repair':'Open / run cleanup';button.dataset.operation=operation.id;
        button.addEventListener('click',()=>startOperation(operation.id));
        card.append(title,description,command,button);grid.append(card);
      }
      root.append(section);
    }
  }catch(error){status.textContent=error.message;}
})();
for(const [id,action] of [['storage-settings','settings'],['storage-logs','logs'],['dism-log','dism'],['cbs-log','cbs']]){
  document.getElementById(id).addEventListener('click',async()=>{try{const error=await window.installstreet.maintenanceOpen(action);if(error)status.textContent=error;}catch(error){status.textContent=error.message;}});
}
