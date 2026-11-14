import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {memories,letters,providedPhotoImport} from '../src/personal-content.js';
import {photoInspirations} from '../src/memory-display.js';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export async function fileInventory(directory,prefix=''){
  const files=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const relative=prefix+entry.name,path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await fileInventory(path,relative+'/'));
    else if(entry.isFile()){
      const data=await readFile(path);files.push({path:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
    }else throw new Error(`发布目录中不能包含链接或特殊文件：${relative}`);
  }
  return files;
}

export async function prepareRelease(){
const dist=join(projectRoot,'dist');
await mkdir(dist,{recursive:true});
for(const name of ['双击开启我们的私家宇宙.bat','launcher.ps1']){
  const text=(await readFile(join(projectRoot,'release-assets',name),'utf8')).replace(/^\uFEFF/,'').replace(/\r?\n/g,'\r\n');
  // Windows PowerShell 5.1 needs a BOM for Chinese; cmd needs an ASCII first
  // line and chcp 65001 before it reads the Chinese title/prompt instead.
  await writeFile(join(dist,name),(name.endsWith('.ps1')?'\uFEFF':'')+text,'utf8');
}
await writeFile(join(dist,'写给你的说明.txt'),'\uFEFF亲爱的，双击『双击开启我们的私家宇宙.bat』就能打开我们的花园啦~ 浏览器加载完后，请勿关闭黑色的窗口哦，想退出时直接关掉即可 ❤️\r\n\r\n请先把整个 ZIP 解压到一个文件夹里，再双击启动；不要直接打开 index.html，也不要只取出一个启动文件。\r\n电脑不需要安装 Node.js、Git 或 Python。花园只在这台电脑的本地地址打开，断网也可以玩。\r\n如果 8765 端口正忙，窗口会显示另一个可用地址，并自动打开浏览器。\r\n自己添加的照片和文字保存在当前浏览器里，换浏览器或换设备时请使用收藏面板的备份功能。\r\n','utf8');
await writeFile(join(dist,'.nojekyll'),'');
await writeFile(join(dist,'_redirects'),'/* /index.html 200\n');
let sourceCommit=null;
try{sourceCommit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:projectRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const files=(await fileInventory(dist)).filter(file=>file.path!=='release-manifest.json');
const contentSha256=createHash('sha256').update(JSON.stringify({memories,letters,providedPhotoImport,photoInspirations})).digest('hex');
await writeFile(join(dist,'release-manifest.json'),JSON.stringify({sourceCommit,base:process.env.GARDEN_BASE_PATH||'/',contentSha256,photos:providedPhotoImport.photos.length,files},null,2)+'\n');
console.log(`已准备离线启动器、托管重定向与发布清单；内容版本 ${contentSha256.slice(0,16)}。`);

}
if(process.argv[1]===fileURLToPath(import.meta.url))await prepareRelease();
