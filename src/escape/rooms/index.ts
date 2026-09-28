import { ATTIC } from './attic';
import { CELLAR } from './cellar';
import { OFFICE } from './office';
import { LIBRARY } from './library';
import type { RoomDef, RoomId } from '../types';

export const ROOMS: RoomDef[] = [ATTIC, CELLAR, OFFICE, LIBRARY];
export const roomById = (id: RoomId) => ROOMS.find((r) => r.id === id)!;
