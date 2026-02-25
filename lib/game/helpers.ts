const ROOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function secureRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomId(prefix = "id"): string {
  return `${prefix}_${secureRandomHex(8)}`;
}

export function randomSessionToken(): string {
  return secureRandomHex(32);
}

export function createRoomCode(existingCodes: Set<string>): string {
  for (let i = 0; i < 3000; i += 1) {
    let code = "";
    for (let j = 0; j < 4; j += 1) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!existingCodes.has(code)) {
      return code;
    }
  }

  throw new Error("Impossible de générer un code de salon unique.");
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
}

export function normalizePlayerName(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 32);
}

export function ensureUniquePlayerName(name: string, existingNames: string[]): string {
  const lowered = new Set(existingNames.map((item) => item.toLocaleLowerCase("fr-FR")));
  if (!lowered.has(name.toLocaleLowerCase("fr-FR"))) {
    return name;
  }

  let suffix = 2;
  while (suffix < 999) {
    const candidate = `${name}#${suffix}`;
    if (!lowered.has(candidate.toLocaleLowerCase("fr-FR"))) {
      return candidate;
    }
    suffix += 1;
  }

  return `${name}#${Date.now()}`;
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cleanTextBasic(input: string): string {
  const compact = input.trim().replace(/\s+/g, " ");
  if (!compact) {
    return "";
  }

  return compact.charAt(0).toLocaleUpperCase("fr-FR") + compact.slice(1);
}

export function tokenizeAlphaNumeric(input: string): string[] {
  return (
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR")
      .match(/[a-z0-9]+/g) ?? []
  );
}

export function ratioOfChangedTokens(originalTokens: string[], correctedTokens: string[]): number {
  if (originalTokens.length === 0 && correctedTokens.length === 0) {
    return 0;
  }

  if (originalTokens.length === 0 || correctedTokens.length === 0) {
    return 1;
  }

  const maxLength = Math.max(originalTokens.length, correctedTokens.length);
  let changed = 0;

  for (let i = 0; i < maxLength; i += 1) {
    if (originalTokens[i] !== correctedTokens[i]) {
      changed += 1;
    }
  }

  return changed / maxLength;
}
