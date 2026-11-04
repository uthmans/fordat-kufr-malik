export interface UpdateRegistration { update(): Promise<unknown>; }
export interface UpdateCallbacks {
  immediate: boolean;
  onNeedReload(): void;
  onRegisteredSW(url: string, registration?: UpdateRegistration): void;
  onRegisterError(error: unknown): void;
}
export interface AppUpdateState {
  available: boolean;
  status: 'idle' | 'checking' | 'ready' | 'applying' | 'error' | 'unsupported';
}

// The PWA library reports an activated update here. It never reloads a form:
// reloading is allowed only through the explicit apply() action.
export function createAppUpdater(
  register: (callbacks: UpdateCallbacks) => unknown,
  reload: () => void,
  notify: (state: AppUpdateState) => void
) {
  let registration: UpdateRegistration | undefined;
  let available = false;
  let stopped = false;
  let connecting = false;
  let checking = false;
  let applying = false;
  const publish = (status: AppUpdateState['status']) => {
    if (!stopped) notify({ available, status });
  };
  const connect = () => {
    if (stopped || connecting) return;
    connecting = true;
    publish('checking');
    try {
      register({
        immediate: true,
        onNeedReload() { available = true; publish('ready'); },
        onRegisteredSW(_url, value) {
          if (stopped) return;
          connecting = false;
          registration = value;
          publish(available ? 'ready' : value ? 'idle' : 'error');
        },
        onRegisterError() { connecting = false; publish(available ? 'ready' : 'error'); }
      });
    } catch { connecting = false; publish('error'); }
  };
  connect();
  return {
    async check() {
      if (stopped || applying || checking) return;
      if (!registration) { connect(); return; }
      checking = true;
      publish('checking');
      try {
        await registration.update();
        publish(available ? 'ready' : 'idle');
      } catch { publish(available ? 'ready' : 'error'); }
      finally { checking = false; }
    },
    apply() {
      if (stopped || !available || applying) return;
      applying = true;
      publish('applying');
      try { reload(); }
      catch { applying = false; publish('error'); }
    },
    stop() { stopped = true; }
  };
}
