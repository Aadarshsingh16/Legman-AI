import { Graph } from './types';

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

export function syncIdCounterWithGraph(graph: Graph): void {
  let highest = idCounter;
  const allIds = [
    ...Object.keys(graph.nodes),
    ...Object.values(graph.nodes).flatMap((n) => n.ports.map((p) => p.id)),
    ...Object.keys(graph.edges),
  ];

  for (const id of allIds) {
    const matches = id.match(/\d+/g);
    if (matches) {
      for (const m of matches) {
        const val = parseInt(m, 10);
        if (!isNaN(val) && val >= highest) {
          highest = val + 1;
        }
      }
    }
  }

  idCounter = highest;
}
