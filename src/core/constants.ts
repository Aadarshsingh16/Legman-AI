import { PortType } from './types';

export const NODE_W = 200;
export const HEADER_H = 36;
export const ROW_H = 28;
export const FOOTER_H = 12;
export const GRID_SIZE = 20;

export const COMPATIBLE: Record<PortType, PortType[]> = {
  trigger: ['action'], // trigger node output feeds an action input
  action: ['action'],
  data: ['data'],
};
