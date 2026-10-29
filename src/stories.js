import {memories as suppliedMemories,letters as suppliedLetters} from './personal-content.js';
import './stories.css';

const records=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
const contentText=value=>typeof value==='string'?value:typeof value==='number'?String(value):'';
let memories=[],letters=[],storyEvents;

const element=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=String(text);
  return node;
};
function button(text,className,action){
  const node=element('button',className,text);node.type='button';
  node.addEventListener('click',action);return node;
}
function dateLabel(value){
  const label=contentText(value).trim();
  const date=element('time','story-date',label);
  date.hidden=!label;
  if(/^\d{4}-\d{2}-\d{2}$/.test(label))date.dateTime=label;
  return date;
}
function photograph(memory,eager=false){
  const frame=element('div','story-photograph');
  const image=element('img');image.alt=contentText(memory.alt)||contentText(memory.caption)||'一段共同的回忆';
  image.loading=eager?'eager':'lazy';image.decoding='async';
  image.addEventListener('load',()=>{
    frame.dataset.orientation=image.naturalHeight>image.naturalWidth?'portrait':'landscape';
  },{once:true});
  const fallback=element('div','photo-unavailable');fallback.hidden=true;
  fallback.append(element('span',null,'照片暂时没有打开'),element('small',null,'这段回忆的文字仍在这里。'));
  const fail=()=>{image.hidden=true;fallback.hidden=false;frame.classList.add('is-unavailable');};
  image.addEventListener('error',fail,{once:true});
  if(typeof memory.image==='string'&&memory.image.trim())image.src=memory.image;else fail();
  frame.append(image,fallback);return frame;
}
function resetScroll(dialog){dialog.scrollTop=0;}
// Escape backs out of a detail before the garden's dialog handler closes it.
function installDetailEscape(dialog,isDetail,back){
  dialog.addEventListener('cancel',event=>{
    if(!isDetail())return;
    event.preventDefault();event.stopImmediatePropagation();back();
  },{capture:true,signal:storyEvents.signal});
}

function addContentButton(kind){
  return button(kind==='memory'?'收藏第一张照片 ↗':'写下第一封信 ↗','story-add-content',()=>{
    document.dispatchEvent(new CustomEvent('content-add',{detail:{kind}}));
  });
}
export function prepareStories(local={memories:[],letters:[]}){
  storyEvents?.abort();storyEvents=new AbortController();
  memories=[...records(suppliedMemories),...records(local.memories)];
  letters=[...records(suppliedLetters),...records(local.letters)];
  const memoryContent=document.querySelector('#memory-content'),letterContent=document.querySelector('#letter-content');
  const rememberedPhoto={id:memoryContent.dataset.memoryId,index:Number(memoryContent.dataset.pageIndex)||0};
  memoryContent.replaceChildren();letterContent.replaceChildren();
  memoryContent.classList.remove('has-memories','is-reading-photo','is-paged-album');
  memoryContent.setAttribute('aria-busy','false');
  if(!memories.length){
    memoryContent.innerHTML='<div class="empty-memory"><div class="empty-photo" aria-hidden="true"></div><p>这一段丝带，还留着空白。</p><small>还没有放入照片</small></div>';
    memoryContent.firstElementChild.append(addContentButton('memory'));
  }else prepareMemories(memoryContent,rememberedPhoto);
  if(!letters.length){
    letterContent.innerHTML='<div class="empty-letter"><div class="envelope-mark" aria-hidden="true"></div><p>信箱还空着。</p><small>这里会收好，写给彼此的信。</small></div>';
    letterContent.firstElementChild.append(addContentButton('letter'));
  }else prepareLetters(letterContent);
}

function prepareMemories(root,remembered={}){
  const dialog=root.closest('dialog'),signal=storyEvents.signal,photos=memories;
  const found=remembered.id?photos.findIndex(photo=>photo.id===remembered.id):-1;
  let shown=Math.max(0,Math.min(photos.length-1,found>=0?found:remembered.index||0)),desired=shown;
  let currentPage=null,running=false,runNumber=0,animations=[],swipe=null;
  const decoded=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('has-memories','is-reading-photo','is-paged-album');
  const toolbar=element('nav','album-toolbar');toolbar.setAttribute('aria-label','照片阅读');
  const count=element('span','story-position');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  toolbar.append(element('p','album-label','一页，一段回忆。'),count);
  const stage=element('div','album-stage');stage.setAttribute('aria-label','照片翻阅区');
  stage.setAttribute('aria-roledescription','分页相册');
  const status=element('span','album-photo-status','照片正在打开…');status.setAttribute('role','status');status.hidden=true;stage.append(status);
  const pagination=element('nav','story-pagination album-pagination');pagination.setAttribute('aria-label','照片翻页');
  const prev=button('← 上一页','story-page-button album-prev',()=>turn(desired-1));
  const next=button('下一页 →','story-page-button album-next',()=>turn(desired+1));
  const hint=element('span','album-page-hint','左右滑动翻页');hint.hidden=photos.length<2;
  pagination.append(prev,hint,next);
  const tools=element('div','story-original-tools');
  const original=element('a','story-original','打开原图 ↗');original.target='_blank';original.rel='noopener';original.hidden=true;
  const add=button('添一张照片 +','album-add story-add-content',()=>document.dispatchEvent(new CustomEvent('content-add',{detail:{kind:'memory'}})));
  tools.append(original,add);root.append(toolbar,stage,pagination,tools);

  function busy(value){root.setAttribute('aria-busy',String(value));}
  function updateButtons(){
    const focused=document.activeElement;
    prev.disabled=desired===0;next.disabled=desired===photos.length-1;
    if(focused===prev&&prev.disabled&&!next.disabled)next.focus({preventScroll:true});
    else if(focused===next&&next.disabled&&!prev.disabled)prev.focus({preventScroll:true});
  }
  function updateReading(){
    count.textContent=`${shown+1} / ${photos.length}`;
    root.dataset.pageIndex=String(shown);root.dataset.memoryId=photos[shown].id||'';
    original.hidden=true;original.removeAttribute('href');
    try{
      const url=new URL(photos[shown].image,location.href);
      if(['http:','https:','blob:'].includes(url.protocol)){original.href=url.href;original.hidden=false;}
    }catch{/* A missing picture can still show its text and navigation. */}
  }
  function readPhoto(index){
    if(decoded.has(index))return decoded.get(index);
    const photo=photos[index],image=new Image();image.decoding='async';image.loading='eager';
    image.alt=contentText(photo.alt)||contentText(photo.caption)||`第 ${index+1} 张照片`;
    const ready=(async()=>{
      if(typeof photo.image!=='string'||!photo.image.trim())return {image:null};
      image.src=photo.image;
      try{await image.decode();return image.naturalWidth?{image}:{image:null};}catch{return {image:null};}
    })();
    decoded.set(index,ready);return ready;
  }
  function warmNeighbors(){
    for(const index of [shown-1,shown+1])if(index>=0&&index<photos.length)readPhoto(index);
    for(const index of decoded.keys())if(Math.abs(index-shown)>1&&index!==desired)decoded.delete(index);
  }
  function makePage(index,{image}){
    const photo=photos[index],page=element('figure','memory-reader album-page');
    page.dataset.index=String(index);page.dataset.current='true';
    page.setAttribute('role','group');page.setAttribute('aria-label',`第 ${index+1} 张，共 ${photos.length} 张照片`);
    const frame=element('div','story-photograph');
    if(image){frame.dataset.orientation=image.naturalHeight>image.naturalWidth?'portrait':'landscape';frame.append(image);}
    else{
      const unavailable=element('div','photo-unavailable');
      unavailable.append(element('span',null,'照片暂时没有打开'),element('small',null,'可以继续翻页，这段回忆的文字仍在。'));
      frame.classList.add('is-unavailable');frame.append(unavailable);
    }
    const caption=element('figcaption','album-caption');
    caption.append(element('span',null,contentText(photo.caption)),dateLabel(photo.date));
    caption.hidden=!contentText(photo.caption).trim()&&!contentText(photo.date).trim();
    if(!caption.hidden){caption.tabIndex=0;caption.setAttribute('aria-label','照片说明');}
    page.append(frame,caption);return page;
  }
  async function pump(){
    if(running||signal.aborted)return;
    running=true;const thisRun=++runNumber;busy(true);
    try{
      while(!signal.aborted&&thisRun===runNumber&&(!currentPage||shown!==desired)){
        const index=desired;status.hidden=false;
        const photo=await readPhoto(index);
        if(signal.aborted||thisRun!==runNumber)return;
        if(index!==desired)continue;
        status.hidden=true;
        const outgoing=currentPage,incoming=makePage(index,photo),direction=index>=shown?1:-1;
        currentPage=incoming;shown=index;stage.append(incoming);updateReading();
        if(outgoing){outgoing.dataset.current='false';outgoing.setAttribute('aria-hidden','true');}
        if(outgoing&&dialog.open&&!motion.matches){
          const options={duration:240,easing:'cubic-bezier(.22,.7,.2,1)',fill:'both'};
          animations=[
            outgoing.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-direction*28}px)`}],options),
            incoming.animate([{opacity:0,transform:`translateX(${direction*34}px)`},{opacity:1,transform:'translateX(0)'}],options)
          ];
          await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
          if(signal.aborted||thisRun!==runNumber)return;
        }
        outgoing?.remove();for(const animation of animations)animation.cancel();animations=[];warmNeighbors();
      }
    }finally{
      if(!signal.aborted&&thisRun===runNumber){running=false;busy(false);status.hidden=true;updateButtons();}
    }
  }
  function turn(index){
    desired=Math.max(0,Math.min(photos.length-1,index));updateButtons();pump();
  }
  function settle(){
    ++runNumber;running=false;desired=shown;
    for(const animation of animations)animation.cancel();animations=[];
    for(const page of stage.querySelectorAll('.album-page'))if(page!==currentPage)page.remove();
    if(!signal.aborted){busy(false);status.hidden=true;updateButtons();if(!currentPage)pump();}
  }
  signal.addEventListener('abort',settle,{once:true});
  dialog.addEventListener('close',settle,{signal});
  motion.addEventListener('change',event=>{if(event.matches)settle();},{signal});
  dialog.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable],.album-caption'))return;
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      turn(event.key==='Home'?0:event.key==='End'?photos.length-1:desired+(event.key==='ArrowRight'?1:-1));
    }
  },{signal});
  stage.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!event.isPrimary||event.target.closest('.album-caption,a,button')){swipe=null;return;}
    swipe={id:event.pointerId,x:event.clientX,y:event.clientY};stage.setPointerCapture?.(event.pointerId);
  },{signal});
  stage.addEventListener('pointermove',event=>{
    if(swipe?.id===event.pointerId&&Math.abs(event.clientY-swipe.y)>30&&Math.abs(event.clientY-swipe.y)>Math.abs(event.clientX-swipe.x))swipe=null;
  },{signal,passive:true});
  stage.addEventListener('pointerup',event=>{
    if(swipe?.id!==event.pointerId)return;
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
    if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.35)turn(desired+(dx<0?1:-1));
  },{signal});
  stage.addEventListener('pointercancel',()=>{swipe=null;},{signal});
  updateReading();updateButtons();pump();
}

function prepareLetters(root){
  const dialog=root.closest('dialog');let current=-1,origin=0;
  function showEnvelopes(focus=false){
    current=-1;root.replaceChildren();
    const list=element('div','envelope-list');list.setAttribute('aria-label','信件列表');
    letters.forEach((letter,index)=>{
      const open=button('','letter-envelope',()=>{origin=index;showLetter(index);});
      open.dataset.identity=letter.identity==='green'?'green':'purple';
      const seal=element('span','letter-seal');seal.setAttribute('aria-hidden','true');
      const description=element('span','envelope-description');
      description.append(element('span','envelope-title',contentText(letter.title)||'一封信'));
      const metadata=element('span','envelope-meta');
      if(contentText(letter.from))metadata.append(element('span',null,contentText(letter.from)));
      metadata.append(dateLabel(letter.date));description.append(metadata);
      const arrow=element('span','envelope-arrow','↗');arrow.setAttribute('aria-hidden','true');
      open.append(seal,description,arrow);list.append(open);
    });
    root.append(element('p','collection-note','挑一封，慢慢拆开。'),list);resetScroll(dialog);
    if(focus)list.querySelectorAll('button')[origin]?.focus({preventScroll:true});
  }
  function showLetter(index){
    current=index;const letter=letters[index];root.replaceChildren();
    const toolbar=element('nav','story-reading-tools');toolbar.setAttribute('aria-label','信件阅读');
    const back=button('← 回到信件','story-back',()=>showEnvelopes(true));toolbar.append(back);
    const article=element('article','single-letter');article.dataset.identity=letter.identity==='green'?'green':'purple';
    article.append(element('h3',null,contentText(letter.title)||'一封信'),element('p','single-letter-body',contentText(letter.body)));
    const footer=element('footer','single-letter-signature');
    const signature=element('span');const mark=element('span',`identity-mark ${article.dataset.identity}`);mark.setAttribute('aria-hidden','true');
    signature.append(mark,document.createTextNode(contentText(letter.from)?` ${contentText(letter.from)}`:''));
    footer.append(signature,dateLabel(letter.date));article.append(footer);
    root.append(toolbar,article);resetScroll(dialog);back.focus({preventScroll:true});
  }
  installDetailEscape(dialog,()=>current>=0,()=>showEnvelopes(true));
  dialog.addEventListener('close',()=>showEnvelopes(),{signal:storyEvents.signal});showEnvelopes();
}
