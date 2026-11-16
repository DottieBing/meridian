export type Logger = {
  info(message: string): void
  warn(message: string): void
  error(message: string, err?: unknown): void
}

export function createLogger(name: string): Logger {
  const stamp = () => new Date().toISOString().slice(11, 19)
  return {
    info: (m) => console.log(`${stamp()} INFO  [${name}] ${m}`),
    warn: (m) => console.warn(`${stamp()} WARN  [${name}] ${m}`),
    error: (m, err) => console.error(`${stamp()} ERROR [${name}] ${m}`, err ?? ''),
  }
}