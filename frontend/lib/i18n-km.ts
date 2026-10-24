import { COMMON } from './km/common';
import { GUEST } from './km/guest';
import { SERVER } from './km/server';
import { STAFF } from './km/staff';

/** Khmer translations keyed by the English source text. Anything missing falls back to English. */
export const KM:Record<string,string>={...SERVER,...COMMON,...GUEST,...STAFF};
