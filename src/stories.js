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
  memoryContent.replaceChildren();letterContent.replaceChildren();
  memoryContent.classList.remove('has-memories','is-reading-photo');
  if(!memories.length){
    memoryContent.innerHTML='<div class="empty-memory"><div class="empty-photo" aria-hidden="true"></div><p>这一段丝带，还留着空白。</p><small>还没有放入照片</small></div>';
    memoryContent.firstElementChild.append(addContentButton('memory'));
  }else prepareMemories(memoryContent);
  if(!letters.length){
    letterContent.innerHTML='<div class="empty-letter"><div class="envelope-mark" aria-hidden="true"></div><p>信箱还空着。</p><small>这里会收好，写给彼此的信。</small></div>';
    letterContent.firstElementChild.append(addContentButton('letter'));
  }else prepareLetters(letterContent);
}

function prepareMemories(root){
  const dialog=root.closest('dialog');root.classList.add('has-memories');
  let current=-1,origin=0;
  function showCollection(focus=false){
    current=-1;root.replaceChildren();root.classList.remove('is-reading-photo');
    const note=element('p','collection-note','轻点照片，慢慢看。');
    if(memories.length>1)note.append(element('span','collection-scroll-hint','左右滑动，继续这一段回忆。'));
    const track=element('div','memory-track');track.setAttribute('aria-label','丝带上的照片');
    memories.forEach((memory,index)=>{
      const card=element('figure','memory-card');
      const caption=contentText(memory.caption);
      const open=button('', 'open-memory',()=>{origin=index;showPhoto(index);});
      open.setAttribute('aria-label',`查看第 ${index+1} 张照片${caption?`：${caption}`:''}`);
      open.append(photograph(memory));
      card.append(open,element('figcaption',null,caption),dateLabel(memory.date));track.append(card);
    });
    root.append(note,track);resetScroll(dialog);
    if(focus){const active=track.querySelectorAll('button')[origin];active?.focus({preventScroll:true});if(active)track.scrollLeft=active.offsetLeft-track.offsetLeft;}
  }
  function showPhoto(index,focus=true){
    current=index;const memory=memories[index];root.replaceChildren();root.classList.add('is-reading-photo');
    const toolbar=element('nav','story-reading-tools');toolbar.setAttribute('aria-label','照片阅读');
    const back=button('← 回到长卷','story-back',()=>showCollection(true));
    const count=element('span','story-position',`${index+1} / ${memories.length}`);count.setAttribute('aria-live','polite');
    toolbar.append(back,count);
    const figure=element('figure','memory-reader');figure.append(photograph(memory,true));
    const caption=element('figcaption',null,contentText(memory.caption));caption.append(dateLabel(memory.date));figure.append(caption);
    const pagination=element('nav','story-pagination');pagination.setAttribute('aria-label','切换照片');
    const prev=button('← 上一张','story-page-button',()=>showPhoto(current-1));prev.disabled=index===0;
    const next=button('下一张 →','story-page-button',()=>showPhoto(current+1));next.disabled=index===memories.length-1;
    pagination.append(prev,next);root.append(toolbar,figure,pagination);resetScroll(dialog);
    if(typeof memory.image==='string'){
      const originalURL=new URL(memory.image,location.href);
      if(['http:','https:','blob:'].includes(originalURL.protocol)){
        const original=element('a','story-original','打开原图 ↗');original.href=originalURL.href;original.target='_blank';original.rel='noopener';
        const tools=element('div','story-original-tools');tools.append(original);figure.after(tools);
      }
    }
    if(focus)back.focus({preventScroll:true});
  }
  dialog.addEventListener('keydown',event=>{
    if(current<0||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,[contenteditable]'))return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();event.stopPropagation();
      const next=current+(event.key==='ArrowLeft'?-1:1);
      if(next>=0&&next<memories.length)showPhoto(next);
    }
  },{signal:storyEvents.signal});
  installDetailEscape(dialog,()=>current>=0,()=>showCollection(true));
  dialog.addEventListener('close',()=>showCollection(),{signal:storyEvents.signal});showCollection();
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
