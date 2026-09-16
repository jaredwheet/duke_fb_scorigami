import { runEditorialOrchestrator } from '../ai/orchestrator.js';
import { renderDevilInDetails } from './renderNewsletter.js';
import { renderWinExpectancyChart } from './winExpectancy.js';

export async function prepareNewsletter(issueData) {
  const editorialResult = issueData.current_score
    ? await runEditorialOrchestrator(issueData)
    : null;
  const finalIssueData = editorialResult?.issueData || issueData;
  const chartBuffer = finalIssueData.win_expectancy?.snapshots?.length > 1
    ? await renderWinExpectancyChart(finalIssueData.win_expectancy.snapshots)
    : null;
  const html = await renderDevilInDetails({
    ...finalIssueData,
    win_expectancy: chartBuffer
      ? { ...finalIssueData.win_expectancy, imageSource: 'cid:duke-win-expectancy' }
      : null,
  });

  return {
    issueData: finalIssueData,
    html,
    chartBuffer,
    editorialResult,
  };
}
