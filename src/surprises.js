import {loadSurprises,saveSurprise,completeSurprise,deleteSurprise,decorateArchive,markArchiveSeen,downloadSurprisesBackup,restoreSurprisesBackup} from './surprise-store.js';
import './surprises.css';

const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
const button=(text,handler,className='surprise-secondary')=>{const node=make('button',className,text);node.type='button';node.addEventListener('click',handler);return node;};
const kinds={note:'一张纸条',question:'一个小问题',box:'一个惊喜盒'};
const draftKey='private-universe-surprise-draft-v1';
const noteDraftKey='private-universe-archive-note-drafts-v1';

export function prepareSurprises({onOpen=()=>{},onClose=()=>{},onWorldChange=()=>{},requestPlacement}={}){
  let records=[],view='create',selected=null,editing=null,position=null,archiveIndex=0,returnFocus=null,busy=false,readyLoaded=false;
  const lockedControls=new Map();
  const dialog=make('dialog','surprise-dialog');dialog.id='surprise-dialog';dialog.setAttribute('aria-labelledby','surprise-heading');
  const surface=make('section','surprise-surface');
  const closeButton=button('×',close,'surprise-close icon-button');closeButton.setAttribute('aria-label','收好惊喜，回到花园');
  const header=make('header','surprise-heading');header.append(make('span','tiny-label','LITTLE THINGS IN THE WIND'));
  const title=make('h2',null,'把一点小惊喜，留在风里。');title.id='surprise-heading';
  header.append(title,make('p',null,'留一张纸条，读完后把它收进长椅上的册子。'));
  const tabs=make('nav','surprise-tabs');tabs.setAttribute('aria-label','惊喜与档案');
  for(const [kind,label] of [['create','留一个惊喜'],['active','风里的惊喜'],['archive','长椅档案册']]){
    const tab=button(label,()=>show(kind),'surprise-tab');tab.dataset.view=kind;tabs.append(tab);
  }
  const content=make('div','surprise-content');content.id='surprise-content';
  const status=make('p','surprise-status');status.id='surprise-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const footer=make('footer','surprise-footer');
  footer.append(make('p',null,'惊喜和档案保存在当前浏览器里。紫绿是署名颜色；这里还没有联网寄送或接收权限。'));
  const backupActions=make('div','surprise-backup-actions'),backupInput=make('input');backupInput.type='file';backupInput.accept='application/json,.json';backupInput.hidden=true;backupInput.id='surprise-backup-file';
  backupActions.append(button('下载惊喜与档案备份 ↓',()=>run(async()=>{await downloadSurprisesBackup();message('备份已交给浏览器下载，请保留好文件。');})),button('从备份恢复 ↑',()=>backupInput.click()),backupInput);
  footer.append(backupActions);surface.append(closeButton,header,tabs,content,status,footer);dialog.append(surface);document.querySelector('#app').append(dialog);
  for(const [id,label,kind] of [['leave-surprise','留一个惊喜','create'],['open-archive','翻翻档案册','archive']]){
    const entry=button(label,()=>open(kind),'quiet-button surprise-help-entry');entry.id=id;
    const help=document.querySelector('#help-panel');help.insertBefore(entry,help.querySelector('#replay'));
  }
  function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  function lockControls(){
    for(const node of dialog.querySelectorAll('button,input,textarea,select')){
      if(!lockedControls.has(node))lockedControls.set(node,node.disabled);node.disabled=true;
    }
  }
  function setBusy(value){
    busy=value;dialog.setAttribute('aria-busy',String(value));
    if(value)lockControls();else{for(const [node,disabled] of lockedControls)if(node.isConnected)node.disabled=disabled;lockedControls.clear();}
  }
  async function run(action,{focus}={}){
    if(busy)return;const focused=document.activeElement;setBusy(true);
    try{await action();}catch(error){message(error.message||'暂时没有收好，请重试。',true);}
    finally{
      setBusy(false);
      if(dialog.open&&focused&&!focused.isConnected)(focus?.()||content.querySelector('button:not(:disabled),textarea,input')||closeButton)?.focus({preventScroll:true});
    }
  }
  async function refresh(event){records=await loadSurprises();readyLoaded=true;onWorldChange(records,event);}
  function close(){if(!busy)dialog.close();}
  function open(kind='create',id){
    if(kind==='surprise'){selected=id;show('read');}else{if(kind==='archive'&&id){selected=id;archiveIndex=Math.max(0,archived().findIndex(item=>item.id===id));}show(kind==='archive'?'archive':kind==='active'?'active':'create');}
    if(dialog.open)return;
    returnFocus=document.activeElement;onOpen();dialog.showModal();closeButton.focus({preventScroll:true});
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();});
  dialog.addEventListener('close',()=>{
    onClose();const fallback=document.querySelector('dialog[open] button')||document.querySelector('#help-toggle');
    (returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:fallback)?.focus({preventScroll:true});
  });
  backupInput.addEventListener('change',()=>{
    const file=backupInput.files[0];if(!file)return;
    run(async()=>{
      const count=await restoreSurprisesBackup(file);
      try{await refresh();show(view);message(`已恢复 ${count} 条惊喜与档案，已有内容保留，重复备份不会重复添加。`);}
      catch{message('备份已恢复，列表暂时未能刷新。请重新打开页面查看。',true);}
    }).finally(()=>{backupInput.value='';});
  });
  function archived(){return records.filter(item=>item.status==='archived').sort((a,b)=>b.completedAt-a.completedAt);}
  function show(kind){
    if(kind==='create'&&view==='create'&&content.querySelector('#surprise-form'))return;
    view=kind;content.replaceChildren();
    for(const tab of tabs.children)tab.setAttribute('aria-current',String(tab.dataset.view===kind||(kind==='read'&&tab.dataset.view==='active')));
    if(kind==='create')renderForm();else if(kind==='archive')renderArchive();else if(kind==='read')renderRead();else renderActive();
    if(busy)lockControls();
  }
  function field(label,name,{tag='input',type='text',rows=3,required=false,max=160}={}){
    const wrapper=make('label','surprise-field'),caption=make('span',null,label),input=make(tag);input.id=`surprise-${name}`;input.name=name;
    if(tag==='input')input.type=type;if(tag==='textarea')input.rows=rows;input.required=required;input.maxLength=max;wrapper.append(caption,input);return {wrapper,input};
  }
  function draft(){
    try{const value=JSON.parse(localStorage.getItem(draftKey)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}
    catch{return null;}
  }
  function renderForm(){
    const storedDraft=draft();
    if(!editing&&storedDraft?.id)editing=storedDraft.id;
    const existing=editing?records.find(record=>record.id===editing&&record.status==='active'):null;
    let saved=(storedDraft&&storedDraft.id===editing?storedDraft:null)||existing||(!editing?storedDraft:null)||{};
    // An archived/removed original must never silently consume an unfinished edit.
    if(editing&&readyLoaded&&!existing){editing=null;saved={...saved,id:undefined};message('原来的惊喜已收起或移除，这份草稿可以另存为一个新的惊喜。');}
    const form=make('form','surprise-form');form.id='surprise-form';position=saved.position||position;
    const type=field('这次想留下什么','type',{tag:'select'});
    for(const [value,label] of Object.entries(kinds)){const option=make('option',null,label);option.value=value;type.input.append(option);}type.input.value=saved.type||'note';
    const name=field('标题 · 可以留空','title');name.input.value=saved.title||'';name.input.placeholder='给某一个平常的日子';
    const body=field('想留下的话','body',{tag:'textarea',rows:5,required:true,max:12000});body.input.value=saved.body||'';
    const answer=field('答案 · 可以留空','answer',{tag:'textarea',max:4000});answer.input.value=saved.answer||'';
    const row=make('div','surprise-field-row'),color=field('气球颜色','color',{type:'color'}),owner=field('署名颜色','identity',{tag:'select'});
    color.input.value=saved.color||'#b8a9c7';
    for(const [value,label] of [['purple','淡紫 · 我'],['green','草绿 · 她']]){const option=make('option',null,label);option.value=value;owner.input.append(option);}owner.input.value=saved.identity||'purple';row.append(color.wrapper,owner.wrapper);
    const placement=make('div','surprise-placement'),positionLabel=make('p','surprise-position-label'),presets=field('也可以选一个熟悉的位置','preset',{tag:'select'});
    for(const [value,label] of [['','在花园里挑位置'],['tree','树旁'],['mailbox','信箱旁'],['creek','溪边']]){const option=make('option',null,label);option.value=value;presets.input.append(option);}
    const coordinates={tree:{x:-5.7,z:1},mailbox:{x:5.5,z:-2.3},creek:{x:1.9,z:2.2}};
    const updatePosition=()=>{positionLabel.textContent=position?'已经选好位置，保存后气球会在那里轻轻漂浮。':'先给气球在花园里选一个位置。';};updatePosition();
    const pick=button('去花园里挑位置 ↗',()=>{
      saveDraft();close();
      requestPlacement?.(point=>{if(point){position={x:point.x,z:point.z};updatePosition();saveDraft();}open('create');});
    });pick.id='choose-surprise-position';pick.hidden=typeof requestPlacement!=='function';
    presets.input.addEventListener('change',()=>{if(coordinates[presets.input.value]){position={...coordinates[presets.input.value]};updatePosition();saveDraft();}});
    placement.append(positionLabel,pick,presets.wrapper);
    const submit=make('button','surprise-primary',existing?'保存这个惊喜':'放进花园 ↗');submit.type='submit';
    const draftStatus=make('small','surprise-draft-status');draftStatus.setAttribute('role','status');
    const cancel=button(existing?'取消编辑':'放下这份草稿',()=>{
      if(!confirm('要放下这份未保存的惊喜吗？'))return;
      try{localStorage.removeItem(draftKey);}catch{}editing=null;position=null;content.replaceChildren();renderForm();message('草稿已放下。');
    });
    const actions=make('div','surprise-form-actions');actions.append(submit,cancel);
    form.append(type.wrapper,name.wrapper,body.wrapper,answer.wrapper,row,placement,actions,draftStatus);content.append(form);
    const updateType=()=>{answer.wrapper.hidden=type.input.value!=='question';body.wrapper.firstElementChild.textContent=type.input.value==='question'?'想问的小问题':type.input.value==='box'?'盒子里藏着的话':'想留下的话';};updateType();
    function values(){return {id:editing||undefined,type:type.input.value,title:name.input.value,body:body.input.value,answer:answer.input.value,color:color.input.value,identity:owner.input.value,position};}
    function saveDraft(){
      try{localStorage.setItem(draftKey,JSON.stringify(values()));draftStatus.textContent='这份草稿已存于本机。';}
      catch{draftStatus.textContent='草稿暂时未能保存，请先别刷新页面。';}
    }
    form.addEventListener('input',()=>{updateType();saveDraft();});form.addEventListener('change',saveDraft);
    if(editing)submit.textContent='保存这个惊喜';
    if(saved.body)draftStatus.textContent='上次未写完的惊喜还在这里。';
    form.addEventListener('submit',event=>{
      event.preventDefault();run(async()=>{
        const record=await saveSurprise(values());editing=null;position=null;
        try{localStorage.removeItem(draftKey);}catch{}
        try{await refresh({type:'save',id:record.id});show('active');message('惊喜已放进花园。轻点它，想到什么时候再打开。');}
        catch{message('惊喜已保存，列表暂时未能刷新。请重新打开页面查看。',true);}
      });
    });
  }
  function renderActive(){
    const active=records.filter(record=>record.status==='active');
    if(!active.length){const empty=make('div','surprise-empty');empty.append(make('span','surprise-empty-mark','○'),make('p',null,'风里还没有藏着的惊喜。'),make('small',null,'想到什么，再留一点给往后的日子。'),button('留一个惊喜 ↗',()=>{editing=null;show('create');},'surprise-primary'));content.append(empty);return;}
    content.append(make('p','surprise-small-note','轻点一只气球，慢慢打开。'));
    const list=make('div','surprise-list');
    active.forEach(record=>{
      const item=button('',()=>{selected=record.id;show('read');},'surprise-list-item');item.dataset.surpriseId=record.id;
      const mark=make('span','surprise-balloon-mark');mark.style.setProperty('--balloon-color',record.color);mark.setAttribute('aria-hidden','true');
      const description=make('span','surprise-description');description.append(make('strong',null,record.title||kinds[record.type]),make('small',null,kinds[record.type]));
      item.append(mark,description,make('span',null,'↗'));list.append(item);
    });content.append(list);
  }
  function bodyContent(record,{archive=false}={}){
    const article=make('article','surprise-reading');article.dataset.identity=record.identity;
    article.append(make('span','surprise-kind',kinds[record.type]),make('h3',null,record.title||kinds[record.type]));
    const body=make('p','surprise-body',record.body);
    if(record.type==='box'&&!archive){body.hidden=true;const reveal=button('打开这个小盒子 ↗',()=>{body.hidden=false;reveal.hidden=true;},'surprise-primary');reveal.id='open-surprise-box';article.append(reveal);}
    article.append(body);
    if(record.type==='question'&&record.answer){
      const answer=make('div','surprise-answer');answer.hidden=!archive;answer.append(make('span',null,'原来答案是'),make('p',null,record.answer));
      if(!archive){const reveal=button('看看答案 ↗',()=>{answer.hidden=false;reveal.hidden=true;});reveal.id='reveal-surprise-answer';article.append(reveal);}article.append(answer);
    }
    return article;
  }
  function renderRead(){
    const record=records.find(item=>item.id===selected&&item.status==='active');
    if(!record){show('active');return;}
    content.append(button('← 回到风里的惊喜',()=>show('active'),'surprise-back'),bodyContent(record));
    const actions=make('div','surprise-reading-actions'),complete=button('读完了，放飞收藏 ↗',()=>run(async()=>{
      const result=await completeSurprise(record.id);
      try{await refresh(result.changed?{type:'complete',id:record.id}:undefined);}
      catch{message('惊喜已收进档案，画面暂时未能刷新。请重新打开页面查看。',true);return;}
      setBusy(false);close();document.querySelector('#announcement').textContent='惊喜已读完，长椅上的档案册会把它收好。';
    }),'surprise-primary');complete.id='complete-surprise';
    complete.disabled=record.type==='box';
    content.querySelector('#open-surprise-box')?.addEventListener('click',()=>{complete.disabled=false;});
    const edit=button('再改一改',()=>{
      const pending=draft();
      if(pending&&pending.id!==record.id&&(pending.title||pending.body||pending.answer)&&!confirm('还有另一份未保存的惊喜。要放下它，编辑这一份吗？'))return;
      editing=record.id;show('create');
    }),remove=button('移除',()=>{
      const confirmRemove=button('确认移除',()=>run(async()=>{
        await deleteSurprise(record.id);
        try{await refresh({type:'remove',id:record.id});show('active');message('这个惊喜已从本机移除。');}
        catch{message('惊喜已移除，列表暂时未能刷新。请重新打开页面查看。',true);}
      }));
      actions.replaceChildren(confirmRemove,button('保留',()=>{actions.replaceChildren(complete,edit,remove);}));confirmRemove.focus();
    });actions.append(complete,edit,remove);content.append(actions);
  }
  function renderArchive(){
    const pages=archived();
    if(!pages.length){const empty=make('div','surprise-empty');empty.append(make('span','surprise-empty-mark','⌑'),make('p',null,'册子还留着空白。'),make('small',null,'读完并放飞的惊喜，会一页一页收在这里。'));content.append(empty);return;}
    archiveIndex=Math.max(0,Math.min(archiveIndex,pages.length-1));const record=pages[archiveIndex];selected=record.id;
    const toolbar=make('nav','archive-page-toolbar');toolbar.setAttribute('aria-label','档案翻页');
    const prev=button('← 上一页',()=>turnArchive(archiveIndex-1,'prev')),next=button('下一页 →',()=>turnArchive(archiveIndex+1,'next'));prev.dataset.archiveDirection='prev';next.dataset.archiveDirection='next';prev.disabled=archiveIndex===0;next.disabled=archiveIndex===pages.length-1;
    const count=make('span','archive-page-count',`${archiveIndex+1} / ${pages.length}`);count.setAttribute('role','status');toolbar.append(prev,count,next);
    const paper=make('section','archive-paper');paper.id='archive-paper';paper.append(bodyContent(record,{archive:true}));
    const date=make('time','archive-completed-date',`收在 ${new Date(record.completedAt).toLocaleDateString('zh-CN')}`);date.dateTime=new Date(record.completedAt).toISOString();paper.append(date);
    const marks=make('div','archive-bookmarks');marks.setAttribute('aria-label','花瓣书签');
    for(const owner of ['purple','green']){
      const marked=Boolean(record.bookmarks?.[owner]),mark=button(`${marked?'取下':'夹一片'}${owner==='purple'?'淡紫':'草绿'}花瓣`,()=>run(async()=>{
        await decorateArchive(record.id,{identity:owner,bookmark:!marked});await refresh();show('archive');message(marked?'这片花瓣已取下。':'花瓣已夹在这一页。');
      },{focus:()=>content.querySelector(`.archive-bookmark[data-identity='${owner}']`)}),'archive-bookmark');mark.dataset.identity=owner;mark.setAttribute('aria-pressed',String(marked));marks.append(mark);
    }
    const noteForm=make('form','archive-note-form');noteForm.id='archive-note-form';
    const ownerField=field('这次便签的署名','note-owner',{tag:'select'});
    for(const [value,label] of [['purple','淡紫 · 我'],['green','草绿 · 她']]){const option=make('option',null,label);option.value=value;ownerField.input.append(option);}
    const noteField=field('留在页边的话','note',{tag:'textarea',rows:3,max:2000});
    const noteDraftStatus=make('small','surprise-draft-status');noteDraftStatus.setAttribute('role','status');
    const draftId=owner=>`${record.id}:${owner}`;
    function noteDrafts(){try{const value=JSON.parse(localStorage.getItem(noteDraftKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
    function setNote(){
      const stored=noteDrafts()[draftId(ownerField.input.value)];
      noteField.input.value=typeof stored==='string'?stored:record.notes?.[ownerField.input.value]||'';
      noteDraftStatus.textContent=typeof stored==='string'?'上次未收好的页边草稿还在这里。':'';
    }
    setNote();ownerField.input.addEventListener('change',setNote);
    noteField.input.addEventListener('input',()=>{
      try{const stored=noteDrafts();stored[draftId(ownerField.input.value)]=noteField.input.value;localStorage.setItem(noteDraftKey,JSON.stringify(stored));noteDraftStatus.textContent='便签草稿已留在本机，点“收好这张便签”才会写进档案。';}
      catch{noteDraftStatus.textContent='便签草稿暂时未能保存，请先别刷新页面。';}
    });
    const save=make('button','surprise-primary','收好这张便签');save.type='submit';
    noteForm.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      await decorateArchive(record.id,{identity:ownerField.input.value,note:noteField.input.value});
      try{const stored=noteDrafts();delete stored[draftId(ownerField.input.value)];localStorage.setItem(noteDraftKey,JSON.stringify(stored));}catch{}
      try{await refresh();show('archive');message('页边便签已保存。');}
      catch{message('便签已保存，档案暂时未能刷新。请重新打开页面查看。',true);}
    },{focus:()=>content.querySelector('#surprise-note')});});
    const noteList=make('div','archive-saved-notes');
    for(const owner of ['purple','green'])if(record.notes?.[owner]){const note=make('p','archive-saved-note',record.notes[owner]);note.dataset.identity=owner;noteList.append(note);}
    noteForm.append(ownerField.wrapper,noteField.wrapper,save,noteDraftStatus);content.append(toolbar,paper,marks,noteList,noteForm);
    if(!record.archiveSeenAt)markArchiveSeen(record.id).then(()=>refresh()).catch(()=>message('这页已经打开，浏览器暂时没能记住档案拆阅状态。',true));
  }
  function turnArchive(index,direction){
    const pages=archived();if(busy||!pages.length)return;
    archiveIndex=Math.max(0,Math.min(pages.length-1,index));show('archive');dialog.scrollTop=0;
    const preferred=content.querySelector(`[data-archive-direction='${direction}']:not(:disabled)`);
    (preferred||content.querySelector('.archive-page-toolbar button:not(:disabled)')||closeButton).focus({preventScroll:true});
  }
  dialog.addEventListener('keydown',event=>{
    if(view!=='archive'||busy||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    turnArchive(event.key==='Home'?0:event.key==='End'?archived().length-1:archiveIndex+(event.key==='ArrowRight'?1:-1),event.key==='ArrowLeft'?'prev':'next');
  });
  show('create');
  const ready=refresh().then(()=>{show(view);message('');}).catch(error=>message(error.message||'惊喜暂时没有打开，请重试。',true));
  return {ready,open,getWorldRecords:()=>records,dialog};
}
