// Keep authored /memories paths unchanged in content and IndexedDB. Only URLs
// sent to the network acquire the deployment base and public-content version.
export function publicAssetURL(path){
  if(typeof path!=='string'||!/^(?:\/?)(?:memories|models|textures)\//.test(path))return path;
  const base=import.meta.env?.BASE_URL||'/';
  const version=import.meta.env?.DEV?'':typeof __GARDEN_ASSET_VERSION__==='string'?__GARDEN_ASSET_VERSION__:'';
  const url=base+path.replace(/^\//,'');
  return version?`${url}${url.includes('?')?'&':'?'}v=${version}`:url;
}
