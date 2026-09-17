import { buildBulletinContext } from './bulletinData.js';

test('builds season-long matchup strengths and market view', () => {
  const context = buildBulletinContext({
    opponentName: 'Stanford',
    dukeSeasonStats: [
      { statName: 'rushingYards', statValue: 340 },
      { statName: 'passingYards', statValue: 520 },
    ],
    opponentSeasonStats: [{ statName: 'rushingYards', statValue: 280 }],
    dukeGameStats: [
      { teams: [
        { school: 'Duke', points: 31, stats: [{ category: 'rushingYards', stat: '170' }, { category: 'totalYards', stat: '376' }] },
        { school: 'Tulane', points: 17, stats: [{ category: 'totalYards', stat: '320' }] },
      ] },
      { teams: [
        { school: 'Duke', points: 27, stats: [{ category: 'rushingYards', stat: '170' }, { category: 'totalYards', stat: '380' }] },
        { school: 'Illinois', points: 24, stats: [{ category: 'totalYards', stat: '410' }] },
      ] },
    ],
    opponentGameStats: [
      { teams: [{ school: 'Stanford', points: 27, stats: [] }, { school: 'San Jose State', points: 20, stats: [] }] },
      { teams: [{ school: 'Stanford', points: 17, stats: [] }, { school: 'USC', points: 30, stats: [] }] },
    ],
    lines: [{ homeTeam: 'Duke', awayTeam: 'Stanford', lines: [{ provider: 'Consensus', formattedSpread: 'Duke -3.5', homeMoneyline: -155, awayMoneyline: 130, overUnder: 51.5 }] }],
    pregameProbabilities: [{ homeTeam: 'Duke', awayTeam: 'Stanford', homeWinProb: 0.68 }],
  });

  expect(context.seasonSummary).toContain('Duke');
  expect(context.strengths).toContain('Duke is averaging');
  expect(context.winProbability).toContain('68%');
  expect(context.opponent.record).toBe('1-1');
});
