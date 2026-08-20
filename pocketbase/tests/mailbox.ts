import { createServer, type Server, type Socket } from 'node:net';

/**
 * A throwaway SMTP server that accepts a message and keeps it.
 *
 * PocketBase mints the password-reset and verification tokens itself and only
 * ever puts them in an email, so a test that wants to prove what those links do
 * has to read one. Nothing here delivers anything: it speaks just enough SMTP
 * for Go's mail client to hand a message over, and the message is kept in
 * memory for the test to pick apart.
 *
 * Deliberately not a dependency. The alternative is a mail-catcher container in
 * CI, and the whole point of `instance.ts` is that this suite needs nothing but
 * the pinned binary and a free port.
 */
export interface Mailbox {
  readonly port: number;
  /** Every message received, raw, headers and all. */
  readonly messages: readonly string[];
  /** Resolve with the first message matching `predicate`, or throw on timeout. */
  waitFor(predicate: (message: string) => boolean, timeoutMs?: number): Promise<string>;
  stop(): Promise<void>;
}

const CRLF = '\r\n';

/** One connection's worth of state. SMTP is a line protocol until `DATA`. */
function serve(socket: Socket, messages: string[]): void {
  let buffer = '';
  let inData = false;
  /** Set while an `AUTH LOGIN` exchange is mid-flight; those lines are not commands. */
  let awaitingCredential = 0;

  const say = (line: string) => socket.write(`${line}${CRLF}`);

  say('220 127.0.0.1 ESMTP landit-test-mailbox');

  socket.on('error', () => socket.destroy());
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    for (;;) {
      if (inData) {
        const end = buffer.indexOf(`${CRLF}.${CRLF}`);
        if (end === -1) break;
        messages.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 5);
        inData = false;
        say('250 2.0.0 Ok: queued');
        continue;
      }

      const newline = buffer.indexOf(CRLF);
      if (newline === -1) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 2);

      if (awaitingCredential > 0) {
        awaitingCredential -= 1;
        say(awaitingCredential > 0 ? '334 UGFzc3dvcmQ6' : '235 2.7.0 Authentication successful');
        continue;
      }

      const verb = line.split(/\s+/, 1)[0]?.toUpperCase() ?? '';
      switch (verb) {
        case 'EHLO':
          // AUTH is advertised so a client configured with credentials has a
          // method to pick; one configured without them simply skips it.
          socket.write(
            `250-127.0.0.1${CRLF}250-AUTH PLAIN LOGIN${CRLF}250-8BITMIME${CRLF}250 OK${CRLF}`,
          );
          break;
        case 'HELO':
          say('250 127.0.0.1');
          break;
        case 'AUTH':
          if (/^AUTH\s+LOGIN\s*$/i.test(line)) {
            awaitingCredential = 2;
            say('334 VXNlcm5hbWU6');
          } else {
            say('235 2.7.0 Authentication successful');
          }
          break;
        case 'DATA':
          inData = true;
          say('354 End data with <CR><LF>.<CR><LF>');
          break;
        case 'QUIT':
          say('221 2.0.0 Bye');
          socket.end();
          return;
        case 'STARTTLS':
          // Nothing here can do TLS; the settings this is used with say so.
          say('454 4.7.0 TLS not available');
          break;
        default:
          // MAIL FROM, RCPT TO, RSET, NOOP and anything else this does not need
          // to understand.
          say('250 2.0.0 Ok');
      }
    }
  });
}

export async function startMailbox(): Promise<Mailbox> {
  const messages: string[] = [];
  const server: Server = createServer((socket) => serve(socket, messages));

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || address === null) {
        reject(new Error('could not pick a port for the mailbox'));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    port,
    messages,
    async waitFor(predicate, timeoutMs = 10_000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = messages.find(predicate);
        if (found) return found;
        if (Date.now() > deadline) {
          throw new Error(
            `no matching message within ${timeoutMs}ms (${messages.length} received)`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    stop() {
      return new Promise<void>((resolve) => {
        server.close(() => resolve());
        // A held-open client connection would otherwise keep the process alive.
        server.unref();
        setTimeout(resolve, 1_000);
      });
    },
  };
}

/**
 * Undo quoted-printable so a token that got soft-wrapped mid-JWT is one string
 * again. This is exactly the failure the naive version of this test hits: the
 * link is long, the encoder breaks it at 76 characters with a trailing `=`, and
 * a regex over the raw body pulls out half a token that PocketBase then
 * rejects — which reads like a bug in the reset rather than in the test.
 */
export function decodeBody(raw: string): string {
  const withoutSoftBreaks = raw.replace(/=\r?\n/g, '');
  return withoutSoftBreaks.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

/** The JWT out of a PocketBase action email, whatever URL the template wraps it in. */
export function tokenFrom(raw: string): string {
  const body = decodeBody(raw);
  const match = body.match(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/);
  if (!match) throw new Error(`no token in message:\n${body.slice(0, 2000)}`);
  return match[0];
}
