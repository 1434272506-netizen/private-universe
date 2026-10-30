const KEY='private-universe-letter-reading-v1';
const seen=new Map();
let lastStored;
function fingerprint(text){
  let hash=2166136261;
  for(const character of text){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
export function letterReadingKey(letter){
  const version=fingerprint(JSON.stringify([letter.title||'',letter.body||'',letter.from||'',letter.date||'']));
  return `${letter.id||'configured'}:${version}`;
}
function read(){
  try{
    const raw=localStorage.getItem(KEY)||'{}';if(raw===lastStored)return;
    const stored=JSON.parse(raw);lastStored=raw;
    if(stored&&typeof stored==='object'&&!Array.isArray(stored))for(const [key,value] of Object.entries(stored))if(Number.isFinite(value)&&value>0)seen.set(key,value);
  }catch{/* Reading is still available when browser storage is blocked. */}
}
read();
export function isLetterRead(letter){read();return seen.has(letterReadingKey(letter));}
export function markLetterRead(letter){
  read();seen.set(letterReadingKey(letter),Date.now());
  try{
    const entries=[...seen.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5000);
    const serialized=JSON.stringify(Object.fromEntries(entries));localStorage.setItem(KEY,serialized);lastStored=serialized;return true;
  }catch{return false;}
}
