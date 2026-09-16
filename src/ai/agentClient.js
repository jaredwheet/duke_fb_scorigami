import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4o-mini';

export async function runStructuredAgent({
  name,
  instructions,
  packet,
  schema,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_EDITORIAL_MODEL || DEFAULT_MODEL,
  client = null,
}) {
  if (!apiKey && !client) return { status: 'fallback', output: null, warning: 'OPENAI_API_KEY is not configured' };

  try {
    const openai = client || new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
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
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${name} returned no content`);
    return { status: 'ok', output: JSON.parse(content) };
  } catch (error) {
    return { status: 'fallback', output: null, warning: `${name}: ${error.message}` };
  }
}
