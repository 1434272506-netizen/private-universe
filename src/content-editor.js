import {loadLocalContent,saveLocalMemory,saveLocalLetter,deleteLocalContent,downloadContentBackup,restoreContentBackup} from './local-content.js';
import {importProvidedPhotos} from './photo-import.js';
import {stageEditorDraft,readEditorDraft,getEditorDraftRecord,writeEditorDraft,forgetEditorDraftJournal,watchEditorDrafts} from './editor-drafts.js';
import './content-editor.css';

const $=selector=>document.querySelector(selector);
const node=(tag,className,text)=>{
  const result=document.createElement(tag);if(className)result.className=className;
  if(text!=null)result.textContent=text;return result;
};
const action=(text,handler)=>{
  const result=node('button',null,text);result.type='button';result.addEventListener('click',handler);return result;
};
const feedback=(kind,text,error=false)=>{
  const target=$(`#${kind}-feedback`);target.textContent=text;target.dataset.error=String(error);
};

export function prepareContentEditor({onChange,onOpen=()=>{},onClose=()=>{}}){
  const dialog=$('#content-dialog'),memoryForm=$('#memory-form'),letterForm=$('#letter-form');
  let content={memories:[],letters:[]},memoryId=null,letterId=null,busy=false,previewURL=null;
  let returnFocus=null,loaded=false,tab='memory',initialization=null,draftPhoto=null,draftsInitialized=false;
  const dirty={memory:false,letter:false};
  const drafts=Object.fromEntries(['memory','letter'].map(kind=>[kind,{revision:0,queue:Promise.resolve(),conflict:false,pending:0,failed:false,lastSequence:0,recoveryEntry:null}]));
  const draftUI={};
  for(const [kind,form] of [['memory',memoryForm],['letter',letterForm]]){
    const section=node('div','editor-draft');
    const status=node('p','draft-status','未保存的内容会自动留在本机。');status.id=`${kind}-draft-status`;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const clear=action('清空草稿',async()=>{
      if(busy||!confirm('清空这份未保存草稿？已经收藏的照片和信件不会改变。'))return;
      await discardAndReset(kind);
    });clear.id=`clear-${kind}-draft`;clear.className='editor-secondary';
    const resolve=node('div','draft-conflict-actions');resolve.hidden=true;
    resolve.append(action('载入最新草稿',()=>resolveConflict(kind,false)),action('保留此处草稿',()=>resolveConflict(kind,true)));
    section.append(status,clear,resolve);form.append(section);draftUI[kind]={status,resolve};
    form.addEventListener('input',event=>{if(event.target.type==='file')return;dirty[kind]=true;persistDraft(kind);});
    form.addEventListener('change',event=>{if(event.target.type!=='file'){dirty[kind]=true;persistDraft(kind);}});
  }
  function draftStatus(kind,text,error=false){draftUI[kind].status.textContent=text;draftUI[kind].status.dataset.error=String(error);}
  function captureDraft(kind){
    return kind==='memory'?{id:memoryId,caption:$('#memory-caption').value,alt:$('#memory-alt').value,date:$('#memory-date').value,file:$('#memory-file').files[0]||draftPhoto||null}:
      {id:letterId,title:$('#letter-name').value,body:$('#letter-body').value,from:$('#letter-from').value,date:$('#letter-date').value,identity:$('#letter-identity').value};
  }
  function queueDraft(kind,entry){
    const state=drafts[kind];state.lastSequence=entry.sequence;state.pending++;
    draftStatus(kind,'正在保存草稿…');
    const task=state.queue.then(async()=>{
      if(state.conflict)throw Object.assign(new Error('另一个花园页面更新了这份草稿，请选择要继续的版本。'),{name:'DraftConflictError'});
      const saved=await writeEditorDraft(entry,state.revision);state.revision=saved.revision;state.failed=false;
      if(state.lastSequence===entry.sequence)draftStatus(kind,entry.deleted?'草稿已清空。':'草稿已存于本机。');
      return saved;
    });
    state.queue=task.catch(error=>{
      state.failed=true;if(error.name==='DraftConflictError'){state.conflict=true;draftUI[kind].resolve.hidden=false;}
      draftStatus(kind,error.message||'草稿还未保存，请先保留文字。',true);
    }).finally(()=>{state.pending--;});
    return task;
  }
  function persistDraft(kind){
    if(!draftsInitialized)return;
    const entry=stageEditorDraft(kind,captureDraft(kind),drafts[kind].revision);queueDraft(kind,entry).catch(()=>{});
  }
  async function clearDraft(kind){
    const state=drafts[kind];
    if(state.conflict){
      const error=Object.assign(new Error('另一页面已有更新的草稿，请先选择要继续的版本。'),{name:'DraftConflictError'});
      draftStatus(kind,error.message,true);draftUI[kind].resolve.hidden=false;throw error;
    }
    const entry=stageEditorDraft(kind,null,state.revision);await queueDraft(kind,entry);
  }
  async function clearSubmittedDraft(kind){
    try{await clearDraft(kind);return true;}
    catch(error){
      if(error.name==='DraftConflictError'){
        forgetEditorDraftJournal(kind);
        if(drafts[kind].recoveryEntry)forgetEditorDraftJournal(kind,drafts[kind].recoveryEntry);
        drafts[kind].recoveryEntry=null;
      }
      return false;
    }
  }
  async function discardAndReset(kind){
    if(busy)return;setBusy(true);
    try{await clearDraft(kind);kind==='memory'?resetMemory():resetLetter();feedback(kind,'草稿已清空，已收藏的内容没有改变。');}
    catch{/* Keep the form intact when clearing the stored draft fails. */}
    finally{setBusy(false);}
  }
  function restorePayload(kind,payload){
    if(kind==='memory'){
      resetMemory();memoryId=payload.id||null;
      $('#memory-caption').value=payload.caption||'';$('#memory-alt').value=payload.alt||'';$('#memory-date').value=payload.date||'';
      draftPhoto=payload.file instanceof Blob?payload.file:null;$('#memory-file').required=!memoryId&&!draftPhoto;
      if(draftPhoto){showPreview();previewURL=URL.createObjectURL(draftPhoto);const image=node('img');image.src=previewURL;image.alt='已恢复的草稿照片';$('#photo-preview').replaceChildren(image);}
      else showSavedPhoto();
      if(memoryId){$('#cancel-memory-edit').hidden=false;memoryForm.querySelector('[type=submit]').textContent='保存照片修改 ↗';}
    }else{
      resetLetter();letterId=payload.id||null;
      for(const [field,value] of Object.entries({name:payload.title,body:payload.body,from:payload.from,date:payload.date,identity:payload.identity||'purple'}))$('#letter-'+field).value=value||'';
      if(letterId){$('#cancel-letter-edit').hidden=false;letterForm.querySelector('[type=submit]').textContent='保存信件修改 ↗';}
    }
    dirty[kind]=true;
  }
  async function restoreDrafts(){
    if(draftsInitialized)return;
    for(const kind of ['memory','letter']){
      try{
        const recovered=await readEditorDraft(kind),{record,pending}=recovered;
        let entry=pending||record;
        drafts[kind].revision=record?.revision||0;
        // A failed clear must not turn into permission to clear another tab's
        // later draft when this page reloads.
        if(recovered.conflict&&pending?.deleted){forgetEditorDraftJournal(kind,pending);entry=record;}
        else if(recovered.conflict){
          drafts[kind].conflict=true;drafts[kind].failed=true;drafts[kind].recoveryEntry=pending;draftUI[kind].resolve.hidden=false;
        }
        if(entry?.payload&&!entry.deleted){
          restorePayload(kind,entry.payload);
          draftStatus(kind,kind==='memory'&&draftPhoto?'已恢复所选照片和文字，草稿已存于本机。':'已恢复上次未保存的草稿。');
        }
        if(pending&&!recovered.conflict){drafts[kind].recoveryEntry=pending;await queueDraft(kind,pending).catch(()=>{});}
        if(drafts[kind].conflict)draftStatus(kind,'上次未保存的内容仍在，但另一页面有更新的草稿，请选择要继续的版本。',true);
        else if(entry?.payload?.photoExpected&&!draftPhoto)draftStatus(kind,'文字草稿已恢复，上次照片未保存完成，请重新选择原图。',true);
      }catch(error){drafts[kind].failed=true;draftStatus(kind,error.message||'草稿暂时未能恢复，请重试。',true);}
    }
    draftsInitialized=true;
  }
  async function resolveConflict(kind,keepHere){
    if(busy)return;
    if(!confirm(keepHere?'用此处的内容替换另一页面的草稿？已收藏内容不会改变。':'载入最新草稿会放下此处未保存的内容，继续吗？'))return;
    setBusy(true);
    try{
      await drafts[kind].queue;const latest=await getEditorDraftRecord(kind);
      drafts[kind].revision=latest?.revision||0;drafts[kind].conflict=false;drafts[kind].failed=false;draftUI[kind].resolve.hidden=true;
      if(keepHere)await queueDraft(kind,stageEditorDraft(kind,captureDraft(kind),drafts[kind].revision));
      else{forgetEditorDraftJournal(kind);if(latest?.payload&&!latest.deleted)restorePayload(kind,latest.payload);else kind==='memory'?resetMemory():resetLetter();draftStatus(kind,'已载入最新草稿。');}
      if(drafts[kind].recoveryEntry)forgetEditorDraftJournal(kind,drafts[kind].recoveryEntry);
      drafts[kind].recoveryEntry=null;
    }catch(error){draftStatus(kind,error.message||'暂时未能选择草稿，请重试。',true);}
    finally{setBusy(false);}
  }
  watchEditorDrafts(change=>{
    const state=drafts[change?.kind];if(!state||!draftsInitialized||change.revision<=state.revision)return;
    state.conflict=true;draftUI[change.kind].resolve.hidden=false;
    draftStatus(change.kind,'另一页面更新了草稿。此处内容仍在，请选择要继续的版本。',true);
  });
  window.addEventListener('beforeunload',event=>{
    if(Object.entries(drafts).some(([kind,state])=>state.pending>0||(state.failed&&dirty[kind]))){event.preventDefault();event.returnValue='';}
  });

  function setBusy(value){
    busy=value;dialog.setAttribute('aria-busy',String(value));
    dialog.querySelectorAll('button,input,textarea,select').forEach(control=>{control.disabled=value;});
  }
  function showPreview(src){
    if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
    const preview=$('#photo-preview');preview.replaceChildren();
    if(src){const image=node('img');image.src=src;image.alt='待收藏的照片预览';preview.append(image);}
    else preview.append(node('span',null,'让回忆有个位置'));
  }
  function resetMemory(){
    memoryForm.reset();memoryId=null;draftPhoto=null;dirty.memory=false;$('#memory-file').required=true;
    $('#cancel-memory-edit').hidden=true;memoryForm.querySelector('[type=submit]').textContent='放到白丝带上 ↗';showPreview();
  }
  function resetLetter(){
    letterForm.reset();letterId=null;dirty.letter=false;$('#cancel-letter-edit').hidden=true;
    letterForm.querySelector('[type=submit]').textContent='收进信箱 ↗';
  }
  function showSavedPhoto(){
    if(draftPhoto){showPreview();previewURL=URL.createObjectURL(draftPhoto);const image=node('img');image.src=previewURL;image.alt='草稿照片预览';$('#photo-preview').replaceChildren(image);}
    else showPreview(content.memories.find(record=>record.id===memoryId)?.image);
  }
  function chooseTab(kind,focus=false){
    tab=kind==='letter'?'letter':'memory';
    for(const [name,prefix] of [['memory','photo'],['letter','letter']]){
      const selected=name===tab,button=$(`#${prefix}-tab`);
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      $(`#${prefix}-panel`).hidden=!selected;if(selected&&focus)button.focus();
    }
  }
  function allowReplace(kind){return !dirty[kind]||confirm('表单里还有未保存的内容。要放下这份草稿，开始编辑吗？');}
  async function editMemory(record){
    if(busy||!allowReplace('memory'))return;setBusy(true);
    try{
      await clearDraft('memory');resetMemory();memoryId=record.id;
      $('#memory-caption').value=record.caption;$('#memory-alt').value=record.alt;$('#memory-date').value=record.date;
      $('#memory-file').required=false;$('#cancel-memory-edit').hidden=false;
      memoryForm.querySelector('[type=submit]').textContent='保存照片修改 ↗';showPreview(record.image);
      feedback('memory','正在编辑这张照片。不重新选图，就保留原来的照片。');
      draftStatus('memory','修改后会自动留存草稿。');
    }catch{/* Preserve the previous form if its draft could not be cleared. */}
    finally{setBusy(false);$('#memory-caption').focus();}
  }
  async function editLetter(record){
    if(busy||!allowReplace('letter'))return;setBusy(true);
    try{
      await clearDraft('letter');resetLetter();letterId=record.id;
      for(const [field,value] of Object.entries({name:record.title,body:record.body,from:record.from,date:record.date,identity:record.identity}))$('#letter-'+field).value=value;
      $('#cancel-letter-edit').hidden=false;letterForm.querySelector('[type=submit]').textContent='保存信件修改 ↗';
      feedback('letter','正在编辑这封信。');draftStatus('letter','修改后会自动留存草稿。');
    }catch{/* Preserve the previous form if its draft could not be cleared. */}
    finally{setBusy(false);$('#letter-name').focus();}
  }
  function renderList(kind){
    const items=kind==='memory'?content.memories:content.letters;
    const list=$(kind==='memory'?'#saved-memories':'#saved-letters');list.replaceChildren();
    $(`#${kind}-count`).textContent=`${items.length} ${kind==='memory'?'张':'封'}`;
    if(!items.length){list.append(node('li','saved-empty',kind==='memory'?'还没有收藏照片。第一张，慢慢挑。':'信纸还空着，想好了再写也可以。'));return;}
    items.forEach(record=>{
      const item=node('li','saved-item');
      if(kind==='memory'){const image=node('img','saved-thumbnail');image.src=record.image;image.alt='';image.loading='lazy';item.append(image);}
      else {const mark=node('span','saved-letter-mark','✉');mark.dataset.identity=record.identity;mark.setAttribute('aria-hidden','true');item.append(mark);}
      const description=node('div','saved-description');
      const title=kind==='memory'?(record.caption||'一张照片'):(record.title||'一封信');
      description.append(node('strong',null,title),node('small',null,[kind==='letter'?record.from:'',record.date].filter(Boolean).join(' · ')||'日期留白'));
      const actions=node('div','saved-actions');
      const edit=action('编辑',()=>kind==='memory'?editMemory(record):editLetter(record));edit.setAttribute('aria-label',`编辑${title}`);
      const remove=action('移除',()=>{
        if(busy)return;
        actions.replaceChildren(action('确认移除',()=>removeRecord(kind,record.id)),action('保留',()=>actions.replaceChildren(edit,remove)));
        actions.firstElementChild.focus();
      });remove.setAttribute('aria-label',`移除${title}`);actions.append(edit,remove);item.append(description,actions);list.append(item);
    });
  }
  async function reload(){
    content=await loadLocalContent();loaded=true;onChange(content);renderList('memory');renderList('letter');
    if(memoryId&&!$('#memory-file').files.length&&!draftPhoto){const current=content.memories.find(item=>item.id===memoryId);if(current)showPreview(current.image);}
  }
  async function removeRecord(kind,id){
    if(busy)return;setBusy(true);let removed=false;
    try{
      await deleteLocalContent(kind,id);removed=true;
      if((kind==='memory'&&memoryId===id)||(kind==='letter'&&letterId===id)){
        try{await clearDraft(kind);}catch{/* A different tab's draft remains protected. */}
        kind==='memory'?resetMemory():resetLetter();
      }
      await reload();feedback(kind,kind==='memory'?'这张照片已从本机收藏移除。':'这封信已从本机收藏移除。');
    }catch(error){feedback(kind,removed?'内容已移除，列表暂时未能刷新。请重新打开页面查看。':error.message||'暂时无法移除，请重试。',true);}
    finally{setBusy(false);if(removed)$(`#${kind==='memory'?'photo':'letter'}-tab`).focus();}
  }
  function close(){if(!busy)dialog.close();}
  function open(kind='memory'){
    if(dialog.open)return;
    returnFocus=document.activeElement;chooseTab(kind);onOpen();dialog.showModal();
    dialog.scrollTop=0;$(`#${tab==='memory'?'photo':'letter'}-tab`).focus();
    if(!loaded)initialize();
  }
  $('#add-content').addEventListener('click',()=>open());
  document.addEventListener('content-add',event=>open(event.detail?.kind));
  document.addEventListener('content-edit',async event=>{
    if(event.detail?.kind!=='memory'||busy)return;
    if(!loaded)await initialize();
    const record=content.memories.find(item=>item.id===event.detail.id);if(!record)return;
    open('memory');chooseTab('memory');await editMemory(record);
  });
  $('#close-editor').addEventListener('click',close);
  // Keep drafts when the panel closes; an accidental click outside never drops them.
  dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();});
  dialog.addEventListener('close',()=>{
    onClose();
    const fallback=document.querySelector('.story-dialog[open] .close-story')||$('#add-content');
    (returnFocus?.isConnected?returnFocus:fallback).focus({preventScroll:true});
  });
  for(const [kind,prefix] of [['memory','photo'],['letter','letter']]){
    $(`#${prefix}-tab`).addEventListener('click',()=>chooseTab(kind));
    $(`#${prefix}-tab`).addEventListener('keydown',event=>{
      if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();chooseTab(event.key==='Home'?'memory':event.key==='End'?'letter':tab==='memory'?'letter':'memory',true);
      }
    });
  }
  $('#cancel-memory-edit').addEventListener('click',()=>{if(allowReplace('memory'))discardAndReset('memory');});
  $('#cancel-letter-edit').addEventListener('click',()=>{if(allowReplace('letter'))discardAndReset('letter');});
  $('#memory-file').addEventListener('change',()=>{
    const file=$('#memory-file').files[0];if(!file){$('#memory-file').required=!memoryId&&!draftPhoto;showSavedPhoto();return;}
    if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.type)||file.size>20*1024*1024||!file.size){
      $('#memory-file').value='';$('#memory-file').required=!memoryId&&!draftPhoto;showSavedPhoto();feedback('memory','请选择不超过 20 MB 的 JPG、PNG、WebP、GIF 或 AVIF 照片。',true);return;
    }
    const previousPhoto=draftPhoto;draftPhoto=file;$('#memory-file').required=false;
    showPreview();previewURL=URL.createObjectURL(file);const image=node('img');image.src=previewURL;image.alt='待收藏的照片预览';
    image.addEventListener('error',()=>{if($('#photo-preview').contains(image)){$('#memory-file').value='';draftPhoto=previousPhoto;$('#memory-file').required=!memoryId&&!draftPhoto;showSavedPhoto();persistDraft('memory');feedback('memory','这张照片未能打开，请换一张可正常查看的图片。',true);}},{once:true});
    $('#photo-preview').replaceChildren(image);feedback('memory','照片已选好，保存后会出现在白丝带上。');dirty.memory=true;persistDraft('memory');
  });
  memoryForm.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);feedback('memory','正在收好照片…');let saved=false;
    try{
      await saveLocalMemory({id:memoryId||undefined,file:$('#memory-file').files[0]||draftPhoto||undefined,caption:$('#memory-caption').value,alt:$('#memory-alt').value,date:$('#memory-date').value});
      saved=true;const cleared=await clearSubmittedDraft('memory');
      resetMemory();await reload();feedback('memory',cleared?'已放到白丝带上。回到花园，轻点白丝带就能看见。':drafts.memory.conflict?'照片已保存，另一页面的草稿仍保留，请在草稿提示中选择。':'照片已保存；本机草稿暂未清理完成，请先保留页面。',!cleared);
    }catch(error){feedback('memory',saved?'照片已保存，列表暂时未能刷新。请重新打开页面查看。':error.message||'照片还没有保存，请重试。',true);}
    finally{setBusy(false);}
  });
  letterForm.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);feedback('letter','正在收好信件…');let saved=false;
    try{
      await saveLocalLetter({id:letterId||undefined,title:$('#letter-name').value,body:$('#letter-body').value,from:$('#letter-from').value,date:$('#letter-date').value,identity:$('#letter-identity').value});
      saved=true;const cleared=await clearSubmittedDraft('letter');
      resetLetter();await reload();feedback('letter',cleared?'已收进本机信箱。回到花园，打开信箱就能读到。':drafts.letter.conflict?'信件已保存，另一页面的草稿仍保留，请在草稿提示中选择。':'信件已保存；本机草稿暂未清理完成，请先保留页面。',!cleared);
    }catch(error){feedback('letter',saved?'信件已保存，列表暂时未能刷新。请重新打开页面查看。':error.message||'信件还没有保存，请重试。',true);}
    finally{setBusy(false);}
  });
  $('#download-content').addEventListener('click',async()=>{
    if(busy)return;setBusy(true);
    try{await downloadContentBackup();feedback('backup','备份已交给浏览器下载，请保留好文件。备份包含此浏览器添加的照片和信件。');}
    catch(error){feedback('backup',error.message||'备份暂时未能下载，请重试。',true);}
    finally{setBusy(false);}
  });
  $('#restore-content').addEventListener('click',()=>$('#content-backup-file').click());
  $('#content-backup-file').addEventListener('change',async()=>{
    const file=$('#content-backup-file').files[0];if(!file||busy)return;setBusy(true);feedback('backup','正在读取备份…');let restored=false;
    try{
      const result=await restoreContentBackup(file);restored=true;await reload();
      feedback('backup',`已恢复 ${result.memories} 张照片、${result.letters} 封信；已有的收藏会保留，重复备份不会再添加。`);
    }catch(error){feedback('backup',restored?'备份已恢复，列表暂时未能刷新。请重新打开页面查看。':error.message||'备份未能恢复，原来的收藏仍在。',true);}
    finally{$('#content-backup-file').value='';setBusy(false);}
  });
  function initialize(){
    if(initialization)return initialization;
    setBusy(true);feedback('backup','正在读取照片与收藏…');
    initialization=(async()=>{
      let importError;
      try{
        let result;
        try{result=await importProvidedPhotos();}catch(error){importError=error;}
        // A failed original import must not hide previously saved personal content.
        await reload();await restoreDrafts();
        if(importError){loaded=false;feedback('backup',importError.message||'原图暂时未能导入，请重新打开页面重试。',true);}
        else feedback('backup',result?.imported?`已收好 ${result.imported} 张照片，原图和原比例都保留了。`:'');
      }catch(error){feedback('backup',error.message||'暂时无法读取本机收藏，请重新打开页面。',true);}
      finally{setBusy(false);initialization=null;if(dialog.open)$(`#${tab==='memory'?'photo':'letter'}-tab`).focus({preventScroll:true});}
    })();
    return initialization;
  }
  const ready=initialize();
  return {open,ready};
}
