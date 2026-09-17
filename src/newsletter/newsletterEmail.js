import { runEditorialOrchestrator } from '../ai/orchestrator.js';
import { renderDevilInDetails } from './renderNewsletter.js';
import { renderBriefNewsletter } from './renderBriefNewsletter.js';
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
  const html = isSundayEdition
    ? await renderDevilInDetails({
      ...finalIssueData,
      win_expectancy: chartBuffer
        ? { ...finalIssueData.win_expectancy, imageSource: 'cid:duke-win-expectancy' }
        : null,
    })
    : await renderBriefNewsletter({
      ...finalIssueData,
    });

  return {
    issueData: finalIssueData,
    html,
    chartBuffer,
    editorialResult,
  };
}
