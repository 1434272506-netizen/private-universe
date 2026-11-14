import {inside} from './natural/land.js';
const DATABASE='private-universe-surprises';
const VERSION=1,STORE='surprises';
let connection;

function storageError(error,message='暂时未能收好这个惊喜，请重试。'){
  if(error?.name==='QuotaExceededError')return new Error('浏览器空间不足，请先下载备份，再整理空间。');
  if(['SecurityError','InvalidStateError'].includes(error?.name))return new Error('浏览器暂时不允许保存惊喜，请检查本地存储设置。');
  return error?.name==='Error'?error:new Error(message);
}
function database(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('这个浏览器暂时不支持本机收藏。'));return;}
    const request=indexedDB.open(DATABASE,VERSION);let settled=false;
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onblocked=()=>{settled=true;reject(new Error('请先关闭其他旧版花园页面，再重新打开。'));};
    request.onerror=()=>reject(storageError(request.error));
    request.onsuccess=()=>{
      const db=request.result;if(settled){db.close();return;}
      db.onversionchange=()=>{db.close();connection=null;};db.onclose=()=>{connection=null;};resolve(db);
    };
  }).catch(error=>{connection=null;throw storageError(error);});return connection;
}
function text(value,label,max,{required=false}={}){
  if(value==null)value='';
  if(typeof value!=='string')throw new Error(`${label}请填写文字。`);
  value=value.trim();if(required&&!value)throw new Error(`请填写${label}。`);
  if(value.length>max)throw new Error(`${label}最多 ${max} 个字。`);return value;
}
function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new Error('这条惊喜的编号无效，请重新打开。');return value;}
function identity(value){if(!['purple','green'].includes(value))throw new Error('请选择淡紫或草绿署名。');return value;}
function time(value,label){if(!Number.isSafeInteger(value)||value<1)throw new Error(`${label}无效。`);return value;}
function fields(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('惊喜的格式无效。');
  if(!['note','question','box'].includes(value.type))throw new Error('请选择纸条、问答或惊喜盒。');
  if(typeof value.color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(value.color))throw new Error('请选择一种气球颜色。');
  const {x,z}=value.position||{};
  if(!Number.isFinite(x)||!Number.isFinite(z)||!inside(x,z,1.002))throw new Error('请在花园草地里选择一个位置。');
  return {type:value.type,title:text(value.title,'惊喜标题',160),body:text(value.body,value.type==='question'?'问题':'想留下的话',12000,{required:true}),
    answer:text(value.answer,'答案',4000),color:value.color.toLowerCase(),identity:identity(value.identity),position:{x,z}};
}
function decorations(value={}){
  value=value??{};
  const bookmarks=value.bookmarks??{},notes=value.notes??{};
  if(typeof bookmarks!=='object'||Array.isArray(bookmarks)||typeof notes!=='object'||Array.isArray(notes))throw new Error('备份中的书签或便签格式无效。');
  for(const key of ['purple','green'])if(bookmarks[key]!=null&&typeof bookmarks[key]!=='boolean')throw new Error('备份中的花瓣书签格式无效。');
  return {bookmarks:{purple:bookmarks.purple===true,green:bookmarks.green===true},notes:{purple:text(notes.purple,'紫色页边便签',2000),green:text(notes.green,'绿色页边便签',2000)}};
}
async function mutate(recordId,change){
  const db=await database();return new Promise((resolve,reject)=>{
    let transaction,result,reason;
    try{
      transaction=db.transaction(STORE,'readwrite');const store=transaction.objectStore(STORE);
      const apply=previous=>{
        try{result=change(previous);if(result===null)store.delete(recordId);else store.put(result);}
        catch(error){reason=error;transaction.abort();}
      };
      if(recordId){const request=store.get(recordId);request.onsuccess=()=>apply(request.result);}
      else apply(null);
    }catch(error){reject(storageError(error));return;}
    transaction.oncomplete=()=>resolve(result);transaction.onabort=()=>reject(storageError(reason||transaction.error));transaction.onerror=()=>{};
  });
}
export async function loadSurprises(){
  const db=await database();return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readonly');let result=[];
    const request=transaction.objectStore(STORE).getAll();request.onsuccess=()=>{result=request.result;};
    transaction.oncomplete=()=>resolve(result.sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id)));
    transaction.onabort=()=>reject(storageError(transaction.error,'暂时无法打开惊喜和档案，请重试。'));
  });
}
export async function saveSurprise(value){
  const content=fields(value),recordId=value.id?id(value.id):null;
  return mutate(recordId,previous=>{
    if(recordId&&!previous)throw new Error('这条惊喜已移除，请重新创建。');
    if(previous?.status==='archived')throw new Error('这段回忆已收进档案，原内容不再改写。');
    const now=Date.now();return {...content,id:previous?.id||crypto.randomUUID(),createdAt:previous?.createdAt||now,updatedAt:now,status:'active',completedAt:null,...decorations(previous)};
  });
}
export async function completeSurprise(recordId){
  id(recordId);let changed=false;
  const record=await mutate(recordId,previous=>{
    if(!previous)throw new Error('这条惊喜已移除。');
    if(previous.status==='archived')return previous;
    changed=true;const now=Date.now();return {...previous,status:'archived',completedAt:now,archiveSeenAt:null,updatedAt:now};
  });return {record,changed};
}
export async function deleteSurprise(recordId){
  id(recordId);await mutate(recordId,previous=>{
    if(previous?.status==='archived')throw new Error('这条惊喜已收进档案，不能在气球移除操作中删除。');
    return null;
  });
}
export async function markArchiveSeen(recordId){
  id(recordId);return mutate(recordId,previous=>{
    if(!previous||previous.status!=='archived')throw new Error('这页档案暂时没有打开，请重试。');
    return previous.archiveSeenAt?previous:{...previous,archiveSeenAt:Date.now()};
  });
}
export async function decorateArchive(recordId,value){
  id(recordId);const owner=identity(value.identity);
  if(value.bookmark!=null&&typeof value.bookmark!=='boolean')throw new Error('请选择是否夹入花瓣书签。');
  const note=value.note==null?null:text(value.note,'页边便签',2000);
  return mutate(recordId,previous=>{
    if(!previous||previous.status!=='archived')throw new Error('这页档案暂时没有打开，请重试。');
    const marks=decorations(previous);
    if(value.bookmark!=null)marks.bookmarks[owner]=value.bookmark;if(note!==null)marks.notes[owner]=note;
    return {...previous,...marks,updatedAt:Date.now()};
  });
}
export async function downloadSurprisesBackup(){
  const records=await loadSurprises();
  const blob=new Blob([JSON.stringify({format:'private-universe-surprises',version:1,exportedAt:new Date().toISOString(),records})],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`花园惊喜与档案-${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function restoreSurprisesBackup(file){
  if(!(file instanceof Blob)||!file.size||file.size>5*1024*1024)throw new Error('请选择不超过 5 MB 的惊喜与档案 JSON 备份。');
  let backup;try{backup=JSON.parse(await file.text());}catch{throw new Error('这个文件不是有效的惊喜备份。');}
  if(backup?.format!=='private-universe-surprises'||backup.version!==1||!Array.isArray(backup.records)||backup.records.length>1000)throw new Error('这个文件不是花园导出的惊喜与档案备份。');
  const seen=new Set(),records=backup.records.map(record=>{
    const content=fields(record),recordId=id(record.id);if(seen.has(recordId))throw new Error('备份含重复的惊喜编号，未恢复。');seen.add(recordId);
    if(!['active','archived'].includes(record.status))throw new Error('备份中的惊喜状态无效。');
    return {...content,id:recordId,status:record.status,createdAt:time(record.createdAt,'创建时间'),updatedAt:time(record.updatedAt,'修改时间'),
      completedAt:record.status==='archived'?time(record.completedAt,'完成时间'):null,
      archiveSeenAt:record.status==='archived'&&record.archiveSeenAt!=null?time(record.archiveSeenAt,'档案打开时间'):null,...decorations(record)};
  });
  const db=await database();return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite'),store=transaction.objectStore(STORE);let restored=0;
    for(const record of records){const request=store.getKey(record.id);request.onsuccess=()=>{if(request.result===undefined){store.add(record);restored++;}};}
    transaction.oncomplete=()=>resolve(restored);transaction.onabort=()=>reject(storageError(transaction.error,'备份未恢复，原来的惊喜和档案仍在。'));transaction.onerror=()=>{};
  });
}
