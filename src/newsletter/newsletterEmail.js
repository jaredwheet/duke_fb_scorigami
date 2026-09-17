import { runEditorialOrchestrator } from '../ai/orchestrator.js';
import { renderDevilInDetails } from './renderNewsletter.js';
import { renderBriefNewsletter } from './renderBriefNewsletter.js';
import { renderBulletinMatchupChart } from './renderBulletinMatchupChart.js';
import { renderWinExpectancyChart } from './winExpectancy.js';

export async function prepareNewsletter(issueData) {
  const isSundayEdition = !issueData.edition || issueData.edition === 'sunday';
  const editorialResult = isSundayEdition && issueData.current_score
    ? await runEditorialOrchestrator(issueData)
    : null;
  const finalIssueData = editorialResult?.issueData || issueData;
  const chartBuffer = isSundayEdition && finalIssueData.win_expectancy?.snapshots?.length > 1
    ? await renderWinExpectancyChart(finalIssueData.win_expectancy.snapshots)
    : null;
  const matchupBuffer = !isSundayEdition && finalIssueData.matchup_graphic?.rows?.length > 0
    ? await renderBulletinMatchupChart(finalIssueData.matchup_graphic)
    : null;
  const html = isSundayEdition
    ? await renderDevilInDetails({
      ...finalIssueData,
      win_expectancy: chartBuffer
        ? { ...finalIssueData.win_expectancy, imageSource: 'cid:duke-win-expectancy' }
        : null,
    })
    : await renderBriefNewsletter({
      ...finalIssueData,
      matchupImageSource: matchupBuffer ? 'cid:duke-matchup' : null,
    });

  return {
    issueData: finalIssueData,
    html,
    chartBuffer,
    matchupBuffer,
    editorialResult,
  };
}
