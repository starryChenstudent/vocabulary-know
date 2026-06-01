import type { ParsedWord } from '../types.js';

const SEPARATORS = /[\t:：\-—–|｜/／,，;；]/;
const POS_PREFIX = /^(?:n|v|a|adj|adv|vt|vi|prep|conj|pron)\.\s*/i;
const POS_TOKEN = /^(?:n|v|a|adj|adv|vt|vi|prep|conj|pron)\.?$/i;
const FULL_LINE_PATTERN =
  /^(\d+[\.\)、]\s*)?([a-zA-Z][a-zA-Z\-']*)\s+(?:(?:n|v|a|adj|adv|vt|vi)\.\s*)?([\u4e00-\u9fff].+)$/;
const SIMPLE_LINE_PATTERN =
  /^(\d+[\.\)、]\s*)?([a-zA-Z][a-zA-Z\-']+)\s+([\u4e00-\u9fff].+)$/;
const POS_CHINESE_PATTERN = /^(?:(?:n|v|a|adj|adv|vt|vi)\.\s*)([\u4e00-\u9fff].+)$/i;

interface LineEntry {
  english?: string;
  chinese?: string;
  used?: boolean;
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function hasEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

function isValidEnglish(word: string): boolean {
  const normalized = word.toLowerCase();
  if (normalized.length < 2) return false;
  if (POS_TOKEN.test(normalized)) return false;
  return /^[a-z][a-z\-']*$/.test(normalized);
}

function cleanEnglish(text: string): string {
  return text.replace(/^\d+[\.\)、]\s*/, '').trim().toLowerCase();
}

function cleanChinese(text: string): string {
  return text
    .replace(/^\d+[\.\)、]\s*/, '')
    .replace(POS_PREFIX, '')
    .replace(/[.。,，;；!！?？]+$/g, '')
    .trim();
}

function extractEnglishTokens(text: string): string[] {
  return [...text.matchAll(/\b([a-zA-Z][a-zA-Z\-']{1,23})\b/g)]
    .map((match) => match[1].toLowerCase())
    .filter(isValidEnglish);
}

function splitParts(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const sepMatch = trimmed.match(SEPARATORS);
  if (sepMatch && sepMatch.index !== undefined) {
    const left = trimmed.slice(0, sepMatch.index).trim();
    const right = trimmed.slice(sepMatch.index + sepMatch[0].length).trim();
    if (left && right) return [left, right];
  }

  const spaceParts = trimmed.split(/\s{2,}|\s+/);
  if (spaceParts.length >= 2) {
    for (let i = 1; i < spaceParts.length; i++) {
      const left = spaceParts.slice(0, i).join(' ');
      const right = spaceParts.slice(i).join(' ');
      const leftHasEn = hasEnglish(left) && extractEnglishTokens(left).length > 0;
      const rightHasCn = hasChinese(right);
      const leftHasCn = hasChinese(left);
      const rightHasEn = hasEnglish(right) && extractEnglishTokens(right).length > 0;
      if ((leftHasEn && rightHasCn) || (leftHasCn && rightHasEn)) {
        return [left, right];
      }
    }
  }

  return null;
}

function parseLineEntry(line: string): LineEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return null;

  const simpleMatch = trimmed.match(SIMPLE_LINE_PATTERN);
  if (simpleMatch) {
    const english = cleanEnglish(simpleMatch[2]);
    const chinese = cleanChinese(simpleMatch[3]);
    if (isValidEnglish(english) && chinese) {
      return { english, chinese };
    }
  }

  const fullMatch = trimmed.match(FULL_LINE_PATTERN);
  if (fullMatch) {
    const english = cleanEnglish(fullMatch[2]);
    const chinese = cleanChinese(fullMatch[3]);
    if (isValidEnglish(english) && chinese) {
      return { english, chinese };
    }
  }

  const posChineseMatch = trimmed.match(POS_CHINESE_PATTERN);
  if (posChineseMatch) {
    return { chinese: cleanChinese(posChineseMatch[1]) };
  }

  const parts = splitParts(trimmed);
  if (parts) {
    const [partA, partB] = parts;

    if (hasEnglish(partA) && hasChinese(partB)) {
      const englishTokens = extractEnglishTokens(partA);
      const chinese = cleanChinese(partB);
      if (englishTokens.length === 1 && chinese) {
        return { english: englishTokens[0], chinese };
      }
    }

    if (hasChinese(partA) && hasEnglish(partB)) {
      const englishTokens = extractEnglishTokens(partB);
      const chinese = cleanChinese(partA);
      if (englishTokens.length === 1 && chinese) {
        return { english: englishTokens[0], chinese };
      }
    }

    if (hasChinese(partB) && !isValidEnglish(cleanEnglish(partA))) {
      return { chinese: cleanChinese(partB) };
    }
  }

  const englishTokens = extractEnglishTokens(trimmed);
  if (englishTokens.length === 1 && !hasChinese(trimmed)) {
    return { english: englishTokens[0] };
  }

  if (hasChinese(trimmed) && englishTokens.length === 0) {
    return { chinese: cleanChinese(trimmed) };
  }

  return null;
}

function pairLineEntries(entries: LineEntry[]): ParsedWord[] {
  const paired = entries.map((entry) => ({ ...entry }));
  const results: ParsedWord[] = [];
  const seen = new Set<string>();

  const addWord = (english: string, chinese: string) => {
    if (!isValidEnglish(english) || !chinese) return;
    const key = english.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ english, chinese });
  };

  for (let i = 0; i < paired.length; i++) {
    const current = paired[i];
    if (current.used || !current.english || current.chinese) continue;

    const previous = paired[i - 1];
    if (previous && !previous.used && !previous.english && previous.chinese) {
      addWord(current.english, previous.chinese);
      current.used = true;
      previous.used = true;
      continue;
    }

    const next = paired[i + 1];
    if (next && !next.used && !next.english && next.chinese) {
      addWord(current.english, next.chinese);
      current.used = true;
      next.used = true;
    }
  }

  for (const entry of paired) {
    if (entry.used) continue;
    if (entry.english && entry.chinese) {
      addWord(entry.english, entry.chinese);
    }
  }

  return results;
}

export function parseWordsFromText(text: string): ParsedWord[] {
  const entries: LineEntry[] = [];

  for (const line of text.split(/\r?\n/)) {
    const entry = parseLineEntry(line);
    if (entry) entries.push(entry);
  }

  return pairLineEntries(entries);
}

export function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function checkSpellingAnswer(expected: string, userAnswer: string): boolean {
  return normalizeAnswer(expected) === normalizeAnswer(userAnswer);
}

export function checkMeaningAnswer(expected: string, userAnswer: string): boolean {
  const normExpected = normalizeAnswer(expected);
  const normUser = normalizeAnswer(userAnswer);
  if (normExpected === normUser) return true;
  const expectedParts = normExpected.split(/[;；,，/／、]/).map((s) => s.trim()).filter(Boolean);
  return expectedParts.some((part) => part === normUser || normUser.includes(part) || part.includes(normUser));
}

export function classifyEnToCnResult(expected: string, userAnswer: string): 'correct' | 'meaning_wrong' | 'unknown' {
  const trimmed = userAnswer.trim();
  if (!trimmed) return 'unknown';
  if (checkMeaningAnswer(expected, trimmed)) return 'correct';
  return 'meaning_wrong';
}

export function classifyCnToEnResult(expected: string, userAnswer: string): 'correct' | 'spelling_error' | 'unknown' {
  const trimmed = userAnswer.trim();
  if (!trimmed) return 'unknown';
  if (checkSpellingAnswer(expected, trimmed)) return 'correct';
  return 'spelling_error';
}

export function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
