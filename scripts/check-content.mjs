import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {memories,letters,providedPhotoImport} from '../src/personal-content.js';

const defaultPhotoRoot=fileURLToPath(new URL('../public/memories/',import.meta.url));
const supportedImages=new Set(['.jpg','.jpeg','.png','.webp','.avif','.gif']);
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function checkString(record,key,label,errors,{required=false}={}){
  const value=record[key];
  if(value===undefined&&!required)return;
  if(typeof value!=='string'){
    errors.push(`${label}.${key} 必须是字符串。`);return;
  }
  if(required&&!value.trim())errors.push(`${label}.${key} 不能为空。`);
}

function checkDate(value,label,errors){
  if(value===undefined||value==='')return;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1){
    errors.push(`${label}.date 请填写真实日期 YYYY-MM-DD，或留空字符串。`);return;
  }
  const date=new Date(`${value}T00:00:00.000Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value){
    errors.push(`${label}.date 不是有效的日历日期：${value}。`);
  }
}

function isWithin(root,target){
  const relative=path.relative(root,target);
  return relative!==''&&!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative);
}

async function checkImage(image,label,photoRoot,errors){
  if(typeof image!=='string'||!image.trim())return;
  let decoded;
  try{decoded=decodeURIComponent(image);}catch{
    errors.push(`${label}.image 包含无效的网址编码，请直接填写照片文件名。`);return;
  }
  const prefix='/memories/';
  const unsafe=value=>!value.startsWith(prefix)||value!==value.trim()||/[\\\0?#]/.test(value)
    ||value.slice(prefix.length).split('/').some(part=>!part||part==='.'||part==='..');
  if(unsafe(image)||unsafe(decoded)||/%[0-9a-f]{2}/i.test(decoded)){
    errors.push(`${label}.image 只能填写 /memories/ 下的本地照片路径，不能含 ../、查询参数或外部网址。`);return;
  }
  if(!supportedImages.has(path.extname(decoded).toLowerCase())){
    errors.push(`${label}.image 请使用 JPG、PNG、WebP、AVIF 或 GIF 图片；HEIC 请先转换。`);return;
  }
  const target=path.resolve(photoRoot,decoded.slice(prefix.length));
  if(!isWithin(photoRoot,target)){
    errors.push(`${label}.image 超出了照片目录。`);return;
  }
  try{
    const stat=await fs.stat(target);
    if(!stat.isFile())throw new Error('not a file');
    const [realRoot,realTarget]=await Promise.all([fs.realpath(photoRoot),fs.realpath(target)]);
    if(!isWithin(realRoot,realTarget)){
      errors.push(`${label}.image 的实际文件不在照片目录内。`);
    }
  }catch{
    errors.push(`${label}.image 找不到照片文件：public${decoded}。`);
  }
}

/** Validate static content without modifying it or loading any remote image. */
export async function validateContent(content,{photoRoot=defaultPhotoRoot}={}){
  const errors=[];
  const absoluteRoot=path.resolve(photoRoot);
  for(const name of ['memories','letters']){
    if(!Array.isArray(content?.[name]))errors.push(`${name} 必须是数组；暂时没有内容时请保留 []。`);
  }
  if(Array.isArray(content?.memories)){
    for(const [index,memory] of content.memories.entries()){
      const label=`memories[${index}]`;
      if(!isRecord(memory)){errors.push(`${label} 必须是一组照片配置对象。`);continue;}
      checkString(memory,'image',label,errors,{required:true});
      checkString(memory,'caption',label,errors);
      checkString(memory,'alt',label,errors);
      checkDate(memory.date,label,errors);
      await checkImage(memory.image,label,absoluteRoot,errors);
    }
  }
  if(Array.isArray(content?.letters)){
    for(const [index,letter] of content.letters.entries()){
      const label=`letters[${index}]`;
      if(!isRecord(letter)){errors.push(`${label} 必须是一封信的配置对象。`);continue;}
      for(const key of ['title','from'])checkString(letter,key,label,errors);
      checkString(letter,'body',label,errors,{required:true});
      checkDate(letter.date,label,errors);
      if(letter.identity!=='purple'&&letter.identity!=='green'){
        errors.push(`${label}.identity 必须是 purple（你）或 green（她）。`);
      }
    }
  }
  return {valid:errors.length===0,errors,memories:Array.isArray(content?.memories)?content.memories.length:0,
    letters:Array.isArray(content?.letters)?content.letters.length:0};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await validateContent({memories,letters});
  const originalPhotos=providedPhotoImport?.photos||[];
  const originals=await validateContent({memories:originalPhotos,letters:[]});
  result.errors.push(...originals.errors.map(error=>`原图导入：${error}`));
  if(originals.valid){
    for(const photo of originalPhotos){
      const bytes=await fs.readFile(path.join(defaultPhotoRoot,decodeURIComponent(photo.image.slice('/memories/'.length))));
      if(bytes.length!==photo.bytes||createHash('sha256').update(bytes).digest('hex')!==photo.sha256)result.errors.push(`${photo.alt}的原文件校验不一致。`);
    }
  }
  result.valid=result.errors.length===0;
  if(result.valid){
    console.log(`内容配置有效：${result.memories} 张额外预置照片，${result.letters} 封信，${originalPhotos.length} 张首次导入原图。`);
    if(originalPhotos.length)console.log('原图字节数与 SHA-256 均匹配；导入后可在页面编辑说明。');
    else if(!result.memories&&!result.letters)console.log('当前为空，等待真实素材；没有写入或生成任何回忆。');
  }else{
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
  }
}
