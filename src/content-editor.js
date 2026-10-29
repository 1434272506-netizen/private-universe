import {loadLocalContent,saveLocalMemory,saveLocalLetter,deleteLocalContent,downloadContentBackup,restoreContentBackup} from './local-content.js';
import {importProvidedPhotos} from './photo-import.js';
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
  let returnFocus=null,loaded=false,tab='memory',initialization=null;
  const dirty={memory:false,letter:false};
  memoryForm.addEventListener('input',()=>{dirty.memory=true;});
  letterForm.addEventListener('input',()=>{dirty.letter=true;});

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
    memoryForm.reset();memoryId=null;dirty.memory=false;$('#memory-file').required=true;
    $('#cancel-memory-edit').hidden=true;memoryForm.querySelector('[type=submit]').textContent='放到白丝带上 ↗';showPreview();
  }
  function resetLetter(){
    letterForm.reset();letterId=null;dirty.letter=false;$('#cancel-letter-edit').hidden=true;
    letterForm.querySelector('[type=submit]').textContent='收进信箱 ↗';
  }
  function showSavedPhoto(){showPreview(content.memories.find(record=>record.id===memoryId)?.image);}
  function chooseTab(kind,focus=false){
    tab=kind==='letter'?'letter':'memory';
    for(const [name,prefix] of [['memory','photo'],['letter','letter']]){
      const selected=name===tab,button=$(`#${prefix}-tab`);
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      $(`#${prefix}-panel`).hidden=!selected;if(selected&&focus)button.focus();
    }
  }
  function allowReplace(kind){return !dirty[kind]||confirm('表单里还有未保存的内容。要放下这份草稿，开始编辑吗？');}
  function editMemory(record){
    if(busy||!allowReplace('memory'))return;resetMemory();memoryId=record.id;
    $('#memory-caption').value=record.caption;$('#memory-alt').value=record.alt;$('#memory-date').value=record.date;
    $('#memory-file').required=false;$('#cancel-memory-edit').hidden=false;
    memoryForm.querySelector('[type=submit]').textContent='保存照片修改 ↗';showPreview(record.image);
    feedback('memory','正在编辑这张照片。不重新选图，就保留原来的照片。');
    $('#memory-caption').focus();
  }
  function editLetter(record){
    if(busy||!allowReplace('letter'))return;resetLetter();letterId=record.id;
    for(const [field,value] of Object.entries({name:record.title,body:record.body,from:record.from,date:record.date,identity:record.identity}))$('#letter-'+field).value=value;
    $('#cancel-letter-edit').hidden=false;letterForm.querySelector('[type=submit]').textContent='保存信件修改 ↗';
    feedback('letter','正在编辑这封信。');$('#letter-name').focus();
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
    if(memoryId&&!$('#memory-file').files.length){const current=content.memories.find(item=>item.id===memoryId);if(current)showPreview(current.image);}
  }
  async function removeRecord(kind,id){
    if(busy)return;setBusy(true);let removed=false;
    try{
      await deleteLocalContent(kind,id);removed=true;
      if(kind==='memory'&&memoryId===id)resetMemory();if(kind==='letter'&&letterId===id)resetLetter();
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
  $('#cancel-memory-edit').addEventListener('click',()=>{if(allowReplace('memory')){resetMemory();feedback('memory','可以再收藏一张照片。');}});
  $('#cancel-letter-edit').addEventListener('click',()=>{if(allowReplace('letter')){resetLetter();feedback('letter','可以再写一封信。');}});
  $('#memory-file').addEventListener('change',()=>{
    const file=$('#memory-file').files[0];if(!file){showSavedPhoto();return;}
    if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.type)||file.size>20*1024*1024||!file.size){
      $('#memory-file').value='';showSavedPhoto();feedback('memory','请选择不超过 20 MB 的 JPG、PNG、WebP、GIF 或 AVIF 照片。',true);return;
    }
    showPreview();previewURL=URL.createObjectURL(file);const image=node('img');image.src=previewURL;image.alt='待收藏的照片预览';
    image.addEventListener('error',()=>{if($('#photo-preview').contains(image)){$('#memory-file').value='';showSavedPhoto();feedback('memory','这张照片未能打开，请换一张可正常查看的图片。',true);}},{once:true});
    $('#photo-preview').replaceChildren(image);feedback('memory','照片已选好，保存后会出现在白丝带上。');dirty.memory=true;
  });
  memoryForm.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);feedback('memory','正在收好照片…');let saved=false;
    try{
      await saveLocalMemory({id:memoryId||undefined,file:$('#memory-file').files[0],caption:$('#memory-caption').value,alt:$('#memory-alt').value,date:$('#memory-date').value});
      saved=true;resetMemory();await reload();feedback('memory','已放到白丝带上。回到花园，轻点白丝带就能看见。');
    }catch(error){feedback('memory',saved?'照片已保存，列表暂时未能刷新。请重新打开页面查看。':error.message||'照片还没有保存，请重试。',true);}
    finally{setBusy(false);}
  });
  letterForm.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;setBusy(true);feedback('letter','正在收好信件…');let saved=false;
    try{
      await saveLocalLetter({id:letterId||undefined,title:$('#letter-name').value,body:$('#letter-body').value,from:$('#letter-from').value,date:$('#letter-date').value,identity:$('#letter-identity').value});
      saved=true;resetLetter();await reload();feedback('letter','已收进本机信箱。回到花园，打开信箱就能读到。');
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
        await reload();
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
