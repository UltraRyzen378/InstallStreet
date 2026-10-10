const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { StringDecoder } = require('node:string_decoder');
const root = process.env.SystemRoot || 'C:\\Windows';
const system = path.join(root, 'System32');
const volume = /^[a-z]:$/i.test(process.env.SystemDrive || '') ? process.env.SystemDrive : 'C:';
const dism = action => ({ file: path.join(system, 'dism.exe'), args: ['/Online','/Cleanup-Image',action,'/NoRestart','/English'], label: 'DISM ' + action });
const sfc = action => ({ file: path.join(system,'sfc.exe'), args: [action], label: 'SFC ' + action });
const catalog = [
  { id:'check-health', name:'Quick image check', group:'Check', description:'Checks whether Windows has already recorded image corruption.', steps:[dism('/CheckHealth')] },
  { id:'scan-health', name:'Scan Windows image', group:'Check', description:'Scans the component store for corruption. Can take several minutes.', steps:[dism('/ScanHealth')] },
  { id:'analyze-store', name:'Analyze component storage', group:'Check', description:'Reports component-store size and whether cleanup is recommended.', steps:[dism('/AnalyzeComponentStore')] },
  { id:'verify-files', name:'Verify system files', group:'Check', description:'Checks protected system files without repairing them.', steps:[sfc('/verifyonly')] },
  { id:'scan-disk', name:'Online disk scan', group:'Check', description:'Runs CHKDSK /scan on the Windows volume. No forced dismount or scheduled reboot.', steps:[{ file:path.join(system,'chkdsk.exe'), args:[volume,'/scan'], label:'CHKDSK online scan', accepted:[0,1] }] },
  { id:'restore-health', name:'Repair Windows image', group:'Repair', description:'Repairs image corruption using Windows Update when needed.', confirmation:'Repair the running Windows image? DISM may download repair files through Windows Update. No automatic restart is requested.', steps:[dism('/RestoreHealth')] },
  { id:'repair-files', name:'Repair system files', group:'Repair', description:'Runs SFC to repair protected system files.', confirmation:'Scan and repair protected Windows system files? Review the output afterward for any unrepaired files.', steps:[sfc('/scannow')] },
  { id:'repair-windows', name:'Repair Windows', group:'Repair', description:'Runs DISM RestoreHealth, followed by SFC. Continues after failures and records restart requests.', confirmation:'Run DISM RestoreHealth and then SFC? This changes Windows system files and may use Windows Update. No automatic restart will occur.', steps:[dism('/RestoreHealth'),sfc('/scannow')] },
  { id:'component-cleanup', name:'Clean superseded components', group:'Cleanup', description:'Runs supported component cleanup without ResetBase.', confirmation:'Remove superseded Windows components with DISM StartComponentCleanup? No ResetBase, user-file deletion, or automatic restart is included.', steps:[dism('/StartComponentCleanup')] },
  { id:'disk-cleanup', name:'Windows Disk Cleanup', group:'Cleanup', description:'Opens the Windows cleanup dialog. You choose which categories to delete.', steps:[{ file:path.join(system,'cleanmgr.exe'), args:['/d',volume.slice(0,1)], label:'Windows Disk Cleanup', interactive:true }] }
];
catalog.push({ id:'run-all', name:'Run All', group:'All', description:'Checks Windows, repairs the image and system files, then cleans up.', confirmation:'Run all StorageSense checks, repairs, and cleanup in sequence? DISM may download repair files. Superseded components will be removed, and Windows Disk Cleanup will ask you to choose categories. Continues after failed steps or restart requests. No automatic restart will occur.', steps:catalog.filter(item=>item.id!=='repair-windows').flatMap(item=>item.steps) });
function operation(id) {
  const value = catalog.find(item => item.id === id);
  if (!value) throw new Error('Unknown StorageSense operation.');
  return value;
}
function publicCatalog() { return catalog.map(({ steps, ...item }) => ({ ...item, commands: steps.map(step => step.label) })); }
class MaintenanceRunner extends EventEmitter {
  constructor(spawnProcess=spawn, exists=fs.existsSync) { super();this.spawnProcess=spawnProcess;this.exists=exists;this.busy=false; }
  async start(id) {
    const selected=operation(id);
    if(this.busy)throw new Error('A maintenance operation is already active.');
    this.busy=true;
    this.emit('state',{busy:true,name:selected.name,completed:0,total:selected.steps.length,percent:null,message:'Starting '+selected.name+'…'});
    let code=0,restart=false,completed=0,ok=true;
    const results=[];
    try {
      for(let index=0;index<selected.steps.length;index++) {
        const step=selected.steps[index];
        this.emit('state',{busy:true,name:selected.name,completed:index,total:selected.steps.length,percent:null,message:step.label});
        this.emit('log','\n> '+path.basename(step.file)+' '+step.args.join(' '));
        let stepCode=null,error=null;
        try { stepCode=await this.run(step); } catch(failure) { error=failure.message;this.emit('log',error); }
        completed=index+1;
        this.emit('log','Exit code: '+stepCode);
        const passed=!error && (stepCode===3010 || (step.accepted || [0]).includes(stepCode));
        results.push({name:step.label,code:stepCode,ok:passed,error});
        if(stepCode===3010){restart=true;this.emit('log','Windows requested a restart. Continuing remaining tasks; restart manually afterward.');}
        if(!passed){ok=false;if(code===0)code=stepCode || 1;this.emit('log','Task failed. Continuing with the next task.');}
      }
      this.emit('log','\nSummary:');
      results.forEach(item=>this.emit('log',(item.ok?'[DONE] ':'[FAILED] ')+item.name+(item.error?': '+item.error:'')));
      const result={code:ok?(restart?3010:0):code,ok,restart,results,message:(ok?'All tasks finished. Review the output.':results.filter(item=>!item.ok).length+' task(s) failed; all remaining tasks were attempted.')+(restart?' Restart Windows manually.':'')};
      this.emit('state',{busy:false,name:selected.name,completed,total:selected.steps.length,percent:null,...result});
      return result;
    } catch(error) {
      this.emit('log',error.message);this.emit('state',{busy:false,name:selected.name,code:null,ok:false,message:error.message});throw error;
    } finally { this.busy=false; }
  }
  run(step) {
    if(!this.exists(step.file))return Promise.reject(new Error('Windows tool was not found: '+step.file));
    return new Promise((resolve,reject)=> {
      let child;
      try {child=this.spawnProcess(step.file,step.args,{shell:false,windowsHide:!step.interactive,stdio:['ignore','pipe','pipe']});}
      catch(error){reject(error);return;}
      const buffers=new Map(),decoders=new Map(),initial=new Map();
      const line=text=> {
        text=text.replace(/^\uFEFF/,'');this.emit('log',text);
        const match=text.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
        if(match)this.emit('progress',Math.min(100,Number(match[1])));
      };
      const consume=(stream,text,final=false)=> {
        const parts=((buffers.get(stream)||'')+text).split(/\r\n|\r|\n/);buffers.set(stream,parts.pop());parts.forEach(line);
        if(final && buffers.get(stream)){line(buffers.get(stream));buffers.set(stream,'');}
      };
      for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=> {
        if(!decoders.has(stream)) {
          const pending=Buffer.concat([initial.get(stream)||Buffer.alloc(0),bytes]);initial.set(stream,pending);
          if(pending.length<4)return;
          const unicode=(pending[0]===255 && pending[1]===254) || pending.subarray(0,40).some((value,index)=>index%2===1 && value===0);
          const decoder=new StringDecoder(unicode?'utf16le':'utf8');decoders.set(stream,decoder);initial.delete(stream);consume(stream,decoder.write(pending));
        } else consume(stream,decoders.get(stream).write(bytes));
      });
      let finished=false;
      child.once('error',error=>{if(!finished){finished=true;reject(error);}});
      child.once('close',exit=> {
        if(finished)return;finished=true;
        for(const stream of [child.stdout,child.stderr]) {
          if(decoders.has(stream))consume(stream,decoders.get(stream).end(),true);
          else consume(stream,(initial.get(stream)||Buffer.alloc(0)).toString('utf8'),true);
        }
        resolve(exit);
      });
    });
  }
}
module.exports={MaintenanceRunner,operation,publicCatalog};
