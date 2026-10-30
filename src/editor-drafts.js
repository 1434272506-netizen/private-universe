const DATABASE='private-universe-drafts',STORE='drafts';
const PREFIX='private-universe-draft-journal:';
let databasePromise,sequence=Date.now()*1000;
// A duplicated tab can inherit sessionStorage, but it must never inherit the
// same writer identity. Pending journals already carry their original writer.
const writer=crypto.randomUUID();
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('private-universe-drafts'):null;
const listeners=new Set();
channel?.addEventListener('message',event=>{if(event.data?.writer!==writer)for(const listener of listeners)listener(event.data);});

function fail(error){
  if(error?.name==='QuotaExceededError')return new Error('本机空间不足，草稿还未保存。请先保留文字，再整理存储空间。');
  return error?.name==='DraftConflictError'?error:new Error('草稿暂时未能保存，请先保留文字，不要刷新页面。');
}
function open(){
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'kind'});
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('请关闭其他旧版页面，再恢复草稿。'));
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null;};resolve(db);};
  }).catch(error=>{databasePromise=null;throw fail(error);});
  return databasePromise;
}
export function stageEditorDraft(kind,payload,expectedRevision){
  const entry={kind,writer,sequence:sequence=Math.max(sequence+1,Date.now()*1000),updatedAt:Date.now(),expectedRevision,deleted:payload==null,payload};
  // Text is journaled synchronously, so even a reload in the input event can
  // recover it. Blobs are kept in IndexedDB without encoding or compression.
  const serializable=payload?{...payload,file:null,photoExpected:Boolean(payload.file||payload.photoExpected)}:null;
  try{localStorage.setItem(`${PREFIX}${kind}:${writer}`,JSON.stringify({...entry,payload:serializable}));}catch{/* The committed database and beforeunload guard remain available. */}
  return entry;
}
export function forgetEditorDraftJournal(kind,entry){
  try{
    const key=`${PREFIX}${kind}:${entry?.writer||writer}`;
    if(entry){const pending=JSON.parse(localStorage.getItem(key)||'null');if(pending?.sequence!==entry.sequence)return;}
    localStorage.removeItem(key);
  }catch{/* Storage settings can disable the recovery journal. */}
}
export async function getEditorDraftRecord(kind){
  const db=await open();
  return new Promise((resolve,reject)=>{
    let result=null;const transaction=db.transaction(STORE,'readonly');
    const request=transaction.objectStore(STORE).get(kind);request.onsuccess=()=>{result=request.result||null;};
    transaction.oncomplete=()=>{sequence=Math.max(sequence,result?.sequence||0);resolve(result);};
    transaction.onabort=()=>reject(fail(transaction.error));
  });
}
export async function readEditorDraft(kind){
  const record=await getEditorDraftRecord(kind);let pending=null;
  try{
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index);if(!key?.startsWith(`${PREFIX}${kind}:`))continue;
      let candidate;try{candidate=JSON.parse(localStorage.getItem(key));}catch{continue;}
      if(candidate?.kind!==kind||!Number.isSafeInteger(candidate.sequence))continue;
      const newer=candidate.sequence>(record?.sequence||0)||(candidate.sequence===record?.sequence&&candidate.writer!==record?.writer);
      if(newer&&(!pending||candidate.sequence>pending.sequence))pending=candidate;
    }
  }catch{/* Reading the database still restores committed drafts. */}
  if(pending?.payload?.photoExpected){
    // A text journal written after the last committed keystroke can reuse the
    // same draft photo, but must never substitute another tab's photograph.
    if(record?.writer===pending.writer&&record.payload?.file)pending.payload.file=record.payload.file;
  }
  const conflict=Boolean(pending&&record&&record.writer!==pending.writer&&pending.expectedRevision!==record.revision);
  return {record,pending,conflict};
}
export async function writeEditorDraft(entry,expectedRevision){
  const db=await open();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(STORE,'readwrite');const store=transaction.objectStore(STORE);
    let result,customError;
    const request=store.get(entry.kind);
    request.onsuccess=()=>{
      const previous=request.result;
      if((previous?.revision||0)!==expectedRevision){customError=new Error('另一个花园页面更新了这份草稿。请先选择要继续的版本。');customError.name='DraftConflictError';transaction.abort();return;}
      result={...entry,revision:expectedRevision+1};store.put(result);
    };
    transaction.oncomplete=()=>{
      try{
        const key=`${PREFIX}${entry.kind}:${entry.writer}`,pending=JSON.parse(localStorage.getItem(key)||'null');
        if(pending?.sequence===entry.sequence)localStorage.removeItem(key);
      }catch{/* A later edit retains its own journal. */}
      channel?.postMessage({kind:entry.kind,writer,revision:result.revision});resolve(result);
    };
    transaction.onabort=()=>reject(fail(customError||transaction.error));
    transaction.onerror=()=>{};
  });
}
export function watchEditorDrafts(listener){listeners.add(listener);return()=>listeners.delete(listener);}
