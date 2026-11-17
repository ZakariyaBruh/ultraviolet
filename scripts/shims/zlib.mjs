// node:zlib for the in-browser bash (just-bash): only gzip and gunzip are used, by its gzip, gunzip and zcat commands
import { gzipSync as gz, gunzipSync as gunz } from 'fflate'
export const constants = { Z_BEST_COMPRESSION: 9, Z_BEST_SPEED: 1, Z_DEFAULT_COMPRESSION: -1 }
export const gzipSync = (data, o = {}) => gz(data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)), { level: o.level === -1 || o.level === undefined ? 6 : o.level })
export const gunzipSync = (data) => gunz(data instanceof Uint8Array ? data : new Uint8Array(data))
export default { constants, gzipSync, gunzipSync }
