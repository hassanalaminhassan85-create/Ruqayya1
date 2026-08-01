export async function hashPassword(password: string): Promise<string> {
  return await pbkdf2(password, 'ruqayya_erp_salt_2026', 1000, 64, 'SHA-512');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const h = await hashPassword(password);
  return h === hash;
}

async function pbkdf2(password: string, salt: string, iterations = 1000, keyLen = 64, digest: 'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512' = 'SHA-512') {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const saltBuffer = enc.encode(salt);
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer, iterations, hash: digest }, keyMaterial, keyLen * 8);
  const bytes = new Uint8Array(derivedBits);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
