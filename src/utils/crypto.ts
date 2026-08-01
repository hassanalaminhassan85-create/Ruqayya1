// Async WebCrypto wrapper for pbkdf2 and uuid helpers
export async function pbkdf2Async(password: string, salt: string, iterations = 1000, keyLen = 64, hash = 'SHA-512'): Promise<string> {
  if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
    const enc = new TextEncoder();
    const passwordKey = enc.encode(password);
    const saltKey = enc.encode(salt);
    const baseKey = await (crypto as any).subtle.importKey('raw', passwordKey, { name: 'PBKDF2' }, false, ['deriveBits']);
    const derived = await (crypto as any).subtle.deriveBits(
      { name: 'PBKDF2', salt: saltKey, iterations, hash },
      baseKey,
      keyLen * 8
    );
    return Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback to Node sync crypto (if available)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.pbkdf2Sync(password, salt, iterations, keyLen, 'sha512').toString('hex');
  } catch (e) {
    throw new Error('No suitable crypto backend available for pbkdf2Async');
  }
}

export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
