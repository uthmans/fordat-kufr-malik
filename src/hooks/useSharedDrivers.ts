import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sharedBackend } from '../config/sharedBackend';
import type { Driver } from '../types';
import { mergeSharedDriverRows, readSharedDriverRow, type SharedDriverRow } from '../utils/sharedDriver';
import { SharedPublisher, publishableDriver } from '../utils/sharedPublisher';
import { DriverCodeSession, DRIVER_CODE_SESSION_KEY } from '../utils/driverCodeSession';
import { planSharingStart, type SharingConflict, type SharingResolution } from '../utils/sharingReconciliation';
import { createDeviceKey, authenticateDeviceKey } from '../utils/deviceUnlock';
import { PublicationError } from '../utils/publicationError';

let client: SupabaseClient | undefined;
export function sharedClient() {
  return client ??= createClient(sharedBackend.url, sharedBackend.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

export function useSharedDrivers(drivers: Driver[], localDriverId: string | null,
  adoptOwner: (driver: Driver) => Driver | undefined,
  onIdentity: (id: string | null, freshLogin: boolean) => void) {
  const [rows, setRows] = useState<SharedDriverRow[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [sessionPersisted, setSessionPersisted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [sharingConflict, setSharingConflict] = useState<SharingConflict | null>(null);
  const latest = useRef({ drivers, localDriverId, adoptOwner, onIdentity });
  latest.current = { drivers, localDriverId, adoptOwner, onIdentity };
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
    let feedHealthy = false;
    let lastRead = 0;
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
        const incoming = error ? null : mergeSharedDriverRows([], data);
        if (!incoming) { feedHealthy = false; setStatus('error'); return; }
        // This is a full authoritative read, so records deleted while offline
        // must not survive indefinitely as last-seen entries.
        setRows(current => mergeSharedDriverRows(current.filter(row => incoming.some(next => next.driver_id === row.driver_id)), incoming) ?? current);
        feedHealthy = true; lastRead = Date.now();
        setStatus('connected');
      } catch { feedHealthy = false; if (alive.current) setStatus('error'); }
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
        else if (result === 'CHANNEL_ERROR' || result === 'TIMED_OUT') { feedHealthy = false; setStatus('error'); }
      });
      void refresh();
    };
    publisher.current = new SharedPublisher(async (snapshot, revision, signal) => {
      if (!owner.current || owner.current !== snapshot.id || latest.current.localDriverId !== snapshot.id ||
          !codeSession.current!.read()) throw new PublicationError('invalid_session');
      if (!navigator.onLine) throw new PublicationError('retryable');
      return codeSession.current!.publish(snapshot, revision, signal);
    }, row => { if (alive.current) { acceptRows([row]); setLastPublished(row.received_at); } },
    error => { if (alive.current) {
      setSharing(false); setPublishError(true);
      if (error instanceof PublicationError && error.kind === 'conflict' && error.row) {
        const local = latest.current.drivers.find(driver => driver.id === owner.current);
        if (local && error.row.driver_id === local.id) {
          acceptRows([error.row]); setSharingConflict({ local, published: error.row });
        }
      }
      if (!codeSession.current!.read()) {
        owner.current = null; setOwnerId(null); setHasAccount(false); latest.current.onIdentity(null, false);
      }
    } }, Date.now, {
      read: async (id, signal) => {
        if (!navigator.onLine) throw new PublicationError('retryable');
        const timeout = new AbortController();
        const cancel = () => timeout.abort();
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        const timer = setTimeout(cancel, 15_000);
        try {
          const { data, error } = await db.from('transit_driver_live')
            .select('driver_id,revision,received_at,snapshot').eq('driver_id', id).abortSignal(timeout.signal).maybeSingle();
          if (error) throw new PublicationError('retryable');
          const row = data ? readSharedDriverRow(data) : null;
          if (data && (!row || row.driver_id !== id)) throw new PublicationError('invalid_request');
          if (row && alive.current && !signal.aborted && owner.current === id) acceptRows([row]);
          return row;
        } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
      },
      onWaiting: value => { if (alive.current) setRecovering(value); }
    });

    const checkOwner = async () => {
      const generation = ++authGeneration.current;
      publisher.current?.stop();
      setSharingConflict(null);
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
    const timer = setInterval(() => {
      if (visible() && (!feedHealthy || Date.now() - lastRead >= 300_000)) void refresh();
      retrySavedSession();
    }, 30_000);
    const recoverPublication = () => {
      if (!navigator.onLine || document.visibilityState === 'visible') publisher.current?.reconnect();
    };
    const publishTimer = setInterval(() => {
      // GPS can continue while the OS permits it, but viewers unsubscribe when hidden.
      if (navigator.onLine) void publisher.current?.flush();
    }, 2000);
    document.addEventListener('visibilitychange', reconnect);
    document.addEventListener('visibilitychange', recoverPublication);
    window.addEventListener('online', recoverPublication);
    window.addEventListener('offline', recoverPublication);
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
      document.removeEventListener('visibilitychange', recoverPublication);
      window.removeEventListener('online', recoverPublication); window.removeEventListener('offline', recoverPublication);
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

  const startSharing = async (readCurrentDriver?: () => Driver | undefined, resolution?: SharingResolution): Promise<boolean | 'conflict'> => {
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
      const local = readCurrentDriver ? readCurrentDriver() : latest.current.drivers.find(d => d.id === id);
      if (!local) return false;
      const plan = planSharingStart(local, row, resolution);
      if (row) acceptRows([row]);
      if (plan.kind === 'invalid') return false;
      if (plan.kind === 'conflict') { setSharingConflict(plan.conflict); return 'conflict'; }
      if (!publishableDriver(plan.driver, Date.now())) return false;
      const driver = latest.current.adoptOwner(plan.driver);
      if (!driver) return false;
      setSharingConflict(null); setLastPublished(null);
      publisher.current?.start(id, row);
      publisher.current?.queue(driver);
      setPublishError(false); setSharing(true);
      return true;
    } finally { if (sharingAttempt === sharingGeneration.current) starting.current = false; }
  };
  const stopSharing = () => {
    sharingGeneration.current++; starting.current = false;
    publisher.current?.stop(); setSharing(false); setPublishError(false); setSharingConflict(null);
  };
  const signInCode = async (driverId: string, code: string, device = false) => {
    signingIn.current = true;
    const generation = ++authGeneration.current;
    stopSharing();
    const result = device ? await codeSession.current!.deviceLogin(driverId, authenticateDeviceKey) : await codeSession.current!.login(driverId, code);
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
  const changePin = async (current: string, next: string) => {
    stopSharing();
    const error=await codeSession.current!.changePin(current,next);
    setSessionPersisted(codeSession.current!.remembered);
    return error;
  };
  const enrollDevice = (code: string) => codeSession.current!.enrollDevice(code,createDeviceKey);
  const removeDeviceUnlock = () => codeSession.current!.removeDeviceUnlock();
  return { rows, status, ownerId, hasAccount, sharing, publishError, recovering, lastPublished, restoring, sessionPersisted, sharingConflict,
    startSharing, stopSharing, signInCode, signOut, changePin, enrollDevice, removeDeviceUnlock };
}
