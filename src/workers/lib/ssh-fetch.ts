import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SSH_PROXY = process.env.SSH_PROXY_HOST || 'curl@192.168.5.249';

/** Hosts that are geo-blocked from this server and need to be fetched via SSH proxy. */
const PROXIED_HOSTS = new Set([
  'www.oref.org.il',
  'alerts-history.oref.org.il',
  'www.inss.org.il',
  'www.c14.co.il',
]);

/** Returns true if the URL must be routed through the SSH proxy. */
export function needsProxy(url: string): boolean {
  return PROXIED_HOSTS.has(new URL(url).hostname);
}

/** Shell-escape a string for the remote shell. */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Fetch a URL via SSH proxy. Returns the response body as text.
 * Throws on connection failure or HTTP error (4xx/5xx).
 */
export async function proxyFetch(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 15_000,
): Promise<string> {
  const curlTimeout = Math.ceil(timeoutMs / 1000);
  const parts = ['curl', '-s', '--fail', '--max-time', String(curlTimeout)];

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      parts.push('-H', `${k}: ${v}`);
    }
  }
  parts.push(url);

  const remoteCmd = parts.map(shellEscape).join(' ');

  const { stdout } = await execFileAsync('ssh', [
    '-o', 'ConnectTimeout=5',
    '-o', 'BatchMode=yes',
    SSH_PROXY,
    remoteCmd,
  ], { timeout: timeoutMs + 10_000, maxBuffer: 10 * 1024 * 1024 });

  return stdout;
}
