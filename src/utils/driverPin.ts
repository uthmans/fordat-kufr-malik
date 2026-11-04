// Local profile gate only. Server authentication is needed for shared accounts.
export function isValidDriverPin(pin: unknown): pin is string {
  return typeof pin === 'string' && pin.length >= 4 && pin.length <= 6 && !/[^0-9]/.test(pin);
}

export function matchesDriverPin(driver: { pinCode: string } | undefined, entered: string): boolean {
  return !!driver && isValidDriverPin(driver.pinCode) && entered === driver.pinCode;
}
