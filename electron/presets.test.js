const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {selection,preset,createPresetStore}=require('./presets');
const {firstRun,answerFile,literal}=require('./media');
test('Oscdimg setup must succeed and return an existing tool before ISO creation',async()=>{
  const {ensureOscdimg}=require('./media');
  let calls=0;
  assert.equal(await ensureOscdimg('backend','data',()=>{},async(exe,args)=>{calls++;assert.ok(exe.endsWith('OscdimgSetup.exe'));assert.deepEqual(args,['data']);return 'setup output\nOSCDIMG_PATH='+__filename+'\r\n';}),__filename);
  assert.equal(calls,1);
  await assert.rejects(ensureOscdimg('backend','data',()=>{},async()=>{throw new Error('signature rejected');}),/signature rejected/);
  await assert.rejects(ensureOscdimg('backend','data',()=>{},async()=>''),/did not return/);
});
test('media stages only deployment payload and emits BIOS/UEFI ISO arguments',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'installstreet-media-'));
  try{
    const files=['InstallStreet.Cli.exe','TaskRuntime.dll','AppL/GoogleChrome.dll','DisplayCity/DarkMode.dll','DisplayCity/Wallpaper.dll','DisplayCity/ConsumerFeatures.dll','Files/showHiddenFiles.dll','Files/showFileExtensions.dll','VaultHouse/RunningIcon.dll','VaultHouse/Appointer/desktopn.dll','VaultHouse/Guards/LinkedInRemoval.dll','VaultHouse/icons/.running/running.ico','update-settings.json'];
    for(const name of files){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),'fixture');}
    let mountScript;
    const result=await require('./media').buildMedia({root,dataRoot:root,iso:"C:\\it's.iso",oscdimg:'oscdimg.exe',value:{version:1,name:'Test',windows:'11',tasks:['chrome']},log:()=>{},
      runPowerShell:async script=>{mountScript=script;const jobs=await fs.readdir(path.join(root,'Media'));const media=path.join(root,'Media',jobs[0],'source');for(const name of ['boot/etfsboot.com','efi/microsoft/boot/efisys.bin']){await fs.mkdir(path.dirname(path.join(media,name)),{recursive:true});await fs.writeFile(path.join(media,name),'boot');}},
      runCommand:async(exe,args)=>{assert.equal(exe,'oscdimg.exe');assert.ok(args.some(a=>a.startsWith('-bootdata:2#p0,e,b')&&a.includes('#pEF,e,b')));await fs.writeFile(args.at(-1),'ISO fixture');}
    });
    const media=path.join(path.dirname(result),'source');const payload=path.join(media,'sources','$OEM$','$1','InstallStreet');
    assert.equal((await fs.readFile(path.join(payload,'preset.json'),'utf8')).includes('chrome'),true);
    await assert.rejects(fs.access(path.join(payload,'update-settings.json')));
    assert.match(mountScript,/finally/);assert.match(mountScript,/Dismount-DiskImage/);assert.match(mountScript,/22000/);
    assert.equal(await fs.readFile(path.join(media,'autounattend.xml'),'utf8'),answerFile());
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('selection includes only chosen tasks and their deduplicated dependencies',()=>{
  assert.deepEqual(selection(['gh','git','iloader']),['winget','git','gh','itunes','iloader']);
  assert.deepEqual(selection(['chrome']),['chrome']);
  for(const invalid of [[],['all'],['chrome;shutdown'],null,['__proto__']])assert.throws(()=>selection(invalid));
});
test('presets round-trip, update, delete and reject paths and executable fields',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'installstreet-presets-'));
  try{const store=createPresetStore(folder);const p=await store.save({version:1,name:'Gaming',windows:'11',tasks:['roblox'],token:'secret'});
    assert.equal(p.token,undefined);assert.deepEqual((await store.list())[0],p);
    await store.save({...p,name:'Work',tasks:['vscode']},p.id);assert.equal((await store.list())[0].name,'Work');
    await assert.rejects(store.save(p,'../../escape'));await assert.rejects(store.remove('../escape'));
    await store.remove(p.id);assert.deepEqual(await store.list(),[]);
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('media bootstrap uses validated tasks, elevation and successful completion marker',()=>{
  const value={version:1,name:'<untrusted>',windows:'10',tasks:['gh']};
  const script=firstRun(value);assert.match(script,/--run 'winget,git,gh'/);assert.match(script,/-Verb RunAs/);assert.match(script,/LASTEXITCODE -eq 0/);assert.ok(!script.includes('<untrusted>'));
  const xml=answerFile();assert.ok(xml.includes('%SystemDrive%\\InstallStreet\\RunPreset.ps1'));assert.ok(!xml.includes('DiskConfiguration'));assert.ok(!xml.includes('AutoLogon'));
  assert.equal(literal("C:\\it's.iso"),"'C:\\it''s.iso'");
  assert.throws(()=>preset({...value,windows:'12'}));assert.throws(()=>firstRun({...value,tasks:['chrome\nshutdown']}));
});
