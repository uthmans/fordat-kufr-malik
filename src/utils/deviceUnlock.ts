export async function supportsDeviceUnlock(): Promise<boolean> {
  try {
    return typeof window!=='undefined' && window.isSecureContext && window.location.hostname!=='127.0.0.1' &&
      typeof PublicKeyCredential!=='undefined' && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}
export async function createDeviceKey(optionsJSON: any) {
  const { startRegistration }=await import('@simplewebauthn/browser');
  return startRegistration({optionsJSON});
}
export async function authenticateDeviceKey(optionsJSON: any) {
  const { startAuthentication }=await import('@simplewebauthn/browser');
  return startAuthentication({optionsJSON});
}
