// the two node built-ins JSCPP's printf dependency reaches for, as much as it uses of them
export const inspect = (v) => { try { return typeof v === 'string' ? v : JSON.stringify(v) } catch { return String(v) } }
export default { inspect }
