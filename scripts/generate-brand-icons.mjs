import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pocketIconSvg} from '../lib/brand/pocket-mark.ts';
const require=createRequire(import.meta.url);
const sharp=createRequire(require.resolve('next/package.json'))('sharp');
const svg=Buffer.from(pocketIconSvg());
await mkdir(new URL('../public/brand/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/brand/ikopoke.svg',import.meta.url),svg);
for(const size of [192,512])await sharp(svg).resize(size,size).png().toFile(fileURLToPath(new URL(`../public/brand/icon-${size}.png`,import.meta.url)));
await sharp(svg).resize(180,180).png().toFile(fileURLToPath(new URL('../app/apple-icon.png',import.meta.url)));
// ICO supports embedded PNG entries; include small sizes rather than rescaling a large entry.
const smallSvg=Buffer.from(pocketIconSvg().replace('viewBox="0 0 512 512"','viewBox="80 112 352 352"'));
const sizes=[16,32,48],images=await Promise.all(sizes.map(size=>sharp(smallSvg).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
for(let i=0;i<sizes.length;i++){const entry=6+16*i;header[entry]=sizes[i];header[entry+1]=sizes[i];header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(images[i].length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=images[i].length;}
await writeFile(new URL('../app/favicon.ico',import.meta.url),Buffer.concat([header,...images]));
console.log('Generated pocket SVG, 192/512px PNG, Apple icon and favicon.');
