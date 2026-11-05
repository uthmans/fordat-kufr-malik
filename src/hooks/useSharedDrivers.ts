import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sharedBackend } from '../config/sharedBackend';
import type { Driver } from '../types';
import { mergeSharedDriverRows, readSharedDriverRow, type SharedDriverRow } from '../utils/sharedDriver';
import { SharedPublisher, publishableDriver } from '../utils/sharedPublisher';
import { DriverCodeSession, DRIVER_CODE_SESSION_KEY } from '../utils/driverCodeSession';

let client: SupabaseClient | undefined;
export function sharedClient() {
  return client ??= createClient(sharedBackend.url, sharedBackend.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function useSharedDrivers(drivers: Driver[], localDriverId: string | null,
  hydrateOwner: (row: SharedDriverRow) => Driver | undefined,
  onIdentity: (id: string | null, freshLogin: boolean) => void) {
  const [rows, setRows] = useState<SharedDriverRow[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [sessionPersisted, setSessionPersisted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const latest = useRef({ drivers, localDriverId, hydrateOwner, onIdentity });
  latest.current = { drivers, localDriverId, hydrateOwner, onIdentity };
  const codeSession = useRef<DriverCodeSession | null>(null);
  codeSession.current ??= new DriverCodeSession();
  const owner = useRef<string | null>(null);
  const alive = useRef(false);
  const authGeneration = useRef(0);
  const starting = useRef(false);
  const sharingGeneration = useRef(0);
  const signingIn = useRef(false);
  const publisher = useRef<SharedPublisher | null>(null);

  function acceptRows(incoming: unknown) {
    setRows(current => mergeSharedDriverRows(current, incoming) ?? current);
  }

  useEffect(() => {
    alive.current = true;
    const db = sharedClient();
    let channel: ReturnType<typeof db.channel> | null = null;
    let reading = false;
    let readAgain = false;
    let readerGeneration = 0;
    const visible = () => document.visibilityState === 'visible' && navigator.onLine;
    const refresh = async () => {
      if (!visible()) return;
      if (reading) { readAgain = true; return; }
      reading = true;
      const generation = readerGeneration;
      try {
        const { data, error } = await db.from('transit_driver_live')
          .select('driver_id,revision,received_at,snapshot');
        if (generation !== readerGeneration || !alive.current) return;
        if (error || !mergeSharedDriverRows([], data)) { setStatus('error'); return; }
        acceptRows(data);
        setStatus('connected');
      } catch { if (alive.current) setStatus('error'); }
      finally { reading = false; if (readAgain) { readAgain = false; void refresh(); } }
    };
    const stopChannel = () => {
      readerGeneration++;
      if (channel) { void db.removeChannel(channel); channel = null; }
    };
    const reconnect = () => {
      stopChannel();
      if (!visible()) { setStatus('offline'); return; }
      setStatus('connecting');
      const generation = readerGeneration;
      channel = db.channel('public-driver-feed').on('postgres_changes', {
        event: '*', schema: 'public', table: 'transit_driver_live'
      }, payload => {
        if (!alive.current || !visible() || generation !== readerGeneration) return;
        // Deletion/reassignment is an administrative action: fetch authoritative state.
        if (payload.eventType === 'DELETE') { setRows([]); void refresh(); }
        else if (readSharedDriverRow(payload.new)) acceptRows([payload.new]);
        else setStatus('error');
      }).subscribe(result => {
        if (!alive.current || !visible() || generation !== readerGeneration) return;
        if (result === 'SUBSCRIBED') void refresh();
        else if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT') setStatus('error');
      });
      void refresh();
    };
    publisher.current = new SharedPublisher(async (snapshot, revision, signal) => {
      if (!owner.current || owner.current !== snapshot.id || latest.current.localDriverId !== snapshot.id ||
          !navigator.onLine) throw new Error('Session changed or connection lost');
      return codeSession.current!.publish(snapshot, revision, signal);
    }, row => { if (alive.current) { acceptRows([row]); setLastPublished(row.received_at); } },
    () => { if (alive.current) {
      setSharing(false); setPublishError(true);
      if (!codeSession.current!.read()) {
        owner.current = null; setOwnerId(null); setHasAccount(false); latest.current.onIdentity(null, false);
      }
    } });

    const checkOwner = async () => {
      const generation = ++authGeneration.current;
      publisher.current?.stop();
      owner.current = null;
      setOwnerId(null); setSharing(false); setHasAccount(false); setRestoring(true);
      try {
        const id = await codeSession.current!.restore();
        if (!alive.current || generation !== authGeneration.current) return;
        owner.current = id; setOwnerId(id); setHasAccount(!!id);
        setSessionPersisted(codeSession.current!.remembered);
        latest.current.onIdentity(id, false);
      } catch { /* Keep a saved token for an online retry, without authorizing it. */ }
      finally { if (alive.current && generation === authGeneration.current) setRestoring(false); }
    };
    const syncSession = (event: StorageEvent) => { if (event.key === DRIVER_CODE_SESSION_KEY || event.key === null) void checkOwner(); };
    const retrySavedSession = () => {
      if (visible() && !owner.current && !signingIn.current && codeSession.current!.read()) void checkOwner();
    };
    void checkOwner();
    const timer = setInterval(() => { if (visible()) void refresh(); }, 300_000);
    const publishTimer = setInterval(() => {
      // GPS can continue while the OS permits it, but viewers unsubscribe when hidden.
      if (navigator.onLine) void publisher.current?.flush();
    }, 2000);
    document.addEventListener('visibilitychange', reconnect);
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', reconnect);
    window.addEventListener('storage', syncSession);
    window.addEventListener('online', retrySavedSession);
    document.addEventListener('visibilitychange', retrySavedSession);
    reconnect();
    return () => {
      alive.current = false; authGeneration.current++;
      publisher.current?.stop(); stopChannel();
      clearInterval(timer); clearInterval(publishTimer);
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('online', reconnect); window.removeEventListener('offline', reconnect);
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('online', retrySavedSession);
      document.removeEventListener('visibilitychange', retrySavedSession);
    };
  }, []);

  useEffect(() => {
    if (!sharing) return;
    if (owner.current !== localDriverId) { publisher.current?.stop(); setSharing(false); return; }
    const driver = drivers.find(d => d.id === owner.current);
    if (driver) publisher.current?.queue(driver);
  }, [drivers, localDriverId, sharing]);

  const startSharing = async (readCurrentDriver?: () => Driver | undefined) => {
    if (starting.current) return false;
    starting.current = true;
    const sharingAttempt = ++sharingGeneration.current;
    const id = owner.current;
    const generation = authGeneration.current;
    try {
      if (!id || id !== latest.current.localDriverId || !navigator.onLine) return false;
      const { data, error } = await sharedClient().from('transit_driver_live')
        .select('driver_id,revision,received_at,snapshot').eq('driver_id', id).maybeSingle();
      if (!alive.current || sharingAttempt !== sharingGeneration.current || generation !== authGeneration.current || owner.current !== id || latest.current.localDriverId !== id) return false;
      if (error) return false;
      const row = data ? readSharedDriverRow(data) : null;
      if (data && !row) return false;
      // Reconcile authoritative operational state before publishing from this phone.
      // Keep this phone's new GPS fix and movement anchors, not another phone's.
      const driver = row ? latest.current.hydrateOwner(row) : (readCurrentDriver ? readCurrentDriver() : latest.current.drivers.find(d => d.id === id));
      if (row) acceptRows([row]);
      if (!driver || !publishableDriver(driver, Date.now())) return false;
      publisher.current?.start(id, row);
      publisher.current?.queue(driver);
      setPublishError(false); setSharing(true);
      return true;
    } finally { if (sharingAttempt === sharingGeneration.current) starting.current = false; }
  };
  const stopSharing = () => {
    sharingGeneration.current++; starting.current = false;
    publisher.current?.stop(); setSharing(false); setPublishError(false);
  };
  const signInCode = async (driverId: string, code: string) => {
    signingIn.current = true;
    const generation = ++authGeneration.current;
    stopSharing();
    const result = await codeSession.current!.login(driverId, code);
    signingIn.current = false;
    if (!alive.current || generation !== authGeneration.current) return { ok: false as const, error: 'unavailable' as const };
    if (result.ok) {
      owner.current = result.driverId; setOwnerId(result.driverId); setHasAccount(true);
      setSessionPersisted(codeSession.current!.remembered); setRestoring(false);
      latest.current.onIdentity(result.driverId, true);
    }
    return result;
  };
  const signOut = async () => {
    stopSharing(); owner.current = null; setOwnerId(null); setHasAccount(false);
    authGeneration.current++;
    latest.current.onIdentity(null, false);
    return codeSession.current!.logout();
  };
  return { rows, status, ownerId, hasAccount, sharing, publishError, lastPublished, restoring, sessionPersisted,
    startSharing, stopSharing, signInCode, signOut };
}
