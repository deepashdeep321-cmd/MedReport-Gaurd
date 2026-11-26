import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { DEMO_USER_ID, store } from './server/store';
import {
  extractResultsFromMaskedImage,
  generateVerifiedSummaries,
} from './server/geminiPipeline';
import { applyRuleChecker } from './src/pipeline/rules';
import { runComorbiditySafetyFilter } from './src/pipeline/safetyFilter';
import { buildSyntheticReportRecord, SYNTHETIC_PRESETS } from './src/pipeline/syntheticReports';
import type { PiiMaskBox, QualityCheckResult, ReportRecord, RulesBundle, TrendPoint } from './src/types/medreport';

const PORT = 3000;

interface AuthedRequest extends Request {
  userId?: string;
  userRole?: 'patient' | 'reviewer' | 'admin';
  sessionToken?: string;
}

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

function resolveUserContext(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  const session = store.getSession(token);
  if (session) {
    req.userId = session.user_id;
    req.userRole = session.role;
    req.sessionToken = token;
  } else {
    req.userId = DEMO_USER_ID;
    req.userRole = 'patient';
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  const session = store.getSession(token);
  if (!session || session.role !== 'admin') {
    res.status(403).json({ error: 'Admin authentication required.' });
    return;
  }
  req.userId = session.user_id;
  req.userRole = session.role;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // ---- Health ----
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'medreport-guard',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      rulesVersion: store.getRules().version,
    });
  });

  // ---- Auth ----
  app.post('/api/auth/register', (req, res) => {
    const { email, password, language } = req.body ?? {};
    if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Provide a valid email and a password of at least 8 characters.' });
      return;
    }
    try {
      const lang = language === 'ta' || language === 'hi' ? language : 'en';
      const result = store.registerUser(email, password, lang);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }
      res.status(500).json({ error: 'Unable to create account.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const result = store.loginUser(email, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    res.json(result);
  });

  app.post('/api/auth/logout', resolveUserContext, (req: AuthedRequest, res) => {
    if (req.sessionToken) {
      store.revokeSession(req.sessionToken);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', resolveUserContext, (req: AuthedRequest, res) => {
    if (!req.sessionToken || !req.userId || req.userId === DEMO_USER_ID) {
      res.json({
        authenticated: false,
        user: {
          id: DEMO_USER_ID,
          email: 'demo.workspace@medreport-guard.local',
          role: 'patient',
          language: 'en',
        },
      });
      return;
    }
    const user = store.getUserById(req.userId);
    res.json({ authenticated: Boolean(user), user });
  });

  // ---- Reports ----
  app.get('/api/reports', resolveUserContext, (req: AuthedRequest, res) => {
    const reports = store.listReports(req.userId!);
    res.json({ reports });
  });

  app.get('/api/reports/:id', resolveUserContext, (req: AuthedRequest, res) => {
    const report = store.getReport(req.userId!, String(req.params.id));
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    res.json({ report });
  });

  app.post('/api/reports', resolveUserContext, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const rules = store.getRules();
    const {
      presetId,
      title,
      visitDate,
      patientAgeSex,
      originalImageUrl,
      maskedImageUrl,
      pageWidth,
      pageHeight,
      piiMasks,
      qualityCheck,
      useLlm,
    } = req.body ?? {};

    // Case 1: Quality check failed before extraction
    if (qualityCheck && qualityCheck.passed === false) {
      const reportId = `rep-${crypto.randomUUID().slice(0, 8)}`;
      store.addAuditLog(reportId, 'quality_failed', {
        score: Number(qualityCheck.score ?? 0),
        blur_score: Number(qualityCheck.blur_score ?? 0),
      });
      res.status(422).json({
        status: 'quality_failed',
        quality_check: qualityCheck,
        error: qualityCheck.reason || 'Image quality is too low for safe reading. Please retake the photo in bright light.',
      });
      return;
    }

    // Case 2: Synthetic preset analysis (demonstrates complete pipeline end-to-end)
    if (typeof presetId === 'string') {
      const preset = SYNTHETIC_PRESETS.find((p) => p.id === presetId);
      if (!preset) {
        res.status(400).json({ error: 'Unknown synthetic preset.' });
        return;
      }
      const reportId = `rep-${crypto.randomUUID().slice(0, 8)}`;
      const baseReport = buildSyntheticReportRecord(preset, userId, rules, reportId);
      if (typeof visitDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
        baseReport.visit_date = visitDate;
      }

      const safety = runComorbiditySafetyFilter(baseReport.results, rules.conflict_rules);
      baseReport.safety_hits = safety.hits;
      baseReport.blocked_items = safety.blocked_items;
      baseReport.summaries = await generateVerifiedSummaries(
        baseReport.results,
        safety,
        baseReport.patient_age_sex,
        rules.version,
        useLlm !== false,
      );

      store.saveReport(userId, baseReport);
      store.addAuditLog(reportId, 'pipeline_completed', {
        source: 'synthetic_preset',
        result_count: baseReport.results.length,
        safety_hits: safety.hits.map((h) => h.rule_id),
        verifier_passed: baseReport.summaries.en.verifier_log.passed,
        used_fallback: baseReport.summaries.en.used_fallback,
      });

      res.status(201).json({ report: baseReport });
      return;
    }

    // Case 3: Real uploaded report image (already PII-masked client-side before sending)
    if (typeof maskedImageUrl !== 'string' || !maskedImageUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Provide a masked lab report image or select a synthetic sample.' });
      return;
    }

    const reportId = `rep-${crypto.randomUUID().slice(0, 8)}`;
    const safeWidth = Number.isFinite(Number(pageWidth)) ? Math.max(200, Math.min(4000, Number(pageWidth))) : 900;
    const safeHeight = Number.isFinite(Number(pageHeight)) ? Math.max(200, Math.min(5000, Number(pageHeight))) : 1160;
    const safeDate =
      typeof visitDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(visitDate)
        ? visitDate
        : new Date().toISOString().slice(0, 10);

    try {
      store.addAuditLog(reportId, 'pii_masked', {
        mask_box_count: Array.isArray(piiMasks) ? piiMasks.length : 1,
      });

      const extractedResults = await extractResultsFromMaskedImage(
        maskedImageUrl,
        safeWidth,
        safeHeight,
        rules,
        reportId,
      );

      if (extractedResults.length === 0) {
        res.status(422).json({
          error: 'No readable lab test rows were detected in this image. Please upload a clearer photo of the results table.',
        });
        return;
      }

      const safety = runComorbiditySafetyFilter(extractedResults, rules.conflict_rules);
      const safeAgeSex = typeof patientAgeSex === 'string' && patientAgeSex.trim() ? patientAgeSex.trim().slice(0, 20) : 'Not listed';
      const summaries = await generateVerifiedSummaries(
        extractedResults,
        safety,
        safeAgeSex,
        rules.version,
        true,
      );

      const qCheck: QualityCheckResult = qualityCheck || {
        passed: true,
        score: 88,
        blur_score: 260,
        brightness_score: 195,
      };

      const needsConfirm = extractedResults.some((r) => r.needs_confirmation && !r.user_confirmed);
      const record: ReportRecord = {
        id: reportId,
        user_id: userId,
        title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : 'Uploaded Lab Report',
        lab_name_masked: 'Masked Clinical Laboratory',
        visit_date: safeDate,
        patient_age_sex: safeAgeSex,
        status: needsConfirm ? 'needs_confirmation' : 'done',
        quality_check: qCheck,
        page_width: safeWidth,
        page_height: safeHeight,
        original_image_url: typeof originalImageUrl === 'string' && originalImageUrl.startsWith('data:image/') ? originalImageUrl : maskedImageUrl,
        masked_image_url: maskedImageUrl,
        pii_masks: Array.isArray(piiMasks) ? (piiMasks as PiiMaskBox[]) : [],
        results: extractedResults,
        safety_hits: safety.hits,
        blocked_items: safety.blocked_items,
        summaries,
        created_at: new Date().toISOString(),
      };

      store.saveReport(userId, record);
      store.addAuditLog(reportId, 'pipeline_completed', {
        source: 'user_upload',
        result_count: extractedResults.length,
        safety_hits: safety.hits.map((h) => h.rule_id),
        verifier_passed: summaries.en.verifier_log.passed,
        used_fallback: summaries.en.used_fallback,
      });

      res.status(201).json({ report: record });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to extract results from the uploaded report.';
      store.addAuditLog(reportId, 'pipeline_failed', { stage: 'table_extract' });
      res.status(502).json({ error: msg });
    }
  });

  // Confirm or correct a low-confidence value and re-run deterministic downstream pipeline
  app.patch('/api/reports/:id/results/:resultKey', resolveUserContext, async (req: AuthedRequest, res) => {
    const userId = req.userId!;
    const reportId = String(req.params.id);
    const resultKey = String(req.params.resultKey);
    const report = store.getReport(userId, reportId);
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const { value, unit_std } = req.body ?? {};
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      res.status(400).json({ error: 'A valid numeric value is required.' });
      return;
    }

    const rules = store.getRules();
    let found = false;
    const updatedResults = report.results.map((item) => {
      if (item.result_key !== resultKey) return item;
      found = true;
      return {
        ...item,
        value: Number(numericValue.toFixed(2)),
        value_raw: String(numericValue),
        unit_std: typeof unit_std === 'string' && unit_std.trim() ? unit_std.trim().slice(0, 24) : item.unit_std,
        confidence: 1.0,
        needs_confirmation: false,
        user_confirmed: true,
      };
    });

    if (!found) {
      res.status(404).json({ error: 'Result key not found in report.' });
      return;
    }

    const reFlagged = applyRuleChecker(updatedResults, rules);
    const safety = runComorbiditySafetyFilter(reFlagged, rules.conflict_rules);
    const summaries = await generateVerifiedSummaries(
      reFlagged,
      safety,
      report.patient_age_sex,
      rules.version,
      true,
    );

    const stillNeedsConfirm = reFlagged.some((r) => r.needs_confirmation && !r.user_confirmed);
    const nextReport: ReportRecord = {
      ...report,
      results: reFlagged,
      safety_hits: safety.hits,
      blocked_items: safety.blocked_items,
      summaries,
      status: stillNeedsConfirm ? 'needs_confirmation' : 'done',
    };

    store.saveReport(userId, nextReport);
    store.addAuditLog(reportId, 'user_confirmed_value', {
      result_key: resultKey,
      safety_hits: safety.hits.map((h) => h.rule_id),
      verifier_passed: summaries.en.verifier_log.passed,
    });

    res.json({ report: nextReport });
  });

  app.delete('/api/reports/:id', resolveUserContext, (req: AuthedRequest, res) => {
    const deleted = store.deleteReport(req.userId!, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.delete('/api/me/data', resolveUserContext, (req: AuthedRequest, res) => {
    const removed = store.deleteAllUserData(req.userId!);
    res.json({ ok: true, removed });
  });

  app.post('/api/demo/reset', resolveUserContext, (req: AuthedRequest, res) => {
    store.seedDemoWorkspace(req.userId!);
    res.json({ ok: true, reports: store.listReports(req.userId!) });
  });

  // ---- Trends ----
  app.get('/api/trends', resolveUserContext, (req: AuthedRequest, res) => {
    const reports = store.listReports(req.userId!).slice().sort((a, b) => a.visit_date.localeCompare(b.visit_date));
    const requestedTest = typeof req.query.test === 'string' ? req.query.test.trim() : '';

    const availableMap = new Map<string, string>();
    const seriesByTest: Record<string, TrendPoint[]> = {};

    for (const report of reports) {
      for (const r of report.results) {
        availableMap.set(r.test_name_std, r.display_name);
        if (!seriesByTest[r.test_name_std]) {
          seriesByTest[r.test_name_std] = [];
        }
        seriesByTest[r.test_name_std].push({
          report_id: report.id,
          visit_date: report.visit_date,
          value: r.value,
          unit_std: r.unit_std,
          ref_low: r.ref_low,
          ref_high: r.ref_high,
          flag: r.flag,
        });
      }
    }

    const availableTests = Array.from(availableMap.entries()).map(([key, display_name]) => ({
      test_name_std: key,
      display_name,
      count: seriesByTest[key]?.length ?? 0,
    }));

    const selectedKey = requestedTest && seriesByTest[requestedTest] ? requestedTest : availableTests[0]?.test_name_std || '';

    res.json({
      availableTests,
      selectedTest: selectedKey,
      points: selectedKey ? seriesByTest[selectedKey] : [],
    });
  });

  // ---- Admin Auth & Versioned Rules ----
  app.get('/api/admin/status', (_req, res) => {
    res.json(store.getAdminStatus());
  });

  app.post('/api/admin/claim', (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Choose an admin password of at least 8 characters.' });
      return;
    }
    try {
      const token = store.claimAdminPassword(password);
      res.status(201).json({ token, role: 'admin' });
    } catch (err) {
      if (err instanceof Error && err.message === 'ADMIN_ALREADY_CONFIGURED') {
        res.status(409).json({ error: 'Admin password is already configured. Please sign in.' });
        return;
      }
      res.status(500).json({ error: 'Unable to claim admin setup.' });
    }
  });

  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }
    const token = store.loginAdmin(password);
    if (!token) {
      res.status(401).json({ error: 'Invalid admin password.' });
      return;
    }
    res.json({ token, role: 'admin' });
  });

  app.get('/api/admin/rules', requireAdmin, (_req, res) => {
    res.json({
      rules: store.getRules(),
      versions: store.getRuleVersions(),
    });
  });

  app.put('/api/admin/rules/:name', requireAdmin, (req, res) => {
    const name = String(req.params.name) as keyof Omit<RulesBundle, 'version' | 'updated_at'>;
    const allowed: Array<keyof Omit<RulesBundle, 'version' | 'updated_at'>> = [
      'conflict_rules',
      'critical_limits',
      'test_aliases',
      'unit_conversions',
    ];
    if (!allowed.includes(name)) {
      res.status(400).json({ error: 'Unsupported rule table name.' });
      return;
    }

    const { data, summary } = req.body ?? {};
    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Valid JSON rule data is required.' });
      return;
    }
    if ((name === 'conflict_rules' || name === 'critical_limits' || name === 'unit_conversions') && !Array.isArray(data)) {
      res.status(400).json({ error: `${name} must be a JSON array.` });
      return;
    }

    const updated = store.updateRuleSection(
      name,
      data,
      typeof summary === 'string' && summary.trim() ? summary.trim() : `Updated ${name}`,
    );

    res.json({
      rules: updated,
      versions: store.getRuleVersions(),
    });
  });

  app.get('/api/admin/audit', requireAdmin, (_req, res) => {
    res.json({ logs: store.getAuditLogs() });
  });

  // ---- Vite Dev Middleware / Production Static ----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedReport-Guard server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MedReport-Guard server:', err);
  process.exit(1);
});
