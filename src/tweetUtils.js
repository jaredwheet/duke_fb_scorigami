// Helper to trim text to a specified tweet length.
export function trimTweet(text, maxLength = 280) {
    if (text.length <= maxLength) return text;
    // Try to trim at the last line break or space before the limit.
    let trimmed = text.slice(0, Math.max(0, maxLength - 1));
    const lastBreak = Math.max(trimmed.lastIndexOf('\n'), trimmed.lastIndexOf(' '));
    if (lastBreak > 0) {
        trimmed = trimmed.slice(0, lastBreak);
    }
    return trimmed + '…';
}
