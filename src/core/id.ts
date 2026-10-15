let customGenerator: ((prefix: string) => string) | null = null;
let idCounter = 1;

export function newId(prefix: string): string {
  if (customGenerator) {
    return customGenerator(prefix);
  }
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}_${idCounter++}`;
}

export function setIdGenerator(gen: ((prefix: string) => string) | null): void {
  customGenerator = gen;
}

export function resetIdCounter(nextValue = 1): void {
  idCounter = nextValue;
}
