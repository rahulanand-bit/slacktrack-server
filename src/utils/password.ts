import crypto from 'node:crypto';

const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [salt, hashHex] = encodedHash.split(':');
  if (!salt || !hashHex) return false;

  const calculated = await scryptAsync(password, salt);
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== calculated.length) return false;
  return crypto.timingSafeEqual(expected, calculated);
}
