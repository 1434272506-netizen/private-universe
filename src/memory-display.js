import {memories as suppliedMemories} from './personal-content.js';
// Display-only suggestions keyed by immutable original IDs; never written to storage.
export const photoInspirations={
  "original-20261029-photo-01": {
    "title": "那天晚上的风与你",
    "note": "这张我一直挺喜欢的。你靠在我旁边，后面的灯再亮，我还是先看你。"
  },
  "original-20261029-photo-02": {
    "title": "非要一起戴傻头盔",
    "note": "头盔加大帽子，你这装备还挺齐全。你在前面笑得这么开心，我在后面也跟着傻乐。"
  },
  "original-20261029-photo-03": {
    "title": "车上打瞌睡的小猪",
    "note": "你闭着眼，我笑得眼睛都快没了。也不知道在开心什么，反正和你待一块儿，我经常就是这样。"
  },
  "original-20261029-photo-04": {
    "title": "抓拍到毫无包袱的丑照",
    "note": "咱俩这是在比谁的眼睛大吗？每次翻到这张，我都想笑。你这个小表情，我得好好留着。"
  },
  "original-20261029-photo-05": {
    "title": "切得七零八落的小狗蛋糕",
    "note": "蛋糕上那只小狗挺可爱，不过还是你更可爱。以后过生日也想这样，挨着你吃蛋糕，再拍一张合照。"
  },
  "original-20261029-photo-06": {
    "title": "蜜桃色的日落",
    "note": "你靠得挺舒服，我被太阳照得眼睛都快睁不开了。这张表情是有点严肃，肩膀还是随时给你靠。"
  },
  "original-20261029-photo-07": {
    "title": "大冬天裹成粽子",
    "note": "这张必须留着。你看镜头，我就负责凑过去亲一下，分工挺明确的。"
  },
  "original-20261029-photo-08": {
    "title": "古亭回廊里的回头",
    "note": "这张你是真的好看。我翻相册翻到这儿，总得停下来多看两眼。以后也想多留几张这样的照片。"
  },
  "original-20261029-photo-09": {
    "title": "专属背景板",
    "note": "你把脸挤成这样，我还非要在后面挤进镜头。咱俩凑一块儿，好像总有拍不完的怪照片。"
  },
  "original-20261029-photo-10": {
    "title": "日常抓狂揉头发",
    "note": "拍糊了也不删。咱俩一个比一个能做鬼脸，这些傻乎乎的小合照，我还挺喜欢的。"
  }
};

const records=value=>Array.isArray(value)?value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[];
const nonempty=value=>typeof value==='string'&&value.trim();
export function memoryDisplay(record){
  const supplied=records(suppliedMemories).find(v=>v.id&&v.id===record.id);
  const inspiration=photoInspirations[record.id];
  return {...record,
    caption:nonempty(record.caption)?record.caption:supplied?.caption||'',
    alt:nonempty(record.alt)?record.alt:supplied?.alt||'',
    date:nonempty(record.date)?record.date:supplied?.date||'',
    title:record.caption||supplied?.alt||inspiration?.title||record.alt||'一张照片'};
}
export function mergeDisplayMemories(local){
  const photos=[],seen=new Map();
  for(const record of records(suppliedMemories)){
    const key=record.id||record.image;
    if(key&&seen.has(key))continue;
    if(key)seen.set(key,photos.length);photos.push(record);
  }
  for(const record of records(local)){
    // loadLocalContent only creates these URLs from validated IndexedDB photo Blobs.
    const editable=typeof record.image==='string'&&record.image.startsWith('blob:');
    const key=record.id||record.image,index=key?seen.get(key):undefined;
    if(index!==undefined){if(editable)photos[index]={...photos[index],...memoryDisplay(record),editable:true};}
    else {if(key)seen.set(key,photos.length);photos.push({...memoryDisplay(record),editable});}
  }
  return photos;
}
