// The file as stored: ciphertext plus what is needed to decrypt it
// (docs/sync.md#the-envelope). No cryptography and no base64 coding here; an
// app fills the `Cipher` port with its platform's functions.

export const ENVELOPE_FORMAT = 'materia-sync';
export const ENVELOPE_VERSION = 1;

export interface Envelope {
  format: 'materia-sync';
  version: 1;
  kdf: { name: string; hash: string; iterations: number; salt: string };
  cipher: { name: string; nonce: string };
  data: string;
}

export type EnvelopeError = 'not-json' | 'not-an-envelope' | 'newer-version' | 'invalid';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x !== '';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const b64 = (x: unknown): x is string => typeof x === 'string' && BASE64.test(x);

/** Parses and validates the stored text; unknown fields are ignored. */
export function parseEnvelope(
  json: string,
): { ok: true; envelope: Envelope } | { ok: false; error: EnvelopeError } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isObj(raw) || raw.format !== ENVELOPE_FORMAT) return { ok: false, error: 'not-an-envelope' };
  if (typeof raw.version === 'number' && raw.version > ENVELOPE_VERSION) {
    return { ok: false, error: 'newer-version' };
  }
  const { kdf, cipher } = raw;
  if (
    raw.version !== ENVELOPE_VERSION ||
    !isObj(kdf) ||
    !text(kdf.name) ||
    !text(kdf.hash) ||
    typeof kdf.iterations !== 'number' ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations <= 0 ||
    !b64(kdf.salt) ||
    !isObj(cipher) ||
    !text(cipher.name) ||
    !b64(cipher.nonce) ||
    !b64(raw.data)
  ) {
    return { ok: false, error: 'invalid' };
  }
  return {
    ok: true,
    envelope: {
      format: ENVELOPE_FORMAT,
      version: ENVELOPE_VERSION,
      kdf: { name: kdf.name, hash: kdf.hash, iterations: kdf.iterations, salt: kdf.salt },
      cipher: { name: cipher.name, nonce: cipher.nonce },
      data: raw.data,
    },
  };
}

/** The stable text, fields in a fixed order. */
export function buildEnvelope(envelope: Envelope): string {
  const { kdf, cipher } = envelope;
  return JSON.stringify({
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: { name: kdf.name, hash: kdf.hash, iterations: kdf.iterations, salt: kdf.salt },
    cipher: { name: cipher.name, nonce: cipher.nonce },
    data: envelope.data,
  });
}

/** The additional data the cipher binds to the ciphertext: `materia-sync/1`. */
export function envelopeAad(envelope: Pick<Envelope, 'format' | 'version'>): string {
  return `${envelope.format}/${envelope.version}`;
}

/** The port an app fills with its platform's cryptography. */
export interface Cipher {
  seal(plaintext: string, passphrase: string, previous?: Envelope): Promise<Envelope>;
  /** Throws when the passphrase is wrong or the data was changed; what is thrown is up to the app. */
  open(envelope: Envelope, passphrase: string): Promise<string>;
}
