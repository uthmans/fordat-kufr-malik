// Administrator utility: creates a private handover file OUTSIDE the repository.
// Does not publish, print, upload, or rotate existing codes.
import { randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { INITIAL_DRIVERS } from '../src/data/initialDrivers';

const target = resolve('..', 'outputs', 'private-transit', 'driver-access-codes.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(resolve(dirname(target), '.gitignore'), '*\n');
try {
  const current = JSON.parse(await readFile(target, 'utf8'));
  if (!Array.isArray(current.drivers) || current.drivers.length !== INITIAL_DRIVERS.length) throw new Error('Existing file needs administrator review');
  console.log(JSON.stringify({ path: target, count: current.drivers.length, created: false }));
} catch (error: any) {
  if (error.code !== 'ENOENT') throw error;
  const used = new Set(['00000000', '11111111', '12345678', '87654321', '12341234', '99999999']);
  const drivers = INITIAL_DRIVERS.map(driver => {
    let code: string;
    do { code = randomInt(100000000).toString().padStart(8, '0'); } while (used.has(code));
    used.add(code);
    return { driverId: driver.id, nameAr: driver.nameAr, nameEn: driver.nameEn, code };
  });
  await writeFile(target, JSON.stringify({ note: 'PRIVATE: Give each driver only their own code. Never commit or publish this file.', drivers }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ path: target, count: drivers.length, created: true }));
}
