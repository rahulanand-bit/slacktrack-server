import crypto from 'node:crypto';

export type SlackInteractivePayload = {
  team?: { id?: string };
  user?: { id?: string };
  actions?: Array<{ action_id?: string }>;
  action_ts?: string;
  channel?: { id?: string };
  response_url?: string;
};

export function parseSlackInteractivePayload(rawBody: string): SlackInteractivePayload | null {
  const match = rawBody.match(/(?:^|&)payload=([^&]+)/);
  if (!match || !match[1]) return null;
  const decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
  return JSON.parse(decoded) as SlackInteractivePayload;
}

export function verifySlackSignature(params: {
  signingSecret?: string;
  rawBody: string;
  timestamp?: string;
  signature?: string;
}): boolean {
  const { signingSecret, rawBody, timestamp, signature } = params;
  if (!signingSecret) return true;
  if (!timestamp || !signature) return false;

  const fiveMinutes = 60 * 5;
  const reqTs = Number(timestamp);
  if (!Number.isFinite(reqTs)) return false;
  if (Math.abs(Date.now() / 1000 - reqTs) > fiveMinutes) return false;

  const sigBase = `v0:${timestamp}:${rawBody}`;
  const expected =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBase, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
