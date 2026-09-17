import { chooseWatercoolerBackstory, describeWinnerFirstGame } from './watercoolerData.js';

test('writes historical scores with the winner first', () => {
  expect(describeWinnerFirstGame({
    startAt: '2016-09-17T00:00:00Z',
    season: 2016,
    opponent: 'Northwestern',
    dukeScore: 13,
    opponentScore: 24,
  })).toContain('Northwestern 24, Duke 13');
});

test('chooses a high-scoring archive backstory', () => {
  const backstory = chooseWatercoolerBackstory([{
    startAt: '2013-09-21T00:00:00Z',
    season: 2013,
    opponent: 'Pittsburgh',
    dukeScore: 55,
    opponentScore: 58,
  }]);
  expect(backstory).toContain('Pittsburgh 58, Duke 55');
  expect(backstory).toContain('113 combined points');
});
