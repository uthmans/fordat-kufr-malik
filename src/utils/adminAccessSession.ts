import { sharedBackend } from '../config/sharedBackend';
import { normalizeDriverAccessCode } from './driverCodeSession';
export const ADMIN_SESSION_KEY = 'kufr_malik_private_admin_session_v1';
type Session = { token: string; expiresAt: string };
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class AdminAccessSession {
  private generation = 0;
  private memory: Session | null = null;
  private volatile = false;
  constructor(private storage: () => Store = () => localStorage,
    private fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}
  read(): Session | null {
    let value: Session | null;
    try { value = this.volatile ? this.memory : JSON.parse(this.storage().getItem(ADMIN_SESSION_KEY) || 'null'); }
    catch { value = this.memory; }
    return value && /^[a-f0-9]{64}$/.test(value.token) && Date.parse(value.expiresAt)>Date.now() ? value : null;
  }
  private save(value: Session | null) {
    this.memory=value; this.volatile=false;
    try { if(value) this.storage().setItem(ADMIN_SESSION_KEY,JSON.stringify(value)); else this.storage().removeItem(ADMIN_SESSION_KEY); }
    catch { this.volatile=true; }
  }
  private async request(action: string, code?: string, token?: string) {
    const response=await this.fetcher(`${sharedBackend.url}/functions/v1/driver-session`,{
      method:'POST',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',apikey:sharedBackend.publishableKey,...(token?{Authorization:`Bearer ${token}`}:{})},
      body:JSON.stringify({action:`admin_${action}`,...(code?{code}:{})})
    });
    return await response.json();
  }
  async login(input: string) {
    const code=normalizeDriverAccessCode(input);
    if(!/^\d{12}$/.test(code)) return false;
    const generation=++this.generation;
    try {
      const data=await this.request('login',code);
      if(generation!==this.generation || data.ok!==true || data.role!=='admin' || !/^[a-f0-9]{64}$/.test(data.token) || !(Date.parse(data.expires_at)>Date.now())) return false;
      this.save({token:data.token,expiresAt:data.expires_at}); return true;
    } catch { return false; }
  }
  async restore() {
    const session=this.read(); const generation=this.generation;
    if(!session) return false;
    try {
      const data=await this.request('restore',undefined,session.token);
      if(generation!==this.generation || this.read()?.token!==session.token) return false;
      if(data.ok===true && data.role==='admin' && Date.parse(data.expires_at)>Date.now()) return true;
      if(data.error==='invalid_session') this.save(null);
    } catch { /* Offline is not admin authorization; keep token for later verification. */ }
    return false;
  }
  async logout() {
    const session=this.read(); ++this.generation; this.save(null);
    try { if(session) await this.request('logout',undefined,session.token); } catch { /* Already signed out locally. */ }
  }
}
