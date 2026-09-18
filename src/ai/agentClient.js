import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4o-mini';
export const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

export function withTimeout(promise, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS, reason = 'provider_timeout') {
  const duration = Number.isFinite(Number(timeoutMs)) ? Math.max(1, Number(timeoutMs)) : DEFAULT_PROVIDER_TIMEOUT_MS;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(reason);
      error.code = 'PROVIDER_TIMEOUT';
      reject(error);
    }, duration);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function finish(onAgentResult, result) {
  onAgentResult?.(result);
  return result;
}

function classifyProviderError(error) {
  if (error?.code === 'PROVIDER_TIMEOUT') return 'provider_timeout';
  return 'provider_error';
}

export async function runStructuredAgent({
  name,
  instructions,
  packet,
  schema,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_EDITORIAL_MODEL || DEFAULT_MODEL,
  client = null,
  onPacket = null,
  onAgentResult = null,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
}) {
  if (!String(apiKey || '').trim()) return finish(onAgentResult, {
    status: 'fallback',
    output: null,
    fallbackReason: 'provider_not_configured',
    warning: 'provider_not_configured',
  });

  try {
    if (typeof onPacket === 'function') onPacket(packet);
    const openai = client || new OpenAI({ apiKey });
    const response = await withTimeout(openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: JSON.stringify(packet) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name, strict: true, schema },
      },
    }), timeoutMs);
    const content = response.choices?.[0]?.message?.content;
    if (!content) return finish(onAgentResult, {
      status: 'fallback', output: null, fallbackReason: 'malformed_response', warning: 'malformed_response',
    });
    try {
      return finish(onAgentResult, { status: 'ok', output: JSON.parse(content) });
    } catch {
      return finish(onAgentResult, {
        status: 'fallback', output: null, fallbackReason: 'malformed_response', warning: 'malformed_response',
      });
    }
  } catch (error) {
    const fallbackReason = classifyProviderError(error);
    return finish(onAgentResult, { status: 'fallback', output: null, fallbackReason, warning: fallbackReason });
  }
}
