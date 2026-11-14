import * as supplied from './personal-content.js';
import {publicAssetURL} from './public-assets.js';
import {hasOriginalPhotoImport,importOriginalPhotos} from './local-content.js';

let pendingImport;

// Copy the exact JPEG bytes into the editable collection once per browser.
// Keep imported caption/date untouched; memory-display.js supplies display-only fallbacks.
// The committed import marker keeps removed photographs from being re-imported.
export function importProvidedPhotos(){
  if(pendingImport)return pendingImport;
  pendingImport=(async()=>{
    const batch=supplied.providedPhotoImport;
    if(!batch?.photos?.length)return {imported:0,alreadyImported:true};
    if(await hasOriginalPhotoImport(batch.id))return {imported:0,alreadyImported:true};
    const records=await Promise.all(batch.photos.map(async photo=>{
      const response=await fetch(publicAssetURL(photo.image));
      if(!response.ok)throw new Error(`${photo.alt}暂时未能导入，请重新打开页面重试。`);
      const bytes=await response.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const hash=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
      if(bytes.byteLength!==photo.bytes||hash!==photo.sha256)throw new Error(`${photo.alt}的原文件校验未通过，尚未导入。`);
      return {...photo,photo:new Blob([bytes],{type:'image/jpeg'})};
    }));
    return importOriginalPhotos(batch.id,records);
  })().catch(error=>{pendingImport=null;throw error;});
  return pendingImport;
}
