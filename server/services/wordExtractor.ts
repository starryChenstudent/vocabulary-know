import type { ParsedWord } from '../types.js';

const OCR_NOISE_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too',
  'use', 'ee', 'er', 're', 'te', 'st', 'ca', 'fe', 'cs', 'sa', 'cr', 'rr', 'gp', 'je',
  'ta', 'ber', 'es', 'en', 'ea', 'or', 'on', 'em', 'et', 'ad', 'od', 'ss', 'ok', 'na',
  'ls', 'ns', 'fr', 'yt', 'me', 'el', 'il', 'al', 'le', 'de', 'la', 'ne', 'se', 've',
  'he', 'be', 'we', 'do', 'go', 'no', 'so', 'to', 'up', 'if', 'of', 'at', 'by', 'as',
  'is', 'it', 'in', 'an', 'am', 'be', 'or', 'ex', 'ax', 'ox', 'xi', 'yi', 'zi',
]);

export function parseWordsAggressive(text: string): ParsedWord[] {
  const englishMatches = [...text.matchAll(/\b([a-zA-Z]{2,24})\b/g)]
    .map((m) => m[1].toLowerCase())
    .filter((w) => !OCR_NOISE_WORDS.has(w));

  const chineseMatches = [...text.matchAll(/([\u4e00-\u9fff]{1,10})/g)].map((m) => m[1]);

  const results: ParsedWord[] = [];
  const seen = new Set<string>();
  const count = Math.min(englishMatches.length, chineseMatches.length);

  for (let i = 0; i < count; i++) {
    const english = englishMatches[i];
    if (seen.has(english)) continue;
    seen.add(english);
    results.push({ english, chinese: chineseMatches[i] });
  }

  return results;
}

export function mergeParsedWords(...lists: ParsedWord[][]): ParsedWord[] {
  const merged: ParsedWord[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const word of list) {
      const key = word.english.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(word);
    }
  }

  return merged;
}

export function scoreParsedWords(words: ParsedWord[]): number {
  if (words.length === 0) return 0;
  let score = words.length * 100;
  for (const w of words) {
    if (w.english.length >= 3) score += 10;
    if (w.chinese.length >= 2) score += 10;
    if (/^[a-z]+$/.test(w.english)) score += 5;
  }
  return score;
}
