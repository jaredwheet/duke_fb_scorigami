import { jest } from '@jest/globals';

const editWallaceWadeScreen = jest.fn();
const fetch = jest.fn();
jest.unstable_mockModule('./openaiImageEditor.js', () => ({ editWallaceWadeScreen }));
jest.unstable_mockModule('node-fetch', () => ({ default: fetch }));

const { createWallaceWadeCard } = await import('./wallaceWadeCard.js');

beforeEach(() => {
  editWallaceWadeScreen.mockReset();
  fetch.mockReset();
  fetch.mockResolvedValue({ ok: false });
  editWallaceWadeScreen.mockRejectedValue(new Error('malformed OpenAI image'));
});

test('preferred media keeps the reference photo when OpenAI returns malformed output', async () => {
  const card = await createWallaceWadeCard({
    dukeScore: 24,
    oppScore: 10,
    opponent: 'Virginia',
    startDate: '2026-09-05T19:30:00Z',
  });

  expect(card.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(editWallaceWadeScreen).toHaveBeenCalledTimes(1);
});
