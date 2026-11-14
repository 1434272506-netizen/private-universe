import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {providedPhotoImport,memories} from '../src/personal-content.js';
import {photoInspirations} from '../src/memory-display.js';
import {clickTreeRibbon} from './review-ribbon-helpers.mjs';
import {waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,currentPhoto} from './review-photo-helpers.mjs';

const out=resolve('work/qa/delivery');await mkdir(out,{recursive:true});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const zip=resolve('release/我们的私家宇宙-离线礼物版.zip'),extract=join(out,'解压测试 有空格');
const unpack=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(extract)} -Force`;
const unpacked=spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(unpack,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
assert.equal(unpacked.status,0,unpacked.stderr);
const root=join(extract,'我们的私家宇宙'),manifest=JSON.parse(await readFile(join(root,'release-manifest.json'),'utf8'));
for(const file of manifest.files){const bytes=await readFile(join(root,file.path));assert.equal(bytes.length,file.bytes,file.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);}
assert.ok(!manifest.files.some(f=>/(^|\/)(src|node_modules|\.git)(\/|$)/.test(f.path)));
assert.ok((await readFile(join(root,'launcher.ps1'))).subarray(0,3).equals(Buffer.from([239,187,191])));
assert.match(await readFile(join(root,'双击开启我们的私家宇宙.bat'),'utf8'),/chcp 65001/);
console.log('PASS ZIP extracted under a Chinese path with spaces; all file hashes match; no source/dependencies; PowerShell UTF-8 BOM and BAT encoding');

const children=[],observations={files:manifest.files.length,contentSha256:manifest.contentSha256};
function start(port,transport,bat=false){
 const child=bat?spawn(process.env.ComSpec||'cmd.exe',['/d','/c',`call .\\双击开启我们的私家宇宙.bat -NoBrowser -Port ${port} -Transport ${transport}`],{cwd:root,windowsHide:true,windowsVerbatimArguments:true,stdio:['ignore','pipe','pipe']}):spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'launcher.ps1'),'-NoBrowser','-Port',String(port),'-Transport',transport],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);children.push(child);return {child,get output(){return output;}};
}
async function ready(port,process){
 for(let i=0;i<100;i++){
  if(process.child.exitCode!==null)throw new Error(`Launcher stopped: ${process.output}`);
  try{const r=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(1000)});if(r.ok)return r;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }throw new Error(`Launcher not ready: ${process.output}`);
}
function stop(child){if(child.exitCode===null)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}
async function assertStopped(port){
 for(let i=0;i<30;i++){try{await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(500)});}catch{return;}await new Promise(r=>setTimeout(r,100));}
 throw new Error(`Server remained active after its console/process closed: ${port}`);
}
const fixtures={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',mjs:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',manifest:'application/json; charset=utf-8',glb:'model/gltf-binary',gltf:'model/gltf+json',bin:'application/octet-stream',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',svg:'image/svg+xml',mp3:'audio/mpeg',unknown:'application/octet-stream'};
await mkdir(join(root,'qa-fixtures'),{recursive:true});for(const ext of Object.keys(fixtures))await writeFile(join(root,'qa-fixtures',`test.${ext}`),'test');
async function checkHTTP(port,transport){
 const base=`http://127.0.0.1:${port}`;
 for(const [ext,type] of Object.entries(fixtures)){const r=await fetch(`${base}/qa-fixtures/test.${ext}`);assert.equal(r.status,200,ext);assert.equal(r.headers.get('content-type'),type,ext);assert.equal(r.headers.get('x-garden-transport'),transport);assert.equal(await r.text(),'test');}
 const model=await fetch(`${base}/models/love-tree.glb?v=test`);assert.equal(model.headers.get('content-type'),'model/gltf-binary');assert.equal(createHash('sha256').update(Buffer.from(await model.arrayBuffer())).digest('hex'),manifest.files.find(f=>f.path==='models/love-tree.glb').sha256);
 const range=await fetch(`${base}/models/love-tree.glb`,{headers:{Range:'bytes=0-3'}});assert.equal(range.status,206);assert.equal(await range.text(),'glTF');
 const suffix=await fetch(`${base}/index.html`,{headers:{Range:'bytes=-4'}});assert.equal(suffix.status,206);assert.equal((await suffix.arrayBuffer()).byteLength,4);
 const head=await fetch(`${base}/index.html`,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await fetch(`${base}/models/missing.glb`)).status,404);
 assert.equal((await fetch(`${base}/a-saved-place`)).headers.get('content-type'),'text/html; charset=utf-8');
 const outside=await fetch(`${base}/%2e%2e/%2e%2e/package.json`);assert.ok([400,403,404].includes(outside.status));
 console.log(`PASS ${transport}: 16 strict MIME mappings, actual GLB SHA-256, GET/HEAD/ranges, missing-asset 404 and root confinement`);
}
try{
 const primary=start(18765,'HttpListener');await ready(18765,primary);await checkHTTP(18765,'HttpListener');
 const occupied=start(18765,'Auto');const alternate=await ready(18766,occupied);assert.ok(alternate.ok);stop(occupied.child);await assertStopped(18766);observations.busyPortFallback=true;
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[],remote=[],bad=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith('http://127.0.0.1:18765/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();remote.push(url);return route.abort();});
  await page.goto('http://127.0.0.1:18765/');await page.locator('#enter-direct').click({timeout:90000});await waitForContentReady(page);await clickTreeRibbon(page);
  for(let i=0;i<10;i++){
   await waitForPhotoPage(page,i+1,10);assert.ok(await currentPhoto(page).evaluate(el=>el.complete&&el.naturalWidth>0));
   await page.locator('.photo-flip-trigger').click();assert.equal(await page.locator('.photo-back-title').textContent(),photoInspirations[memories[i].id].title);assert.equal(await page.locator('.photo-back-text').textContent(),memories[i].caption);
   if(i===0||i===9)await page.screenshot({path:join(out,`offline-photo-back-${i+1}.png`)});
   await page.locator('.photo-flip-back-trigger').click();if(i<9)await page.locator('.album-next').click();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);assert.deepEqual(remote,[]);observations.browser={photos:10,allTitlesAndBackNotes:true,errors,failedHTTP:bad,remoteRequests:remote};
  console.log('PASS truly offline: external network blocked, 3D garden and real ribbon click, all 10 photo backs match latest titles/notes, console.error=0, pageerror=0');
 }finally{await browser.close();}
 stop(primary.child);await assertStopped(18765);
 const tcp=start(18767,'Tcp');await ready(18767,tcp);await checkHTTP(18767,'Tcp');stop(tcp.child);await assertStopped(18767);
 const bat=start(18769,'Tcp',true);await ready(18769,bat);assert.equal((await fetch('http://127.0.0.1:18769/')).headers.get('content-type'),'text/html; charset=utf-8');assert.match(bat.output,/亲爱的，花园正在打开/);assert.doesNotMatch(bat.output,/not recognized|不是内部|无法识别/i);stop(bat.child);await assertStopped(18769);
 observations.consoleLifecycle=true;observations.httpListener=true;observations.nativeFallback=true;observations.bat=true;
 console.log('PASS UTF-8 BAT invocation; native fallback; closing owned console/process trees stops all listening endpoints');
}finally{
 for(const child of children)stop(child);
 await writeFile(join(out,'launcher-result.json'),JSON.stringify(observations,null,2));
}
