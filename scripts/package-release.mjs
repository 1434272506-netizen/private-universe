import {cp,lstat,mkdir,readFile,realpath,rename,rm,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

if(process.platform!=='win32')throw new Error('免环境 ZIP 使用 Windows 自带 Compress-Archive 打包，请在 Windows 10/11 或 CI 的 windows-latest 运行。');
const root=fileURLToPath(new URL('../',import.meta.url));
for(const command of ['npm run check:content','npm run build']){
  const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{cwd:root,env:{...process.env,GARDEN_BASE_PATH:'/'},stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
// Only this explicitly named generated gift directory can be replaced.
const releaseRoot=resolve(root,'release'),gift=resolve(releaseRoot,'我们的私家宇宙');
if(dirname(gift)!==releaseRoot)throw new Error('发布目录越界。');
for(const path of [releaseRoot,gift]){
  const info=await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if(info?.isSymbolicLink())throw new Error(`发布目录不能是符号链接或目录联接：${path}`);
}
await mkdir(releaseRoot,{recursive:true});
if(dirname(await realpath(releaseRoot))!==(await realpath(root)))throw new Error('发布目录的实际位置不在项目内。');
await rm(gift,{recursive:true,force:true});
await cp(join(root,'dist'),gift,{recursive:true,errorOnExist:true,force:false});
const zip=join(releaseRoot,'我们的私家宇宙-离线礼物版.zip');
const temporary=join(releaseRoot,`.gift-${process.pid}.zip`);
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const script=`$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Compress-Archive -LiteralPath ${quote(gift)} -DestinationPath ${quote(temporary)} -CompressionLevel Optimal -Force`;
try{
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Compress-Archive 失败，退出码 ${result.status}。`);
  await rm(zip,{force:true});await rename(temporary,zip);
}finally{await rm(temporary,{force:true});}
const {fileInventory}=await import('./prepare-release.mjs');
const files=await fileInventory(gift);
const summary={zip,zipBytes:(await stat(zip)).size,zipSha256:createHash('sha256').update(await readFile(zip)).digest('hex'),directory:gift,files,totalBytes:files.reduce((n,file)=>n+file.bytes,0),contentSha256:JSON.parse(await readFile(join(gift,'release-manifest.json'),'utf8')).contentSha256};
await writeFile(join(releaseRoot,'打包摘要.json'),JSON.stringify(summary,null,2)+'\n');
console.log(`\n礼物包已生成：${zip}\nZIP：${summary.zipBytes.toLocaleString()} bytes\n解压目录：${gift}\n文件清单：`);
for(const file of files)console.log(`  ${file.path}  ${file.bytes.toLocaleString()} bytes`);
console.log(`共 ${files.length} 个文件，解压后 ${summary.totalBytes.toLocaleString()} bytes。\n同一份 dist 可上传 Netlify Drop；main 推送会自动生成离线包并部署 Pages。`);
