const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {Updates,compareVersions,hashFile}=require('./updates');
const {createUpdateSettings}=require('./update-settings');
const fixtureRoot=path.resolve(__dirname,'../tmp/update-tests');
async function fixture(t){const root=path.join(fixtureRoot,crypto.randomUUID());await fs.mkdir(root,{recursive:true});t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
const encryption={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('encrypted:'+value),decryptString:bytes=>bytes.toString().slice(10)};
test('settings persist explicit opt-ins and encrypted token without returning the secret',async t=>{
 const root=await fixture(t),store=createUpdateSettings(root,encryption);
 assert.equal((await store.load()).checkOnStartup,false);
 const value=await store.save({checkOnStartup:true,autoDownload:true,autoInstall:false,token:'fixture-secret'});
 assert.equal(value.tokenConfigured,true);assert.equal(JSON.stringify(value).includes('fixture-secret'),false);
 const serialized=await fs.readFile(path.join(root,'update-settings.json'),'utf8');assert.equal(serialized.includes('fixture-secret'),false);
 const second=createUpdateSettings(root,encryption);await second.load();assert.equal(second.token(),'fixture-secret');
 await second.save({checkOnStartup:false,autoDownload:false,autoInstall:false,clearToken:true});assert.equal(second.token(),null);
});
test('settings reject unencrypted credentials and inconsistent automatic modes',async t=>{
 const store=createUpdateSettings(await fixture(t),{...encryption,isEncryptionAvailable:()=>false});
 await assert.rejects(store.save({checkOnStartup:true,autoDownload:true,autoInstall:true,token:'secret'}),/encryption/);
 await assert.rejects(store.save({checkOnStartup:false,autoDownload:false,autoInstall:true}),/requires/);
 assert.equal(store.view().autoInstall,false);
});
test('stable versions compare numerically and reject prerelease strings',()=>{
 assert.equal(compareVersions('1.10.0','1.9.0'),1);assert.equal(compareVersions('1.0.0','1.0.0'),0);assert.equal(compareVersions('1.0.0','2.0.0'),-1);assert.throws(()=>compareVersions('1.0.1-beta','1.0.0'));
});
function release(version='1.4.0'){return {tag_name:'v'+version,draft:false,prerelease:false,assets:[{name:`InstallStreet-${version}-x64.msi`,id:11},{name:'SHA256SUMS.txt',id:12}]};}
test('checks private releases through fixed GitHub endpoints and rejects drafts or missing payloads',async t=>{
 const calls=[];let value=release();
 const updater=new Updates({version:'1.3.0',root:await fixture(t),settings:{token:()=> 'fixture-token'},request:async(url,options)=>{calls.push({url,options});return Response.json(value);}});
 assert.equal((await updater.check()).phase,'available');assert.equal(calls[0].url,'https://api.github.com/repos/UltraRyzen378/InstallStreet/releases/latest');assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');
 value={...release(),draft:true};await assert.rejects(updater.check(),/stable/);
 value={...release(),assets:[]};await assert.rejects(updater.check(),/missing/);
 value=release('1.2.0');assert.equal((await updater.check()).phase,'current');assert.equal(updater.downloaded,null);
});
test('download validates checksum before allowing installation and removes mismatched payloads',async t=>{
 const bytes=Buffer.from('fixture MSI payload'),hash=crypto.createHash('sha256').update(bytes).digest('hex');let correct=true;
 const updater=new Updates({version:'1.3.0',root:await fixture(t),settings:{token:()=>null},request:async url=>{
  if(url.endsWith('/latest'))return Response.json(release());
  if(url.endsWith('/12'))return new Response(`${correct?hash:'0'.repeat(64)}  InstallStreet-1.4.0-x64.msi\n`);
  return new Response(bytes);
 }});
 await updater.check();await updater.download();assert.equal(await hashFile(updater.downloaded.installer),hash);assert.equal(updater.state.phase,'ready');
 correct=false;await assert.rejects(updater.download(),/checksum/);assert.equal(updater.downloaded,null);assert.equal(updater.busy,false);
});
test('authentication failure is actionable without exposing credentials',async t=>{
 const updater=new Updates({version:'1.3.0',root:await fixture(t),settings:{token:()=> 'fixture-secret'},request:async()=>new Response('',{status:404})});
 await assert.rejects(updater.check(),/private repository/);assert.equal(updater.state.message.includes('fixture-secret'),false);assert.equal(updater.busy,false);
});
test('overlapping update requests are rejected',async t=>{
 let resolve;const updater=new Updates({version:'1.3.0',root:await fixture(t),settings:{token:()=>null},request:()=>new Promise(done=>{resolve=done;})});
 const pending=updater.check();await assert.rejects(updater.check(),/already active/);resolve(Response.json(release()));await pending;
});
