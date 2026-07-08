const TMIN = 1;
const TMAX = 26;
const BASE = 36;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';

function decodeDigit(cp: number): number {
  if (cp - 48 < 10) return cp - 48 + 26;
  if (cp - 97 < 26) return cp - 97;
  return 0;
}

function adapt(delta: number, numpoints: number, firsttime: boolean): number {
  delta = firsttime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  delta += Math.floor(delta / numpoints);
  let k = 0;
  while (delta > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    delta = Math.floor(delta / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

export function punycodeDecode(input: string): string {
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  const output: number[] = [];

  const delimiterIndex = input.lastIndexOf(DELIMITER);
  if (delimiterIndex >= 0) {
    for (let j = 0; j < delimiterIndex; j++) {
      output.push(input.charCodeAt(j));
    }
    input = input.slice(delimiterIndex + 1);
  }

  while (input.length > 0) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (input.length === 0) return ""; 
      const digit = decodeDigit(input.charCodeAt(0));
      input = input.slice(1);
      i = i + digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w = w * (BASE - t);
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n = n + Math.floor(i / len);
    i = i % len;
    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

export function decodeEmail(email: string | undefined | null): string {
  if (!email) return "";
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [localPart, domain] = parts;
  const domainParts = domain.split('.');
  const decodedDomainParts = domainParts.map(part => {
    const lowerPart = part.toLowerCase();
    if (lowerPart.startsWith('xn--')) {
      try {
        return punycodeDecode(lowerPart.slice(4));
      } catch {
        return part;
      }
    }
    return part;
  });
  return `${localPart}@${decodedDomainParts.join('.')}`;
}
