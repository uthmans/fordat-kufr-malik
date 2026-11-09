type Gateway = (parameters: Record<string, unknown>) => Promise<{ data: any; error: unknown }>;
const driverId = (value: unknown) => typeof value === 'string' && /^driver-[1-8]$/.test(value);
const allowedOrigin = (origin: string) => origin === 'https://uthmans.github.io' ||
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

export function driverSessionHandler(gateway: Gateway, sourceHash: (source: string) => Promise<string>, adminGateway?: Gateway) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin') ?? '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
    if (origin && !allowedOrigin(origin)) return new Response('{}', { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (request.method !== 'POST') return reply({ ok: false, error: 'invalid_request' }, 405);
    try {
      const text = await request.text();
      if (text.length > 16384) return reply({ ok: false, error: 'invalid_request' }, 413);
      const body = JSON.parse(text);
      if (!body || !['login', 'restore', 'logout', 'publish','admin_login','admin_restore','admin_logout'].includes(body.action)) return reply({ ok: false, error: 'invalid_request' }, 400);
      const admin=body.action.startsWith('admin_');
      const action=admin?body.action.slice(6):body.action;
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
      if (action === 'login' && ((!admin && !driverId(body.driver_id)) || typeof body.code !== 'string' || !(admin?/^\d{12}$/:/^\d{6,8}$/).test(body.code))) {
        return reply({ ok: false, error: 'invalid_code' }, 401);
      }
      if (action !== 'login' && (!token || !/^[a-f0-9]{64}$/.test(token))) return reply({ ok: false, error: 'invalid_session' }, 401);
      if (body.action === 'publish' && (!driverId(body.driver_id) || !body.snapshot ||
        (body.revision !== null && (!Number.isSafeInteger(body.revision) || body.revision < 1)))) return reply({ ok: false, error: 'invalid_request' }, 400);
      // Per-driver limits are authoritative even if an upstream IP header changes.
      const source = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const parameters = { p_action: body.action,
        p_driver_id: body.driver_id ?? null, p_code: body.action === 'login' ? body.code : null,
        p_token: token, p_source: body.action === 'login' ? await sourceHash(source) : null,
        p_snapshot: body.action === 'publish' ? body.snapshot : null,
        p_revision: body.action === 'publish' ? body.revision : null };
      const result=admin ? (adminGateway ? await adminGateway({p_action:action,p_code:action==='login'?body.code:null,
        p_token:token,p_source:action==='login'?await sourceHash(`admin:${source}`):null}) : {data:null,error:true}) : await gateway(parameters);
      const {data,error}=result;
      if (error || !data) return reply({ ok: false, error: 'unavailable' }, 503);
      const status = data.ok ? 200 : data.error === 'rate_limited' ? 429 : data.error === 'conflict' ? 409 : 401;
      if (data.error === 'rate_limited') headers['Retry-After'] = String(data.retry_after ?? 900);
      return reply(data, status);
    } catch { return reply({ ok: false, error: 'invalid_request' }, 400); }
  };
}
