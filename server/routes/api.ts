import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { ocrAndParseImage, parseTextImport, createImagePreview } from '../services/ocrService.js';
import {
  getAllWords,
  importWords,
  deleteWord,
  deleteWords,
  deleteAllWords,
  updateWord,
  getWordById,
} from '../services/wordService.js';
import {
  getDailyTest,
  getCombinedDailyTest,
  submitTestResult,
  getDailyReport,
  getReportHistory,
  getErrorBook,
  getWeeklyReview,
  getWeeklyReviewTest,
  getStatsOverview,
  getWordHistory,
} from '../services/testService.js';
import {
  classifyEnToCnResult,
  classifyCnToEnResult,
} from '../services/wordParser.js';
import type { TestMode } from '../types.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(requireAuth);

router.get('/stats', (req, res) => {
  res.json(getStatsOverview(req.userId));
});

router.get('/words', (req, res) => {
  res.json(getAllWords(req.userId));
});

router.delete('/words/all', (req, res) => {
  const deleted = deleteAllWords(req.userId);
  res.json({ success: true, deleted });
});

router.post('/words/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: '请提供要删除的单词 ID' });
    return;
  }
  const numericIds = ids.map((id) => parseInt(String(id), 10)).filter((id) => !Number.isNaN(id));
  if (numericIds.length === 0) {
    res.status(400).json({ error: '无效的单词 ID' });
    return;
  }
  const deleted = deleteWords(numericIds, req.userId);
  res.json({ success: true, deleted });
});

router.delete('/words/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ok = deleteWord(id, req.userId);
  res.json({ success: ok });
});

router.put('/words/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { english, chinese } = req.body;
  if (!english || !chinese) {
    res.status(400).json({ error: '缺少英文或中文' });
    return;
  }
  const word = updateWord(id, req.userId, english, chinese);
  if (!word) {
    res.status(400).json({ error: '更新失败，可能英文重复' });
    return;
  }
  res.json(word);
});

router.post('/import/text', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: '请提供文本内容' });
    return;
  }
  const parsed = parseTextImport(text);
  res.json(parsed);
});

router.post('/import/preview', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传图片' });
    return;
  }
  try {
    const preview = await createImagePreview(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    res.json(preview);
  } catch (err) {
    console.error('Preview error:', err);
    const message = err instanceof Error ? err.message : '预览生成失败';
    res.status(500).json({ error: message });
  }
});

router.post('/import/image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传图片' });
    return;
  }
  try {
    const ocrResult = await ocrAndParseImage(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    res.json(ocrResult);
  } catch (err) {
    console.error('OCR error:', err);
    const message =
      err instanceof Error ? err.message : 'OCR 识别失败，请确保图片清晰或尝试手动输入';
    res.status(500).json({ error: message });
  }
});

router.post('/import/confirm', (req, res) => {
  const { words } = req.body;
  if (!Array.isArray(words) || words.length === 0) {
    res.status(400).json({ error: '请提供单词列表' });
    return;
  }
  const result = importWords(req.userId, words);
  res.json(result);
});

router.get('/test/daily', (req, res) => {
  const mode = req.query.mode as TestMode | 'combined' | undefined;
  if (mode === 'en_to_cn' || mode === 'cn_to_en') {
    res.json(getDailyTest(req.userId, mode));
  } else {
    res.json(getCombinedDailyTest(req.userId));
  }
});

router.post('/test/submit', (req, res) => {
  const { wordId, mode, userAnswer } = req.body;
  if (!wordId || !mode) {
    res.status(400).json({ error: '参数不完整' });
    return;
  }

  const word = getWordById(wordId, req.userId);
  if (!word) {
    res.status(404).json({ error: '单词不存在' });
    return;
  }

  let resultType;
  if (mode === 'en_to_cn') {
    resultType = classifyEnToCnResult(word.chinese, userAnswer ?? '');
  } else if (mode === 'cn_to_en') {
    resultType = classifyCnToEnResult(word.english, userAnswer ?? '');
  } else {
    res.status(400).json({ error: '无效的模式' });
    return;
  }

  submitTestResult(req.userId, { wordId, mode, resultType, userAnswer });
  res.json({
    resultType,
    correct: resultType === 'correct',
    expected: mode === 'en_to_cn' ? word.chinese : word.english,
  });
});

router.get('/report/daily', (req, res) => {
  const date = req.query.date as string | undefined;
  res.json(getDailyReport(req.userId, date));
});

router.get('/report/history', (req, res) => {
  const days = parseInt(req.query.days as string, 10) || 7;
  res.json(getReportHistory(req.userId, days));
});

router.get('/error-book', (req, res) => {
  res.json(getErrorBook(req.userId));
});

router.get('/review/weekly', (req, res) => {
  res.json(getWeeklyReview(req.userId));
});

router.get('/review/weekly/test', (req, res) => {
  res.json(getWeeklyReviewTest(req.userId));
});

router.get('/words/:id/history', (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(getWordHistory(req.userId, id));
});

export default router;
