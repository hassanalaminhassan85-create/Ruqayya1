export function log(level: 'info'|'warn'|'error', message: string, meta?: any) {
  const entry = { ts: new Date().toISOString(), level, message, meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));
}
