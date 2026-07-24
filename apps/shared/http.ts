// Helpers shared by the guide and dashboard servers — closed course
// machinery, plain node:http on purpose: no framework, no dependencies.
// (The bank API is different: students extend it, so it uses tRPC — see
// apps/bank/router.ts and DESIGN.md.)

import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

export type Handler = (
  request: IncomingMessage,
  response: ServerResponse
) => void | Promise<void>;

/**
 * An http server whose handler may be async: a rejection is logged and
 * answered with a JSON 500 instead of crashing the server.
 */
export function createJsonServer(handler: Handler): Server {
  return createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error: unknown) => {
      console.error(error);
      sendJson(response, 500, { error: String(error) });
    });
  });
}

/** Read the full request body as a string. The size cap matters where a
 *  server is reachable beyond the classroom — an oversized body kills
 *  the request, not the process. */
export function readBody(
  request: IncomingMessage,
  maxBytes = 10 * 1024 * 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        request.destroy();
        reject(new Error(`Request body over ${maxBytes} bytes.`));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/** Send a JSON response. */
export function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}
