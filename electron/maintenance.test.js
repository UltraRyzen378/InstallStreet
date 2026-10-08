const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {MaintenanceRunner,operation,publicCatalog}=require('./maintenance');
function child(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();return c;}
test('operation catalog is an allowlist without destructive cleanup or reboot flags',()=>{
  assert.throws(()=>operation('anything & shutdown'),/Unknown/);
  for(const item of publicCatalog()){
    for(const step of operation(item.id).steps){assert.equal(step.args.includes('/ResetBase'),false);assert.equal(step.args.includes('/x'),false);assert.equal(step.args.includes('/r'),false);}
  }
  assert.ok(operation('component-cleanup').confirmation);
  assert.ok(operation('repair-windows').confirmation);
});
test('repair sequence runs DISM before SFC and streams split UTF-16 output',async()=>{
  const children=[],calls=[],logs=[];
  const runner=new MaintenanceRunner((file,args,options)=>{const c=child();children.push(c);calls.push({file,args,options});return c;},()=>true);
  runner.on('log',text=>logs.push(text));
  const pending=runner.start('repair-windows');
  assert.match(calls[0].file,/dism\.exe$/i);assert.equal(calls[0].options.shell,false);
  children[0].stdout.write('[ 50.0% ]\r');children[0].emit('close',0);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(calls[1].file,/sfc\.exe$/i);
  const bytes=Buffer.from('\uFEFFVerification complete\r\n','utf16le');
  children[1].stdout.write(bytes.subarray(0,1));children[1].stdout.write(bytes.subarray(1));children[1].emit('close',0);
  assert.equal((await pending).ok,true);assert.ok(logs.includes('Verification complete'));
});
test('DISM failure or restart request stops before SFC',async()=>{
  for(const code of [5,3010]){
    const c=child();let calls=0;
    const runner=new MaintenanceRunner(()=>{calls++;return c;},()=>true);
    const pending=runner.start('repair-windows');c.emit('close',code);
    const result=await pending;assert.equal(calls,1);assert.equal(result.restart,code===3010);assert.equal(result.ok,code===3010);
  }
});
test('rejects concurrent operations and recovers after child errors',async()=>{
  const c=child();const runner=new MaintenanceRunner(()=>c,()=>true);
  const pending=runner.start('scan-health');
  await assert.rejects(runner.start('check-health'),/already active/);
  c.emit('error',new Error('fixture failure'));await assert.rejects(pending,/fixture failure/);assert.equal(runner.busy,false);
});
test('missing Windows tool fails without launching a process',async()=>{
  let called=false;const runner=new MaintenanceRunner(()=>{called=true;},()=>false);
  await assert.rejects(runner.start('check-health'),/not found/);assert.equal(called,false);
});
test('Run All executes each command once, accepts CHKDSK status, and opens interactive cleanup last',async()=>{
  const calls=[];
  const runner=new MaintenanceRunner((file,args,options)=>{
    const c=child();calls.push({file,args,options});
    setImmediate(()=>c.emit('close',file.endsWith('chkdsk.exe')?1:0));return c;
  },()=>true);
  assert.ok(operation('run-all').confirmation);
  assert.equal((await runner.start('run-all')).ok,true);
  assert.equal(calls.length,9);
  assert.deepEqual(calls.map(call=>call.args),operation('run-all').steps.map(step=>step.args));
  assert.equal(calls.filter(call=>call.args.includes('/RestoreHealth')).length,1);
  assert.equal(calls.filter(call=>call.args.includes('/scannow')).length,1);
  assert.match(calls.at(-1).file,/cleanmgr\.exe$/i);
  assert.equal(calls.at(-1).options.windowsHide,false);
});
test('Run All halts on failure or restart before later repairs and cleanup',async()=>{
  for(const code of [5,3010]){
    let calls=0;
    const runner=new MaintenanceRunner(()=>{const c=child();calls++;setImmediate(()=>c.emit('close',calls===6?code:0));return c;},()=>true);
    const result=await runner.start('run-all');
    assert.equal(calls,6);assert.equal(result.restart,code===3010);assert.equal(result.ok,code===3010);
  }
});
