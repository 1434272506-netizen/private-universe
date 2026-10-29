// These records stay in this browser, on this site's address. Nothing is uploaded.
const DATABASE='private-universe-content';
const VERSION=2;
const PHOTO_LIMIT=20*1024*1024;
const BACKUP_LIMIT=512*1024*1024;
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']);
const STORES={memory:'memories',letter:'letters'};
const IMPORTS='imports';
let connectionPromise=null;
let currentImageURLs=[];

function failure(error,fallback='暂时无法保存，请重试。'){
  if(error?.name==='QuotaExceededError')return new Error('这台浏览器的可用空间不足，未能保存。请先导出备份，再整理浏览器空间。');
  if(error?.name==='SecurityError'||error?.name==='InvalidStateError')return new Error('这台浏览器暂时不允许保存内容。请检查浏览器的隐私或存储设置。');
  return error instanceof Error&&error.name==='Error'?error:new Error(fallback);
}

function openDatabase(){
  if(connectionPromise)return connectionPromise;
  connectionPromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('这台浏览器不支持本地保存，请换用较新的浏览器。'));return;}
    let settled=false;
    const request=indexedDB.open(DATABASE,VERSION);
    request.onupgradeneeded=()=>{
      const database=request.result;
      for(const store of [...Object.values(STORES),IMPORTS]){
        if(!database.objectStoreNames.contains(store))database.createObjectStore(store,{keyPath:'id'});
      }
    };
    request.onblocked=()=>{settled=true;reject(new Error('另一个花园页面正在使用旧版存储，请关闭其他花园页面后重试。'));};
    request.onerror=()=>{settled=true;reject(failure(request.error,'无法打开本地内容，请重试。'));};
    request.onsuccess=()=>{
      const database=request.result;
      if(settled){database.close();return;}
      database.onversionchange=()=>{database.close();connectionPromise=null;};
      database.onclose=()=>{connectionPromise=null;};
      resolve(database);
    };
  }).catch(error=>{connectionPromise=null;throw failure(error,'无法打开本地内容，请重试。');});
  return connectionPromise;
}

async function readAll(){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction;
    try{transaction=database.transaction(Object.values(STORES),'readonly');}
    catch(error){reject(failure(error,'无法读取本地内容，请重试。'));return;}
    const result={memories:[],letters:[]};
    for(const name of Object.values(STORES)){
      const request=transaction.objectStore(name).getAll();
      request.onsuccess=()=>{result[name]=request.result;};
    }
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(failure(transaction.error,'无法读取本地内容，请重试。'));
    transaction.onerror=()=>{}; // The abort handler reports failure once.
  });
}

function text(value,name,maximum,{required=false}={}){
  if(value==null)value='';
  if(typeof value!=='string')throw new Error(`${name}需要填写文字。`);
  value=value.trim();
  if(required&&!value)throw new Error(`请填写${name}。`);
  if(value.length>maximum)throw new Error(`${name}最多填写 ${maximum} 个字。`);
  return value;
}

function date(value){
  const result=text(value,'日期',10);
  if(!result)return '';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(result))throw new Error('日期请填写为年-月-日，也可以留空。');
  const [year,month,day]=result.split('-').map(Number);
  const parsed=new Date(`${result}T00:00:00Z`);
  if(year<1||!Number.isFinite(parsed.getTime())||parsed.getUTCFullYear()!==year||parsed.getUTCMonth()+1!==month||parsed.getUTCDate()!==day)throw new Error('这个日期不存在，请检查后再保存。');
  return result;
}

function identifier(value,{optional=false}={}){
  if(optional&&(value==null||value===''))return '';
  if(typeof value!=='string'||!/[A-Za-z0-9]/.test(value)||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new Error('这条内容的编号无效，请重新打开添加入口。');
  return value;
}

function memoryFields(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('照片内容格式无效。');
  return {caption:text(value.caption,'照片说明',2000),alt:text(value.alt,'画面描述',500),date:date(value.date)};
}

function letterFields(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('信件内容格式无效。');
  const identity=value.identity??'purple';
  if(identity!=='purple'&&identity!=='green')throw new Error('请选择紫色或绿色署名。');
  return {title:text(value.title,'信件标题',200),body:text(value.body,'信的正文',100000,{required:true}),from:text(value.from,'署名',120),date:date(value.date),identity};
}

async function validatePhoto(file){
  if(!(file instanceof Blob)||!file.size)throw new Error('请先选择一张照片。');
  if(!IMAGE_TYPES.has(file.type))throw new Error('请选择 JPG、PNG、WebP、GIF 或 AVIF 照片。');
  if(file.size>PHOTO_LIMIT)throw new Error('照片超过 20 MB，请缩小后再添加。');
  const url=URL.createObjectURL(file);
  try{
    await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>image.naturalWidth&&image.naturalHeight?resolve():reject(new Error('这张照片无法读取，请换一张照片。'));
      image.onerror=()=>reject(new Error('这张照片无法读取，或浏览器不支持这种图片编码。'));
      image.src=url;
    });
  }finally{URL.revokeObjectURL(url);}
  return file;
}

// Only resolve after the transaction has committed, never after a put request alone.
async function writeOne(storeName,id,create){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction,customError;
    try{
      transaction=database.transaction(storeName,'readwrite');
      const store=transaction.objectStore(storeName);
      const write=previous=>{
        try{
          if(id&&!previous)throw new Error('这条内容已被移除，请重新添加。');
          const now=Date.now();
          store.put({...create(previous),id:previous?.id||crypto.randomUUID(),createdAt:previous?.createdAt||now,updatedAt:now});
        }catch(error){customError=error;transaction.abort();}
      };
      if(id){const request=store.get(id);request.onsuccess=()=>write(request.result);}
      else write(null);
    }catch(error){reject(failure(error));return;}
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(failure(customError||transaction.error));
    transaction.onerror=()=>{};
  });
}

export async function loadLocalContent(){
  const records=await readAll();
  const byCreated=(a,b)=>(a.createdAt||0)-(b.createdAt||0)||a.id.localeCompare(b.id);
  const nextURLs=[];
  try{
    const memories=records.memories.sort(byCreated).map(record=>{
      const image=URL.createObjectURL(record.photo);nextURLs.push(image);
      return {id:record.id,image,caption:record.caption,alt:record.alt,date:record.date};
    });
    const letters=records.letters.sort(byCreated).map(({id,title,body,from,date,identity})=>({id,title,body,from,date,identity}));
    for(const url of currentImageURLs)URL.revokeObjectURL(url);
    currentImageURLs=nextURLs;
    return {memories,letters};
  }catch(error){
    for(const url of nextURLs)URL.revokeObjectURL(url);
    throw failure(error,'有一张本地照片暂时无法读取，请重试。');
  }
}

export async function saveLocalMemory(value){
  const fields=memoryFields(value);
  const id=identifier(value.id,{optional:true});
  const photo=value.file==null?null:await validatePhoto(value.file);
  if(!id&&!photo)throw new Error('请先选择一张照片。');
  await writeOne('memories',id,previous=>({...fields,photo:photo||previous.photo}));
}

export async function saveLocalLetter(value){
  const fields=letterFields(value);
  const id=identifier(value.id,{optional:true});
  await writeOne('letters',id,()=>fields);
}

export async function hasOriginalPhotoImport(importId){
  identifier(importId);
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction,exists=false;
    try{
      transaction=database.transaction(IMPORTS,'readonly');
      const request=transaction.objectStore(IMPORTS).getKey(importId);
      request.onsuccess=()=>{exists=request.result!==undefined;};
    }catch(error){reject(failure(error,'无法读取照片导入记录，请重试。'));return;}
    transaction.oncomplete=()=>resolve(exists);
    transaction.onabort=()=>reject(failure(transaction.error,'无法读取照片导入记录，请重试。'));
    transaction.onerror=()=>{};
  });
}

// Preserve the original bytes. Import records and the batch marker commit together;
// a later visit must not resurrect photographs that the user has removed.
export async function importOriginalPhotos(importId,records){
  identifier(importId);
  if(await hasOriginalPhotoImport(importId))return {imported:0,alreadyImported:true};
  if(!Array.isArray(records)||!records.length)throw new Error('没有找到要导入的原始照片。');
  const prepared=[],seen=new Set(),now=Date.now();
  for(const [index,record] of records.entries()){
    const fields=memoryFields(record),id=identifier(record.id);
    if(seen.has(id))throw new Error('这批照片中有重复编号，尚未导入。');
    seen.add(id);
    const photo=await validatePhoto(record.photo);
    prepared.push({...fields,id,photo,createdAt:now+index,updatedAt:now,pristineOriginal:true});
  }
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction,customError,imported=0,alreadyImported=false;
    try{
      transaction=database.transaction(['memories',IMPORTS],'readwrite');
      const imports=transaction.objectStore(IMPORTS),memories=transaction.objectStore('memories');
      const marker=imports.getKey(importId);
      marker.onsuccess=()=>{
        if(marker.result!==undefined){alreadyImported=true;return;}
        try{
          for(const record of prepared){
            const existing=memories.getKey(record.id);
            existing.onsuccess=()=>{
              if(existing.result===undefined){memories.add(record);imported++;}
            };
          }
          imports.add({id:importId,importedAt:now,count:prepared.length});
        }catch(error){customError=error;transaction.abort();}
      };
    }catch(error){transaction?.abort();reject(failure(error,'原始照片尚未导入，请重试。'));return;}
    transaction.oncomplete=()=>resolve({imported,alreadyImported});
    transaction.onabort=()=>reject(failure(customError||transaction.error,'原始照片尚未导入，请重试。'));
    transaction.onerror=()=>{};
  });
}

export async function deleteLocalContent(kind,id){
  const storeName=STORES[kind];
  if(!storeName)throw new Error('请选择要移除的照片或信件。');
  identifier(id);
  const database=await openDatabase();
  await new Promise((resolve,reject)=>{
    let transaction;
    try{transaction=database.transaction(storeName,'readwrite');transaction.objectStore(storeName).delete(id);}
    catch(error){reject(failure(error,'移除失败，请重试。'));return;}
    transaction.oncomplete=()=>resolve();
    transaction.onabort=()=>reject(failure(transaction.error,'移除失败，请重试。'));
    transaction.onerror=()=>{};
  });
}

function readBlobAsDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('一张照片无法导出，请重试。'));
    reader.onabort=()=>reject(new Error('备份已中断，请重试。'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadContentBackup(){
  const records=await readAll();
  const memories=[];
  for(const record of records.memories){
    const {photo,...fields}=record;
    delete fields.pristineOriginal;
    memories.push({...fields,image:await readBlobAsDataURL(photo)});
  }
  const backup={format:'private-universe-content',version:1,exportedAt:new Date().toISOString(),memories,letters:records.letters};
  let url;
  try{
    const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
    url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=`花园内容备份-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(link);link.click();link.remove();
    // The browser starts the download asynchronously; keep its URL alive briefly.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){if(url)URL.revokeObjectURL(url);throw failure(error,'无法生成备份，请重试。');}
}

async function restoredPhoto(value){
  if(typeof value!=='string'||value.length>Math.ceil(PHOTO_LIMIT/3)*4+100)throw new Error('备份中的照片无效或超过 20 MB。');
  const match=/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if(!match||match[2].length%4!==0)throw new Error('备份中的照片格式无效。');
  let bytes;
  try{
    const binary=atob(match[2]);
    bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
  }catch{throw new Error('备份中的照片无法读取。');}
  return validatePhoto(new Blob([bytes],{type:match[1]}));
}

function restoredTime(value){return typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:Date.now();}

export async function restoreContentBackup(file){
  if(!(file instanceof Blob)||!file.size)throw new Error('请选择花园导出的 JSON 备份文件。');
  if(file.size>BACKUP_LIMIT)throw new Error('备份超过 512 MB，暂时无法一次恢复。');
  let backup;
  try{backup=JSON.parse(await file.text());}catch{throw new Error('这个文件不是有效的花园备份，请选择导出的 JSON 文件。');}
  if(!backup||backup.format!=='private-universe-content'||backup.version!==1||!Array.isArray(backup.memories)||!Array.isArray(backup.letters))throw new Error('这个文件不是当前版本的花园内容备份。');
  const prepared={memories:[],letters:[]};
  // Decode and validate every record before opening the write transaction.
  for(const kind of Object.values(STORES)){
    const seen=new Set();
    for(const record of backup[kind]){
      if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('备份中有一条内容的格式无效。');
      const id=identifier(record.id);
      if(seen.has(id))throw new Error('备份中有重复的内容编号，未进行恢复。');
      seen.add(id);
      const fields=kind==='memories'?{...memoryFields(record),photo:await restoredPhoto(record.image)}:letterFields(record);
      prepared[kind].push({...fields,id,createdAt:restoredTime(record.createdAt),updatedAt:restoredTime(record.updatedAt)});
    }
  }
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    let transaction;
    const added={memories:0,letters:0};
    try{
      transaction=database.transaction(Object.values(STORES),'readwrite');
      for(const kind of Object.values(STORES)){
        const store=transaction.objectStore(kind);
        for(const record of prepared[kind]){
          const request=store.get(record.id);
          request.onsuccess=()=>{
            // A fresh browser has automatic originals, not the user's later edits.
            // Only untouched originals may be replaced; edited/restored records win.
            if(request.result===undefined){store.add(record);added[kind]++;}
            else if(kind==='memories'&&request.result.pristineOriginal===true){store.put(record);added[kind]++;}
          };
        }
      }
    }catch(error){reject(failure(error,'恢复失败，原有内容仍保留。'));return;}
    transaction.oncomplete=()=>resolve(added);
    transaction.onabort=()=>reject(failure(transaction.error,'恢复失败，原有内容仍保留。'));
    transaction.onerror=()=>{};
  });
}
