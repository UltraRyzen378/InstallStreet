const optionalSettings=[['remove-linkedin','Remove LinkedIn'],['consumer-features','Disable promoted apps'],['wallpaper','Set wallpaper'],['dark-mode','Dark mode'],['hidden-files','Show hidden files'],['file-extensions','Show file extensions'],['desktop-apps','Desktop shortcuts'],['running-icon','.running icon']];
for(const [id,name] of optionalSettings){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=id;input.className='task-choice';label.append(input,document.createTextNode(name));document.getElementById('setting-roster').append(label);}
window.selectedTasks=()=>Array.from(document.querySelectorAll('.task-choice:checked'),input=>input.value);
const field=id=>document.getElementById(id);
const value=()=>({version:1,name:field('preset-name').value,windows:field('preset-windows').value,tasks:window.selectedTasks()});
let saved=[],mediaWorking=false,setupWorking=false;
function lock(){document.querySelectorAll('.task-choice,.preset-panel input,.preset-panel select,.preset-panel button').forEach(el=>{el.disabled=mediaWorking||setupWorking;});field('media-flash').disabled=mediaWorking||setupWorking||!field('media-flash').dataset.ready;['run','check','retry','finish'].forEach(id=>field(id).disabled=mediaWorking||setupWorking);}
function countSelection(){field('selection-count').textContent=window.selectedTasks().length+' selected';}
document.querySelectorAll('.task-choice').forEach(input=>input.addEventListener('change',countSelection));
async function refresh(id=''){saved=await window.installstreet.presets('list');field('preset-list').replaceChildren(new Option('New preset',''),...saved.map(p=>new Option(p.name,p.id)));field('preset-list').value=id;}
function load(p){field('preset-name').value=p?.name||'';field('preset-windows').value=p?.windows||'11';document.querySelectorAll('.task-choice').forEach(el=>{el.checked=p?.tasks.includes(el.value)||false;});countSelection();}
field('preset-list').addEventListener('change',()=>load(saved.find(p=>p.id===field('preset-list').value)));
function action(id,fn){field(id).addEventListener('click',async()=>{try{await fn();}catch(error){field('media-status').textContent=error.message;}});}
action('preset-save',async()=>{const p=await window.installstreet.presets('save',value(),field('preset-list').value||undefined);await refresh(p.id);field('media-status').textContent='Preset saved.';});
action('preset-export',()=>window.installstreet.presets('export',value()));
action('preset-import',async()=>{const p=await window.installstreet.presets('import');if(p){await refresh(p.id);load(p);}});
action('preset-delete',async()=>{const id=field('preset-list').value;if(!id)return;await window.installstreet.presets('delete',null,id);await refresh();load(null);});
action('media-build',async()=>{
  mediaWorking=true;delete field('media-flash').dataset.ready;lock();field('media-status').textContent='Preparing Windows media…';
  try{const iso=await window.installstreet.buildMedia(value());field('media-status').textContent=iso?'ISO ready: '+iso:'Media preparation canceled.';if(iso)field('media-flash').dataset.ready='true';}
  finally{mediaWorking=false;lock();}
});
action('media-flash',async()=>{const message=await window.installstreet.flashMedia();if(message)field('media-status').textContent=message;});
window.installstreet.onState(state=>{setupWorking=state.busy;lock();});
refresh().catch(error=>{field('media-status').textContent=error.message;});
