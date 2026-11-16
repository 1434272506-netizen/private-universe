import {defineConfig} from 'vite';
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const publicRoot=fileURLToPath(new URL('./public/',import.meta.url));
const hash=createHash('sha256');
function fingerprint(directory){
  for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const path=join(directory,entry.name);
    if(entry.isDirectory())fingerprint(path);
    else if(entry.isFile()){hash.update(relative(publicRoot,path).replaceAll('\\','/'));hash.update('\0');hash.update(readFileSync(path));}
  }
}
fingerprint(publicRoot);
// Offline reference pages under work/ are not application dependency entries.
export default defineConfig({
 base:process.env.GARDEN_BASE_PATH||'/',
 define:{__GARDEN_ASSET_VERSION__:JSON.stringify(hash.digest('hex').slice(0,16))},
 optimizeDeps:{entries:['index.html']},
 // Separate the renderer/core/addons instead of hiding the large-bundle warning.
 build:{rolldownOptions:{output:{codeSplitting:{groups:[
  {name:'three-core',test:/node_modules[\\/]three[\\/]build[\\/]three\.core/},
  {name:'three-renderer',test:/node_modules[\\/]three[\\/]build[\\/]three\.module/},
  {name:'three-addons',test:/node_modules[\\/]three[\\/](examples|src)[\\/]/}
 ]}}}}
});
