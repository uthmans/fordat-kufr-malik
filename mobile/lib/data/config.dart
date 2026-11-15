// Public client configuration; never add a service-role or signing secret.
const backendUrl = String.fromEnvironment(
  'BACKEND_URL',
  defaultValue: 'https://pwrsxqlunxntvqholhiz.supabase.co',
);
const publicKey = String.fromEnvironment(
  'BACKEND_PUBLIC_KEY',
  defaultValue: 'sb_publishable_t-nnKbAUEdtMNjnxsmqdDQ_QRUE7vB5',
);
