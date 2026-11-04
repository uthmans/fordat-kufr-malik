import { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sharedBackend } from '../config/sharedBackend';
import type { Driver } from '../types';
import { mergeSharedDriverRows, readSharedDriverRow, type PublicDriver, type SharedDriverRow } from '../utils/sharedDriver';
import { SharedPublisher, publishableDriver } from '../utils/sharedPublisher';

let client: SupabaseClient | undefined;
export function sharedClient() {
  return client ??= createClient(sharedBackend.url, sharedBackend.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      storageKey: 'kufr_malik_cloud_session_v1' }
  });
}

export function useSharedDrivers(drivers: Driver[], localDriverId: string | null,
  hydrateOwner: (row: SharedDriverRow) => Driver | undefined) {
  const [rows, setRows] = useState<SharedDriverRow[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline' | 'error'>('connecting');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const latest = useRef({ drivers, localDriverId, hydrateOwner });
  latest.current = { drivers, localDriverId, hydrateOwner };
  const owner = useRef<string | null>(null);
  const alive = useRef(false);
  const authGeneration = useRef(0);
  const starting = useRef(false);
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
        const { data, error } = await db.from('transit_driver_feed')
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
        event: '*', schema: 'public', table: 'transit_driver_feed'
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
    publisher.current = new SharedPublisher(async (snapshot: PublicDriver, revision, signal) => {
      if (!owner.current || owner.current !== snapshot.id || latest.current.localDriverId !== snapshot.id ||
          !navigator.onLine) throw new Error('Session changed or connection lost');
      const query = revision === null
        ? db.from('transit_driver_feed').insert({ driver_id: snapshot.id, snapshot })
        : db.from('transit_driver_feed').update({ snapshot }).eq('driver_id', snapshot.id).eq('revision', revision);
      const { data, error } = await query.select('driver_id,revision,received_at,snapshot').abortSignal(signal).maybeSingle();
      const row = readSharedDriverRow(data);
      if (error || !row) throw new Error('Shared update failed or another phone updated this driver');
      return row;
    }, row => { if (alive.current) { acceptRows([row]); setLastPublished(row.received_at); } },
    () => { if (alive.current) { setSharing(false); setPublishError(true); } });

    const checkOwner = async () => {
      const generation = ++authGeneration.current;
      publisher.current?.stop();
      owner.current = null;
      setOwnerId(null); setSharing(false); setHasAccount(false);
      try {
        const { data: { user }, error } = await db.auth.getUser();
        if (!alive.current || generation !== authGeneration.current) return;
        if (error || !user) return;
        setHasAccount(true);
        const result = await db.from('transit_driver_owners').select('driver_id').eq('user_id', user.id).maybeSingle();
        if (!alive.current || generation !== authGeneration.current) return;
        if (!result.error && typeof result.data?.driver_id === 'string') {
          owner.current = result.data.driver_id;
          setOwnerId(result.data.driver_id);
        }
      } catch { /* Sign-in is retryable; public reading remains available. */ }
    };
    // Never await Supabase calls inside its auth callback (the auth lock is held).
    const { data: auth } = db.auth.onAuthStateChange(event => {
      if (event === 'TOKEN_REFRESHED') return;
      owner.current = null;
      publisher.current?.stop();
      setSharing(false);
      queueMicrotask(() => { if (alive.current) void checkOwner(); });
    });
    void checkOwner();
    const timer = setInterval(() => { if (visible()) void refresh(); }, 300_000);
    const publishTimer = setInterval(() => {
      // GPS can continue while the OS permits it, but viewers unsubscribe when hidden.
      if (navigator.onLine) void publisher.current?.flush();
    }, 2000);
    document.addEventListener('visibilitychange', reconnect);
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', reconnect);
    reconnect();
    return () => {
      alive.current = false; authGeneration.current++;
      publisher.current?.stop(); stopChannel(); auth.subscription.unsubscribe();
      clearInterval(timer); clearInterval(publishTimer);
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('online', reconnect); window.removeEventListener('offline', reconnect);
    };
  }, []);

  useEffect(() => {
    if (!sharing) return;
    if (owner.current !== localDriverId) { publisher.current?.stop(); setSharing(false); return; }
    const driver = drivers.find(d => d.id === owner.current);
    if (driver) publisher.current?.queue(driver);
  }, [drivers, localDriverId, sharing]);

  const startSharing = async () => {
    if (starting.current) return false;
    starting.current = true;
    const id = owner.current;
    const generation = authGeneration.current;
    try {
      if (!id || id !== latest.current.localDriverId || !navigator.onLine) return false;
      const { data, error } = await sharedClient().from('transit_driver_feed')
        .select('driver_id,revision,received_at,snapshot').eq('driver_id', id).maybeSingle();
      if (!alive.current || generation !== authGeneration.current || owner.current !== id || latest.current.localDriverId !== id) return false;
      if (error) return false;
      const row = data ? readSharedDriverRow(data) : null;
      if (data && !row) return false;
      // Reconcile authoritative operational state before publishing from this phone.
      // Keep this phone's new GPS fix and movement anchors, not another phone's.
      const driver = row ? latest.current.hydrateOwner(row) : latest.current.drivers.find(d => d.id === id);
      if (row) acceptRows([row]);
      if (!driver || !publishableDriver(driver, Date.now())) return false;
      publisher.current?.start(id, row);
      publisher.current?.queue(driver);
      setPublishError(false); setSharing(true);
      return true;
    } finally { starting.current = false; }
  };
  const stopSharing = () => { publisher.current?.stop(); setSharing(false); };
  const signIn = async (email: string, password: string) => {
    const { error } = await sharedClient().auth.signInWithPassword({ email: email.trim(), password });
    return !error;
  };
  const signOut = async () => {
    stopSharing(); owner.current = null; setOwnerId(null); setHasAccount(false);
    authGeneration.current++;
    const { error } = await sharedClient().auth.signOut({ scope: 'local' });
    return !error;
  };
  return { rows, status, ownerId, hasAccount, sharing, publishError, lastPublished,
    startSharing, stopSharing, signIn, signOut };
}
