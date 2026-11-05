import { randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const target=resolve('..','outputs','private-transit','admin-access.json');
await mkdir(dirname(target),{recursive:true});
await writeFile(resolve(dirname(target),'.gitignore'),'*\n');
try {
  const value=JSON.parse(await readFile(target,'utf8'));
  if(!/^\d{12}$/.test(value.code)) throw new Error('Existing admin handover file needs review');
  console.log(JSON.stringify({path:target,created:false}));
} catch(error:any) {
  if(error.code!=='ENOENT') throw error;
  let code:string;
  do { code=randomInt(1_000_000_000_000).toString().padStart(12,'0'); } while(['000000000000','999999999999','123456789012'].includes(code));
  await writeFile(target,JSON.stringify({note:'PRIVATE: administrator only. Never give this code to drivers or commit it.',
    adminUrl:'https://uthmans.github.io/fordat-kufr-malik/#/admin',code},null,2),{flag:'wx'});
  console.log(JSON.stringify({path:target,created:true}));
}
