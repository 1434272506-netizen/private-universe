import fs from 'node:fs/promises';
import {ground} from '../../src/natural/land.js';

const file=new URL('./root-contacts.json',import.meta.url);
const contacts=JSON.parse(await fs.readFile(file,'utf8'));
const base=ground(-4.1,-.6);
for(const contact of contacts)contact.y=ground(-4.1+contact.x,-.6+contact.z)-base;
await fs.writeFile(file,JSON.stringify(contacts,null,2)+'\n');
console.log(`Sampled ${contacts.length} root contacts from the actual island terrain.`);
