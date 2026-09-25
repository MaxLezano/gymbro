/**
 * GymBro coach proxy.
 *
 * Keeps provider keys out of the APK and chains free tiers so one provider
 * changing its terms never takes the coach down:
 *   1. Gemini (Google AI Studio free tier, key without billing)
 *   2. Workers AI (Cloudflare free daily allowance)
 * When both fail the app falls back to its offline engine.
 *
 * Contract: POST /chat { messages: [{ role, content }] }
 *        -> 200 { content, provider } | 4xx/5xx { error }
 */

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const PROVIDER_TIMEOUT_MS = 20_000;
const MAX_MESSAGES = 10;
const MAX_TOTAL_CHARS = 24_000;
const ROLES = new Set(['system', 'user', 'assistant']);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Accepts only the shape the app sends; anything else is rejected before reaching a provider. */
function readMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  let total = 0;
  const clean = [];
  for (const message of messages) {
    if (!ROLES.has(message?.role) || typeof message?.content !== 'string') return null;
    total += message.content.length;
    clean.push({ role: message.role, content: message.content });
  }
  return total <= MAX_TOTAL_CHARS ? clean : null;
}

async function askGemini(env, messages) {
  if (!env.GEMINI_API_KEY) throw new Error('Gemini key not configured');
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GEMINI_API_KEY}` },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      model: env.GEMINI_MODEL,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Gemini empty reply');
  return content;
}

async function askWorkersAi(env, messages) {
  const result = await env.AI.run(env.WORKERS_AI_MODEL, { messages, max_tokens: 1536 });
  const content = typeof result?.response === 'string' ? result.response : JSON.stringify(result?.response ?? '');
  if (!content.trim() || content === '""') throw new Error('Workers AI empty reply');
  return content;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'Not found' }, 404);

    // Per-IP throttle so a leaked URL cannot drain the shared daily quotas.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return json({ error: 'Too many requests' }, 429);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const messages = readMessages(body);
    if (!messages) return json({ error: 'Invalid messages' }, 400);

    const providers = [
      ['gemini', askGemini],
      ['workers-ai', askWorkersAi],
    ];
    for (const [provider, ask] of providers) {
      try {
        return json({ content: await ask(env, messages), provider });
      } catch (error) {
        console.warn(`${provider} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return json({ error: 'All providers unavailable' }, 503);
  },
};
