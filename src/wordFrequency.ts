/** Common English stop words to exclude from frequency analysis */
const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'is','it','its','be','as','by','was','are','has','had','have','not',
    'this','that','from','into','up','about','than','so','if','do','we',
    'i','my','you','your','he','his','she','her','they','their','our',
    'can','will','would','could','should','may','might','been','also',
]);

/** Returns the top N most frequent non-stop words from a list of content strings */
export function topWords(contents: string[], topN = 20): Array<{ word: string; count: number }> {
    const freq = new Map<string, number>();
    for (const content of contents) {
        const words = content
            .toLowerCase()
            .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));
        for (const word of words) {
            freq.set(word, (freq.get(word) ?? 0) + 1);
        }
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([word, count]) => ({ word, count }));
}
