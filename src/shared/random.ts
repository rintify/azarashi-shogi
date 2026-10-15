/** Entropy is created per match; a stored seed makes a particular match reproducible. */
export function randomSeed(): number {
  return typeof globalThis.crypto !== 'undefined'
    ? crypto.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0x100000000);
}
export function seededValue(key: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x100000000;
}
