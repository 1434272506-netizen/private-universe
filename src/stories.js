import {memories as suppliedMemories,letters as suppliedLetters} from './personal-content.js';
import './stories.css';
import {isLetterRead,markLetterRead,letterReadingKey} from './letter-reading.js';
import './letter-reading.css';

const records=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
const contentText=value=>typeof value==='string'?value:typeof value==='number'?String(value):'';
// Display-only suggestions keyed by immutable original IDs; never written to storage.
const photoInspirations={
  "original-20261029-photo-01": {
    "title": "夜幕初见·心动回响",
    "note": "那晚桥上的风很大，身后的霓虹很亮，但我的视线里只有你的眼睛。从那一刻起，我知道我的世界多了一束光。"
  },
  "original-20261029-photo-02": {
    "title": "并肩同行·风里冒险",
    "note": "戴上笨笨的安全头盔，在风里一起做鬼脸。只要和你在一起，连迷路都变成了一场最快乐的奇遇。"
  },
  "original-20261029-photo-03": {
    "title": "午后微光·温柔同频",
    "note": "车窗外飞驰而过的树影，车厢里轻柔的呼吸。闭上眼睛，听见两颗心跳在同一个节奏里。"
  },
  "original-20261029-photo-04": {
    "title": "卸下防备·自在天真",
    "note": "不用在乎表情管不管理，不用在乎镜头的角度。能毫无保留地在一个人面前做个傻瓜，是世界上最幸运的事。"
  },
  "original-20261029-photo-05": {
    "title": "烛光心愿·年年有你",
    "note": "小狗蛋糕上的蜡烛在轻轻跳动。你闭上眼睛许愿的时候，我在心底偷偷祈祷：每一个以后的生日，我都想陪你一起吹灭蜡烛。"
  },
  "original-20261029-photo-06": {
    "title": "日落黄昏·笃定相依",
    "note": "太阳落下去的时候，天空被染成了温柔的蜜桃金。你把头靠在我肩上，那一秒，我真希望时间就此静止。"
  },
  "original-20261029-photo-07": {
    "title": "凛冬清晨·抵御严寒",
    "note": "冬夜的空气很冷，但毛绒大衣里的心跳滚烫。脸颊上轻轻落下的一吻，足以抵挡世间所有的风霜。"
  },
  "original-20261029-photo-08": {
    "title": "惊艳时光·为你着迷",
    "note": "朱红色的回廊，雕梁画栋的古亭。世间风景万千，可你在我镜头里轻轻一侧身，就美成了我心底一辈子的惊艳。"
  },
  "original-20261029-photo-09": {
    "title": "默契同频·身后有我",
    "note": "你捧着脸对着镜头古灵精怪，我在你身后悄悄探出脑袋。别害怕前方的路，你一回头，我永远都在。"
  },
  "original-20261029-photo-10": {
    "title": "浮岛永恒·私家宇宙",
    "note": "揉乱你头发时的笑闹，车座上并肩的琐碎日常。我们的爱情不是轰轰烈烈的口号，而是把每一个平凡的日子，都过成闪闪发光的私家宇宙。"
  }
};
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
  const rememberedPhoto={id:memoryContent.dataset.memoryId,index:Number(memoryContent.dataset.pageIndex)||0,flipped:!!memoryContent.querySelector('.photo-card-flipper.is-flipped')};
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
  const cardStates=new WeakMap();
  const decoded=new Map(),motion=matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('has-memories','is-reading-photo','is-paged-album');
  const toolbar=element('nav','album-toolbar');toolbar.setAttribute('aria-label','照片阅读');
  const count=element('span','story-position');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  toolbar.append(element('p','album-label','一页，一段回忆。'),count);
  const stage=element('div','album-stage');stage.setAttribute('aria-label','照片翻阅区');
  stage.setAttribute('aria-roledescription','分页相册');stage.tabIndex=-1;
  const status=element('span','album-photo-status','照片正在打开…');status.setAttribute('role','status');status.hidden=true;stage.append(status);
  const pagination=element('nav','story-pagination album-pagination');pagination.setAttribute('aria-label','照片翻页');
  const prev=button('← 上一页','story-page-button album-prev',()=>turn(desired-1));
  const next=button('下一页 →','story-page-button album-next',()=>turn(desired+1));
  const hint=element('span','album-page-hint','左右滑动翻页');hint.hidden=photos.length<2;
  pagination.append(prev,hint,next);
  const tools=element('div','story-original-tools');
  const original=element('a','story-original','打开原图 ↗');original.target='_blank';original.rel='noopener';original.hidden=true;
  const add=button('添一张照片 +','album-add story-add-content',()=>document.dispatchEvent(new CustomEvent('content-add',{detail:{kind:'memory'}})));
  const flipStatus=element('span','photo-flip-status');flipStatus.setAttribute('role','status');flipStatus.setAttribute('aria-live','polite');flipStatus.setAttribute('aria-atomic','true');
  tools.append(original,add);root.append(toolbar,stage,pagination,tools,flipStatus);

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
    const inspiration=photoInspirations[photo.id];
    const viewport=element('div','photo-card-viewport');viewport.setAttribute('aria-label','3D 照片卡片');
    const flipper=element('div','photo-card-flipper');flipper.tabIndex=0;
    flipper.setAttribute('role','region');flipper.setAttribute('aria-label','可翻转照片与背面小注');
    flipper.setAttribute('aria-keyshortcuts','Space F');
    const front=element('div','photo-card-face photo-card-front');
    const back=element('div','photo-card-face photo-card-back');
    const frontBar=element('div','photo-front-bar');
    const toBack=button('↺ 翻转看背面','photo-flip-trigger',()=>flip(true));
    toBack.setAttribute('aria-label','翻转查看背面手写小注');
    frontBar.append(element('span','photo-card-tag','✦ 珍藏定格 ✦'),toBack);front.append(frame,frontBar);
    const surface=element('div','photo-back-surface'),header=element('div','photo-back-header');
    const postmark=element('div','photo-postmark');postmark.setAttribute('aria-hidden','true');
    postmark.append(element('span','postmark-ring','MEMORIES'),element('span','postmark-date',contentText(photo.date).trim()||'珍藏时光'));
    const seal=element('span','photo-back-seal','💌');seal.setAttribute('aria-hidden','true');header.append(postmark,seal);
    const content=element('div','photo-back-content');content.tabIndex=0;content.setAttribute('aria-label','照片背面小注');
    const personalNote=contentText(photo.caption).trim();
    content.append(element('h4','photo-back-title',inspiration?.title||'这一刻，值得珍藏'),element('p','photo-back-text',personalNote?contentText(photo.caption):inspiration?.note||'在这里，写下只有你们知道的这一刻。'),dateLabel(photo.date));
    if(!personalNote)content.append(element('small','photo-note-inspiration','小注灵感 · 等你亲笔补写'));
    const actions=element('div','photo-back-actions');
    const toFront=button('↻ 翻回正面','photo-flip-back-trigger',()=>flip(false));toFront.setAttribute('aria-label','翻回正面照片');
    const edit=button('✎ 补写小注','photo-edit-note-trigger',()=>document.dispatchEvent(new CustomEvent('content-edit',{detail:{kind:'memory',id:photo.id}})));
    edit.setAttribute('aria-label','编辑这张照片的小注');
    // Supplied read-only fixtures have no IndexedDB record to edit.
    edit.hidden=!photo.id||records(suppliedMemories).includes(photo);
    actions.append(toFront,edit);surface.append(header,content,actions);back.append(surface);flipper.append(front,back);viewport.append(flipper);
    let flipped=false;
    function flip(value,{announce=true,focus=true}={}){
      flipped=value;flipper.classList.toggle('is-flipped',value);flipper.setAttribute('aria-expanded',String(value));
      if(focus&&(front.contains(document.activeElement)||back.contains(document.activeElement)))flipper.focus({preventScroll:true});
      front.setAttribute('aria-hidden',String(value));front.inert=value;
      back.setAttribute('aria-hidden',String(!value));back.inert=!value;
      if(announce)flipStatus.textContent=value?`已翻转至第 ${index+1} 张照片背面小注`:'已翻回照片正面';
    }
    cardStates.set(page,()=>flip(false,{announce:false,focus:false}));
    flipper.addEventListener('keydown',event=>{
      if(event.target.closest('button,a,input,textarea,select,[contenteditable]')||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
      if(event.key===' '||event.key.toLowerCase()==='f'){event.preventDefault();event.stopPropagation();flip(!flipped);}
    });
    flipper.addEventListener('dblclick',event=>{
      if(event.sourceCapabilities?.firesTouchEvents||event.target.closest('button,a,.photo-back-content'))return;
      event.preventDefault();flip(!flipped);
    });
    flip(!!remembered.flipped&&index===shown,{announce:false,focus:false});remembered.flipped=false;
    page.append(viewport,caption);return page;
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
        if(outgoing){outgoing.dataset.current='false';outgoing.setAttribute('aria-hidden','true');outgoing.inert=true;}
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
    const target=Math.max(0,Math.min(photos.length-1,index));
    if(target!==shown){
      if(currentPage?.contains(document.activeElement))stage.focus({preventScroll:true});
      cardStates.get(currentPage)?.();flipStatus.textContent='';
    }
    desired=target;updateButtons();pump();
  }
  function settle(){
    ++runNumber;running=false;desired=shown;
    for(const animation of animations)animation.cancel();animations=[];
    for(const page of stage.querySelectorAll('.album-page'))if(page!==currentPage)page.remove();
    if(!signal.aborted){busy(false);status.hidden=true;updateButtons();if(!currentPage)pump();}
  }
  signal.addEventListener('abort',settle,{once:true});
  dialog.addEventListener('close',()=>{cardStates.get(currentPage)?.();flipStatus.textContent='';settle();},{signal});
  motion.addEventListener('change',event=>{if(event.matches)settle();},{signal});
  dialog.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable],.album-caption'))return;
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      turn(event.key==='Home'?0:event.key==='End'?photos.length-1:desired+(event.key==='ArrowRight'?1:-1));
    }
  },{signal});
  stage.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='touch'||!event.isPrimary||event.target.closest('.album-caption,.photo-back-content,a,button')){swipe=null;return;}
    swipe={id:event.pointerId,x:event.clientX,y:event.clientY,card:event.target.closest('.photo-card-flipper'),started:performance.now()};stage.setPointerCapture?.(event.pointerId);
  },{signal});
  stage.addEventListener('pointermove',event=>{
    if(swipe?.id===event.pointerId&&Math.abs(event.clientY-swipe.y)>30&&Math.abs(event.clientY-swipe.y)>Math.abs(event.clientX-swipe.x))swipe=null;
  },{signal,passive:true});
  stage.addEventListener('pointerup',event=>{
    if(swipe?.id!==event.pointerId)return;
    const gesture=swipe,dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
    if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.35)turn(desired+(dx<0?1:-1));
    else if(gesture.card&&Math.abs(dx)<10&&Math.abs(dy)<10&&performance.now()-gesture.started<500){
      gesture.card.querySelector(gesture.card.classList.contains('is-flipped')?'.photo-flip-back-trigger':'.photo-flip-trigger').click();
    }
  },{signal});
  stage.addEventListener('pointercancel',()=>{swipe=null;},{signal});
  updateReading();updateButtons();pump();
}

function prepareLetters(root){
  const dialog=root.closest('dialog');let current=-1,origin=0;
  function showEnvelopes(focus=false){
    current=-1;root.replaceChildren();
    const list=element('div','envelope-list');list.setAttribute('aria-label','信件列表');
    const ordered=letters.map((letter,index)=>({letter,index,read:isLetterRead(letter)}))
      .sort((a,b)=>Number(a.read)-Number(b.read)||(Date.parse(b.letter.date)||b.letter.createdAt||0)-(Date.parse(a.letter.date)||a.letter.createdAt||0)||a.index-b.index);
    ordered.forEach(({letter,index,read})=>{
      const open=button('','letter-envelope',()=>{origin=index;showLetter(index);});
      open.dataset.identity=letter.identity==='green'?'green':'purple';
      open.dataset.read=String(read);open.dataset.letterKey=letterReadingKey(letter);
      const seal=element('span','letter-seal');seal.setAttribute('aria-hidden','true');
      const description=element('span','envelope-description');
      description.append(element('span','envelope-title',contentText(letter.title)||'一封信'));
      const metadata=element('span','envelope-meta');
      metadata.append(element('span','letter-reading-state',read?'已拆阅':'尚未拆阅'));
      if(contentText(letter.from))metadata.append(element('span',null,contentText(letter.from)));
      metadata.append(dateLabel(letter.date));description.append(metadata);
      const arrow=element('span','envelope-arrow','↗');arrow.setAttribute('aria-hidden','true');
      open.append(seal,description,arrow);list.append(open);
    });
    root.append(element('p','collection-note','挑一封，慢慢拆开。'),element('p','mailbox-reading-note','先放还没拆过的信。拆阅状态只记在这台浏览器里。'),list);resetScroll(dialog);
    if(focus)[...list.querySelectorAll('button')].find(item=>item.dataset.letterKey===letterReadingKey(letters[origin]))?.focus({preventScroll:true});
  }
  function showLetter(index){
    current=index;const letter=letters[index];root.replaceChildren();
    const remembered=markLetterRead(letter);
    const toolbar=element('nav','story-reading-tools');toolbar.setAttribute('aria-label','信件阅读');
    const back=button('← 回到信件','story-back',()=>showEnvelopes(true));toolbar.append(back);
    const article=element('article','single-letter');article.dataset.identity=letter.identity==='green'?'green':'purple';
    article.append(element('h3',null,contentText(letter.title)||'一封信'),element('p','single-letter-body',contentText(letter.body)));
    const footer=element('footer','single-letter-signature');
    const signature=element('span');const mark=element('span',`identity-mark ${article.dataset.identity}`);mark.setAttribute('aria-hidden','true');
    signature.append(mark,document.createTextNode(contentText(letter.from)?` ${contentText(letter.from)}`:''));
    footer.append(signature,dateLabel(letter.date));article.append(footer);
    root.append(toolbar,article);resetScroll(dialog);back.focus({preventScroll:true});
    if(!remembered)root.append(element('p','letter-storage-note','信已打开，浏览器暂时未能保存拆阅记录。'));
  }
  installDetailEscape(dialog,()=>current>=0,()=>showEnvelopes(true));
  dialog.addEventListener('close',()=>showEnvelopes(),{signal:storyEvents.signal});showEnvelopes();
}
