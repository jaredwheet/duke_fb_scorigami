import OpenAI, { toFile } from 'openai';

const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';

export async function editWallaceWadeScreen(imageBuffer, maskBuffer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const image = await toFile(imageBuffer, 'wallace-wade.webp', { type: 'image/webp' });
  const mask = await toFile(maskBuffer, 'wallace-wade-mask.png', { type: 'image/png' });
  const response = await client.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    image,
    mask,
    prompt: [
      'Edit only the transparent masked center video screen in this Wallace Wade Stadium photo.',
      'Preserve every unmasked pixel exactly: the stadium structure, Duke signs, logos, scoreboard frame, field, sky, people, and sponsor boards.',
      'Create a realistic dark-blue stadium LED display background with subtle pixel scanlines, blue illumination, and a professional football broadcast feel.',
      'Do not render readable words, numbers, team names, or logos; the application will add exact scoreboard data afterward.',
    ].join(' '),
    size: '1536x1024',
    quality: 'medium',
    output_format: 'png',
  });

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) throw new Error('OpenAI returned no edited image');
  return Buffer.from(imageBase64, 'base64');
}
