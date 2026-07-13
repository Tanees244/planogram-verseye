/** PSA interchange uses centimeters; the app model uses meters. */

export function metersToCm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 10;
}

export function cmToMeters(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

export function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
