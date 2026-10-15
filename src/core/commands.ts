import { Graph } from './types';

export interface Command {
  readonly label: string;
  do(g: Graph): Graph;
  undo(g: Graph): Graph;
}
