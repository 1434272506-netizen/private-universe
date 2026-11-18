import {memories as suppliedMemories} from './personal-content.js';
// Display-only suggestions keyed by immutable original IDs; never written to storage.
export const photoInspirations={
  "original-20261029-photo-01": {
    "title": "那天晚上的风与你",
    "note": "那晚真想和你再待一会儿。"
  },
  "original-20261029-photo-02": {
    "title": "非要一起戴傻头盔",
    "note": "你一笑，我也忍不住跟着傻乐。"
  },
  "original-20261029-photo-03": {
    "title": "车上打瞌睡的小猪",
    "note": "跟你窝在一起，连发呆都舒服。"
  },
  "original-20261029-photo-04": {
    "title": "抓拍到毫无包袱的丑照",
    "note": "咱俩越想装正经，我就越想笑。"
  },
  "original-20261029-photo-05": {
    "title": "切得七零八落的小狗蛋糕",
    "note": "明年还想和你分一块生日蛋糕。"
  },
  "original-20261029-photo-06": {
    "title": "蜜桃色的日落",
    "note": "你靠着我的时候，我心里特别踏实。"
  },
  "original-20261029-photo-07": {
    "title": "大冬天裹成粽子",
    "note": "看着看着，又想亲你一下了。"
  },
  "original-20261029-photo-08": {
    "title": "古亭回廊里的回头",
    "note": "隔着照片看你，我还是会心动。"
  },
  "original-20261029-photo-09": {
    "title": "专属背景板",
    "note": "和你一起犯傻，我最自在。"
  },
  "original-20261029-photo-10": {
    "title": "日常抓狂揉头发",
    "note": "连这张糊糊的合照，我也舍不得删。"
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
