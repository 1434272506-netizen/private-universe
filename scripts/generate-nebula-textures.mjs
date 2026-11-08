// Telescope image credits and observation details are on NASA's Messier catalog pages.
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync,crc32} from 'node:zlib';

const sources = [
  ['m8-lagoon','https://science.nasa.gov/wp-content/uploads/2023/04/hubble_ngc6530_potw2250a-jpg.webp',
    [[41,13,48],[133,44,91],[220,104,113],[255,207,136]]],
  ['m45-pleiades','https://science.nasa.gov/wp-content/uploads/2023/04/interstellar_cloud_in_pleiades-jpg.webp',
    [[22,20,58],[74,64,141],[91,157,225],[194,220,255]]]
];
function chunk(name,data){
  const type=Buffer.from(name),header=Buffer.alloc(8),checksum=Buffer.alloc(4);
  header.writeUInt32BE(data.length);type.copy(header,4);
  checksum.writeUInt32BE(crc32(data,crc32(type)));
  return Buffer.concat([header,data,checksum]);
}
const dir=new URL('../public/textures/constellations/',import.meta.url);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage();
  for(const [name,url,stops] of sources){
    const response=await fetch(url);
    if(!response.ok)throw new Error(url+' '+response.status);
    const data=Buffer.from(await response.arrayBuffer()).toString('base64');
    const pixels=await page.evaluate(async data=>{
      const image=new Image();image.src='data:image/webp;base64,'+data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d'),side=Math.min(image.width,image.height);
      ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,512,512);
      const rgba=ctx.getImageData(0,0,512,512).data,rows=new Uint8Array(513*512);
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){
        const i=(512*y+x)*4,r=Math.hypot(x-255.5,y-255.5)/255;
        const light=Math.min(1,(.25*rgba[i]+.55*rgba[i+1]+.2*rgba[i+2])/210);
        const fade=Math.max(0,Math.min(1,(1-r)/.48));
        rows[y*513+1+x]=Math.round(light*15)*16+Math.round(15*fade*fade*(3-2*fade));
      }
      return Array.from(rows);
    },data);
    const palette=Buffer.alloc(768),alpha=Buffer.alloc(256);
    for(let i=0;i<256;i++){
      const level=(i>>4)/5,k=Math.min(2,Math.floor(level));
      stops[k].forEach((v,c)=>palette[i*3+c]=Math.round(v+(stops[k+1][c]-v)*(level-k)));
      alpha[i]=17*(i%16);
    }
    const header=Buffer.alloc(13);header.writeUInt32BE(512);header.writeUInt32BE(512,4);header[8]=8;header[9]=3;
    await writeFile(new URL(name+'.png',dir),Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),
      chunk('PLTE',palette),chunk('tRNS',alpha),chunk('tEXt',Buffer.from('Source\0'+url)),chunk('IDAT',deflateSync(Buffer.from(pixels),{level:9})),chunk('IEND',Buffer.alloc(0))]));
  }
}finally{await browser.close();}
