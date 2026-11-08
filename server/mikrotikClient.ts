import net from 'net';
import tls from 'tls';
import crypto from 'crypto';

export interface MikroTikEndpointConfig {
  routerDisplayName: string;
  host: string;
  port: number;
  username: string;
  password: string;
  tlsEnabled: boolean;
  validateCertificate: boolean;
  timeoutMs: number;
}

export interface RouterOsSentence {
  tag: string; // '!re' | '!done' | '!trap' | '!fatal'
  attributes: Record<string, string>;
}

/**
 * Strict whitelist of allowed RouterOS API command prefixes.
 * Prevents arbitrary command execution on the MikroTik router.
 */
const ALLOWED_COMMANDS = new Set<string>([
  '/login',
  '/system/identity/print',
  '/system/resource/print',
  '/ppp/secret/print',
  '/ppp/secret/add',
  '/ppp/secret/set',
  '/ppp/secret/remove',
  '/ppp/secret/enable',
  '/ppp/secret/disable',
  '/ppp/profile/print',
  '/ppp/profile/add',
  '/ppp/profile/set',
  '/ppp/profile/remove',
  '/ppp/active/print',
  '/ppp/active/remove',
]);

/**
 * Encodes a single RouterOS API word with its binary variable-length prefix.
 */
function encodeWord(word: string): Buffer {
  const wordBuf = Buffer.from(word, 'utf8');
  const len = wordBuf.length;
  let prefix: Buffer;

  if (len < 0x80) {
    prefix = Buffer.from([len]);
  } else if (len < 0x4000) {
    const val = len | 0x8000;
    prefix = Buffer.from([(val >> 8) & 0xff, val & 0xff]);
  } else if (len < 0x200000) {
    const val = len | 0xc00000;
    prefix = Buffer.from([(val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]);
  } else if (len < 0x10000000) {
    const val = len | 0xe0000000;
    prefix = Buffer.from([
      (val >> 24) & 0xff,
      (val >> 16) & 0xff,
      (val >> 8) & 0xff,
      val & 0xff,
    ]);
  } else {
    prefix = Buffer.alloc(5);
    prefix[0] = 0xf0;
    prefix.writeUInt32BE(len, 1);
  }

  return Buffer.concat([prefix, wordBuf]);
}

function encodeSentence(words: string[]): Buffer {
  const encodedWords = words.map(encodeWord);
  // Terminate sentence with a zero-length byte (0x00)
  encodedWords.push(Buffer.from([0x00]));
  return Buffer.concat(encodedWords);
}

/**
 * Attempts to read one word from buffer at offset.
 * Returns null if buffer does not yet have enough bytes.
 */
function tryDecodeWord(
  buf: Buffer,
  offset: number
): { word: string; nextOffset: number } | null {
  if (offset >= buf.length) return null;
  const b0 = buf[offset];
  let len = 0;
  let headerBytes = 1;

  if ((b0 & 0x80) === 0x00) {
    len = b0;
    headerBytes = 1;
  } else if ((b0 & 0xc0) === 0x80) {
    if (offset + 2 > buf.length) return null;
    len = ((b0 & 0x3f) << 8) | buf[offset + 1];
    headerBytes = 2;
  } else if ((b0 & 0xe0) === 0xc0) {
    if (offset + 3 > buf.length) return null;
    len = ((b0 & 0x1f) << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
    headerBytes = 3;
  } else if ((b0 & 0xf0) === 0xe0) {
    if (offset + 4 > buf.length) return null;
    len =
      ((b0 & 0x0f) << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3];
    headerBytes = 4;
  } else if (b0 === 0xf0) {
    if (offset + 5 > buf.length) return null;
    len = buf.readUInt32BE(offset + 1);
    headerBytes = 5;
  } else {
    throw new Error('Malformed RouterOS API word length prefix');
  }

  const wordStart = offset + headerBytes;
  const wordEnd = wordStart + len;
  if (wordEnd > buf.length) return null;

  const word = buf.subarray(wordStart, wordEnd).toString('utf8');
  return { word, nextOffset: wordEnd };
}

function parseSentenceWords(words: string[]): RouterOsSentence {
  const tag = words[0] || '!done';
  const attributes: Record<string, string> = {};
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w.startsWith('=')) {
      const secondEq = w.indexOf('=', 1);
      if (secondEq !== -1) {
        const key = w.slice(1, secondEq);
        const val = w.slice(secondEq + 1);
        attributes[key] = val;
      }
    }
  }
  return { tag, attributes };
}

/**
 * Production MikroTik RouterOS Binary API Client over TCP / TLS (Port 8728 / 8729).
 * Supports RouterOS v6.43+ post-login and v6 legacy MD5 challenge-response.
 */
export class MikroTikApiClient {
  private readonly config: MikroTikEndpointConfig;

  constructor(config: MikroTikEndpointConfig) {
    this.config = config;
  }

  public async executeCommand(
    command: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<Record<string, string>[]> {
    if (!ALLOWED_COMMANDS.has(command)) {
      throw new Error(`Security policy violation: Command '${command}' is not permitted.`);
    }

    const socket = await this.connectAndAuthenticate();
    try {
      const words: string[] = [command];
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          words.push(`=${k}=${String(v)}`);
        }
      }
      const sentences = await this.sendSentenceAndReadReply(socket, words);
      const trap = sentences.find((s) => s.tag === '!trap' || s.tag === '!fatal');
      if (trap) {
        const msg = trap.attributes['message'] || 'RouterOS command execution failed';
        throw new Error(`RouterOS API error: ${msg}`);
      }

      const results: Record<string, string>[] = [];
      for (const s of sentences) {
        if (s.tag === '!re') {
          results.push(s.attributes);
        } else if (s.tag === '!done' && s.attributes['ret']) {
          results.push({ '.id': s.attributes['ret'] });
        }
      }
      return results;
    } finally {
      socket.destroy();
    }
  }

  private connectAndAuthenticate(): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const { host, port, tlsEnabled, validateCertificate, timeoutMs } = this.config;
      if (!host || !host.trim()) {
        return reject(new Error('RouterOS hostname or IP address is not configured.'));
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error(`Connection to ${host}:${port} timed out after ${timeoutMs}ms.`));
        }
      }, timeoutMs || 8000);

      const onError = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            new Error(
              `Unable to establish ${tlsEnabled ? 'TLS (API-SSL)' : 'TCP'} connection to ${host}:${port} — ${err.message}`
            )
          );
        }
      };

      const onConnected = async () => {
        try {
          // RouterOS v6.43+ post-style login
          const loginSentences = await this.sendSentenceAndReadReply(socket, [
            '/login',
            `=name=${this.config.username}`,
            `=password=${this.config.password}`,
          ]);

          const trap = loginSentences.find((s) => s.tag === '!trap' || s.tag === '!fatal');
          if (trap) {
            throw new Error(
              trap.attributes['message'] || 'Authentication rejected by RouterOS.'
            );
          }

          const done = loginSentences.find((s) => s.tag === '!done');
          // Legacy RouterOS (<6.43) challenge-response fallback if `ret` hex challenge is returned
          if (done && done.attributes['ret']) {
            const challenge = Buffer.from(done.attributes['ret'], 'hex');
            const md5 = crypto.createHash('md5');
            md5.update(Buffer.from([0x00]));
            md5.update(Buffer.from(this.config.password, 'utf8'));
            md5.update(challenge);
            const responseHex = '00' + md5.digest('hex');

            const chapSentences = await this.sendSentenceAndReadReply(socket, [
              '/login',
              `=name=${this.config.username}`,
              `=response=${responseHex}`,
            ]);
            const chapTrap = chapSentences.find(
              (s) => s.tag === '!trap' || s.tag === '!fatal'
            );
            if (chapTrap) {
              throw new Error(
                chapTrap.attributes['message'] ||
                  'Legacy CHAP authentication rejected by RouterOS.'
              );
            }
          }

          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(socket);
          }
        } catch (authErr) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            reject(authErr instanceof Error ? authErr : new Error(String(authErr)));
          }
        }
      };

      const socket: net.Socket | tls.TLSSocket = tlsEnabled
        ? tls.connect(
            {
              host,
              port,
              rejectUnauthorized: validateCertificate,
              servername: net.isIP(host) ? undefined : host,
            },
            onConnected
          )
        : net.connect({ host, port }, onConnected);

      socket.once('error', onError);
    });
  }

  private sendSentenceAndReadReply(
    socket: net.Socket | tls.TLSSocket,
    words: string[]
  ): Promise<RouterOsSentence[]> {
    return new Promise((resolve, reject) => {
      let rxBuffer = Buffer.alloc(0);
      let currentWords: string[] = [];
      const sentences: RouterOsSentence[] = [];

      const cleanup = () => {
        socket.removeListener('data', onData);
        socket.removeListener('error', onErr);
        socket.removeListener('close', onClose);
      };

      const onErr = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('RouterOS socket closed unexpectedly before !done reply.'));
      };

      const onData = (chunk: Buffer) => {
        rxBuffer = Buffer.concat([rxBuffer, chunk]);
        try {
          let offset = 0;
          while (true) {
            const decoded = tryDecodeWord(rxBuffer, offset);
            if (!decoded) break;
            offset = decoded.nextOffset;

            if (decoded.word === '') {
              // End of sentence
              if (currentWords.length > 0) {
                const parsed = parseSentenceWords(currentWords);
                sentences.push(parsed);
                currentWords = [];

                if (parsed.tag === '!done' || parsed.tag === '!fatal') {
                  rxBuffer = rxBuffer.subarray(offset);
                  cleanup();
                  return resolve(sentences);
                }
              }
            } else {
              currentWords.push(decoded.word);
            }
          }
          rxBuffer = rxBuffer.subarray(offset);
        } catch (decodeErr) {
          cleanup();
          reject(decodeErr);
        }
      };

      socket.on('data', onData);
      socket.once('error', onErr);
      socket.once('close', onClose);

      const payload = encodeSentence(words);
      socket.write(payload);
    });
  }
}
