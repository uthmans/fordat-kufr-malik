import { sharedBackend } from '../config/sharedBackend';
import { readSharedDriverRow, type PublicDriver } from './sharedDriver';

export const DRIVER_CODE_SESSION_KEY = 'kufr_malik_driver_code_session_v1';
type StoredSession = { driverId: string; token: string; expiresAt: string };
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CodeLoginResult = { ok: true; driverId: string } |
  { ok: false; error: 'invalid_code' | 'rate_limited' | 'unavailable'; retryAfter?: number };
export function normalizeDriverAccessCode(value: string) {
  return value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0)).trim();
}
const knownDriver = (value: unknown): value is string => typeof value === 'string' && /^driver-[1-8]$/.test(value);

export class DriverCodeSession {
  private memory: StoredSession | null = null;
  private generation = 0;
  private volatile = false;
  private discardedToken: string | null = null;
  remembered = false;
  constructor(private storage: () => StorageLike = () => localStorage,
    private fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  read(): StoredSession | null {
    let value: unknown;
    try { value = this.volatile ? this.memory : JSON.parse(this.storage().getItem(DRIVER_CODE_SESSION_KEY) || 'null'); }
    catch { value = this.memory; }
    const session = value as StoredSession | null;
    if (!session || session.token === this.discardedToken || !knownDriver(session.driverId) || !/^[a-f0-9]{64}$/.test(session.token) ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) return null;
    return session;
  }
  private save(session: StoredSession | null) {
    this.memory = session; this.remembered = false; this.volatile = false;
    try {
      if (session) this.storage().setItem(DRIVER_CODE_SESSION_KEY, JSON.stringify(session));
      else this.storage().removeItem(DRIVER_CODE_SESSION_KEY);
      this.remembered = !!session;
    } catch { this.volatile = true; }
  }
  private async request(body: Record<string, unknown>, token?: string, signal?: AbortSignal, endpoint = 'driver-session'): Promise<any> {
    const abort = new AbortController();
    const cancel = () => abort.abort();
    if (signal?.aborted) abort.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, 15_000);
    try {
      const response = await this.fetcher(`${sharedBackend.url}/functions/v1/${endpoint}`, {
        method: 'POST', cache: 'no-store', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', apikey: sharedBackend.publishableKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
      });
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }
  async login(driverId: string, input: string): Promise<CodeLoginResult> {
    const code = normalizeDriverAccessCode(input);
    if (!knownDriver(driverId) || !/^\d{6,8}$/.test(code)) return { ok: false, error: 'invalid_code' };
    const generation = ++this.generation;
    try {
      const result = await this.request({ action: 'login', driver_id: driverId, code });
      if (generation !== this.generation) return { ok: false, error: 'unavailable' };
      if (!result.ok) return { ok: false, error: result.error === 'rate_limited' ? 'rate_limited'
        : result.error === 'invalid_code' ? 'invalid_code' : 'unavailable',
        retryAfter: Number.isFinite(result.retry_after) ? result.retry_after : undefined };
      if (result.driver_id !== driverId || !/^[a-f0-9]{64}$/.test(result.token) ||
        !Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= Date.now()) return { ok: false, error: 'unavailable' };
      this.discardedToken = null;
      this.save({ driverId, token: result.token, expiresAt: result.expires_at });
      return { ok: true, driverId };
    } catch { return { ok: false, error: 'unavailable' }; }
  }
  async restore(): Promise<string | null> {
    const session = this.read();
    const generation = this.generation;
    if (!session) return null;
    const result = await this.request({ action: 'restore' }, session.token);
    if (generation !== this.generation || this.read()?.token !== session.token) return null;
    if (result.ok && result.driver_id === session.driverId && Date.parse(result.expires_at) > Date.now()) {
      this.remembered = !this.volatile; return session.driverId;
    }
    if (result.error === 'invalid_session') { this.discardedToken = session.token; this.save(null); }
    return null;
  }
  async logout() {
    const session = this.read();
    ++this.generation; this.discardedToken = session?.token ?? null; this.save(null);
    if (!session) return true;
    try { return !!(await this.request({ action: 'logout' }, session.token)).ok; } catch { return false; }
  }
  private acceptSecuritySession(result: any, driverId: string) {
    if(!result.ok || result.driver_id!==driverId || !/^[a-f0-9]{64}$/.test(result.token) ||
      !Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at)<=Date.now()) return false;
    this.discardedToken=null;
    this.save({driverId,token:result.token,expiresAt:result.expires_at});
    return true;
  }
  async changePin(current: string, next: string): Promise<string | null> {
    const session=this.read(); const generation=this.generation;
    if(!session) return 'invalid_session';
    const code=normalizeDriverAccessCode(next);
    if(!/^\d{6,8}$/.test(code)) return 'invalid_code';
    try {
      const result=await this.request({action:'change_pin',code:normalizeDriverAccessCode(current),new_code:code},session.token,undefined,'driver-security');
      if(generation!==this.generation || this.read()?.token!==session.token) return 'invalid_session';
      if(!this.acceptSecuritySession(result,session.driverId)) return result.error || 'unavailable';
      return null;
    } catch { return 'unavailable'; }
  }
  async enrollDevice(code: string, create: (options: any) => Promise<any>): Promise<string | null> {
    const session=this.read(); const generation=this.generation;
    if(!session) return 'invalid_session';
    const valid=()=>generation===this.generation && this.read()?.token===session.token;
    try {
      const begin=await this.request({action:'register_begin',code:normalizeDriverAccessCode(code)},session.token,undefined,'driver-security');
      if(!valid()) return 'invalid_session';
      if(!begin.ok) return begin.error || 'unavailable';
      const response=await create(begin.options);
      if(!valid()) return 'invalid_session';
      const result=await this.request({action:'register_finish',challenge_id:begin.challenge_id,response},session.token,undefined,'driver-security');
      return !valid() ? 'invalid_session' : result.ok ? null : result.error || 'unavailable';
    } catch { return 'cancelled'; }
  }
  async deviceLogin(driverId: string, authenticate: (options: any) => Promise<any>): Promise<CodeLoginResult & { detail?: string }> {
    const generation=++this.generation;
    if(!knownDriver(driverId)) return {ok:false,error:'invalid_code'};
    try {
      const begin=await this.request({action:'login_begin',driver_id:driverId},undefined,undefined,'driver-security');
      if(generation!==this.generation) return {ok:false,error:'unavailable'};
      if(!begin.ok) return {ok:false,error:begin.error==='rate_limited'?'rate_limited':'unavailable',detail:begin.error};
      const response=await authenticate(begin.options);
      if(generation!==this.generation) return {ok:false,error:'unavailable'};
      const result=await this.request({action:'login_finish',challenge_id:begin.challenge_id,response},undefined,undefined,'driver-security');
      if(generation!==this.generation || !this.acceptSecuritySession(result,driverId)) return {ok:false,error:'unavailable'};
      return {ok:true,driverId};
    } catch { return {ok:false,error:'unavailable',detail:'cancelled'}; }
  }
  async removeDeviceUnlock(): Promise<string | null> {
    const session=this.read();
    if(!session) return 'invalid_session';
    try { const result=await this.request({action:'remove_passkeys'},session.token,undefined,'driver-security'); return result.ok?null:result.error || 'unavailable'; }
    catch { return 'unavailable'; }
  }
  async publish(snapshot: PublicDriver, revision: number | null, signal: AbortSignal) {
    const session = this.read();
    if (!session || session.driverId !== snapshot.id) throw new Error('Driver session missing');
    const result = await this.request({ action: 'publish', driver_id: snapshot.id, snapshot, revision }, session.token, signal);
    if (this.read()?.token !== session.token) throw new Error('Driver session changed');
    if (result.error === 'invalid_session') { this.discardedToken = session.token; this.save(null); }
    const row = result.ok ? readSharedDriverRow(result.row) : null;
    if (!row || row.driver_id !== session.driverId) throw new Error('Publication failed');
    return row;
  }
}
