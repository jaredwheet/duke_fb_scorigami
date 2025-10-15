// Helper to trim a tweet to 280 characters
export function trimTweet(text) {
    if (text.length <= 280) return text;
    // Try to trim at the last line break or space before 280
    let trimmed = text.slice(0, 280);
    const lastBreak = Math.max(trimmed.lastIndexOf('\n'), trimmed.lastIndexOf(' '));
    if (lastBreak > 0) {
        trimmed = trimmed.slice(0, lastBreak);
    }
    return trimmed + '…';
}
