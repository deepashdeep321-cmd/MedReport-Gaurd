import crypto from 'node:crypto';
import type {
  AuditLogEntry,
  AuthUser,
  LanguageCode,
  ReportRecord,
  RulesBundle,
  RuleVersionEntry,
  UserRole,
} from '../src/types/medreport';
import { createDefaultRulesBundle } from '../src/pipeline/rulesData';
import { buildSyntheticReportRecord, SYNTHETIC_PRESETS } from '../src/pipeline/syntheticReports';

interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  language: LanguageCode;
  created_at: string;
}

interface SessionRecord {
  token: string;
  user_id: string;
  role: UserRole;
  expires_at: number;
}

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
export const DEMO_USER_ID = 'demo-patient-workspace';

function resolveEncryptionKey(): Buffer {
  const envHex = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (envHex && /^[0-9a-fA-F]{64}$/.test(envHex)) {
    return Buffer.from(envHex, 'hex');
  }
  return crypto.randomBytes(32);
}

const ENCRYPTION_KEY = resolveEncryptionKey();

export function encryptJson<T>(payload: T): EncryptedEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

export function decryptJson<T>(envelope: EncryptedEnvelope): T {
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

class EncryptedMemoryStore {
  private usersByEmail = new Map<string, StoredUser>();
  private usersById = new Map<string, StoredUser>();
  private sessions = new Map<string, SessionRecord>();
  private reportsByUser = new Map<string, Map<string, EncryptedEnvelope>>();
  private rules: RulesBundle = createDefaultRulesBundle();
  private ruleVersions: RuleVersionEntry[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private claimedAdminHash: string | null = null;
  private rulesMinorVersion = 0;

  constructor() {
    this.ruleVersions = [
      {
        id: 'rv-1',
        name: 'conflict_rules',
        version: '1.0.0',
        updated_at: this.rules.updated_at,
        summary: 'Initial C1-C7 illustrative comorbidity safety rules.',
      },
      {
        id: 'rv-2',
        name: 'critical_limits',
        version: '1.0.0',
        updated_at: this.rules.updated_at,
        summary: 'Initial critical limits (marked NEEDS_CLINICAL_REVIEW).',
      },
      {
        id: 'rv-3',
        name: 'test_aliases',
        version: '1.0.0',
        updated_at: this.rules.updated_at,
        summary: 'Initial canonical lab test alias dictionary.',
      },
    ];
    this.seedDemoWorkspace();
  }

  seedDemoWorkspace(userId: string = DEMO_USER_ID): void {
    const userMap = new Map<string, EncryptedEnvelope>();
    // Seed 3 longitudinal synthetic visits (baseline, 6-month follow-up, latest with low-confidence creatinine cell)
    for (const preset of SYNTHETIC_PRESETS.slice(0, 3)) {
      const record = buildSyntheticReportRecord(preset, userId, this.rules);
      userMap.set(record.id, encryptJson(record));
    }
    this.reportsByUser.set(userId, userMap);
    this.addAuditLog(null, 'workspace_seeded', {
      synthetic_report_count: 3,
      encryption: 'aes-256-gcm',
    });
  }

  // ---- Auth ----
  registerUser(email: string, password: string, language: LanguageCode = 'en'): { user: AuthUser; token: string } {
    const normalizedEmail = email.trim().toLowerCase();
    if (this.usersByEmail.has(normalizedEmail)) {
      throw new Error('EMAIL_EXISTS');
    }
    const id = `usr-${crypto.randomUUID()}`;
    const stored: StoredUser = {
      id,
      email: normalizedEmail,
      password_hash: hashPassword(password),
      role: 'patient',
      language,
      created_at: new Date().toISOString(),
    };
    this.usersByEmail.set(normalizedEmail, stored);
    this.usersById.set(id, stored);
    this.seedDemoWorkspace(id);
    const token = this.createSession(id, 'patient');
    this.addAuditLog(null, 'user_registered', { role: 'patient' });
    return {
      user: { id: stored.id, email: stored.email, role: stored.role, language: stored.language },
      token,
    };
  }

  loginUser(email: string, password: string): { user: AuthUser; token: string } | null {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = this.usersByEmail.get(normalizedEmail);
    if (!stored || !verifyPassword(password, stored.password_hash)) {
      return null;
    }
    const token = this.createSession(stored.id, stored.role);
    this.addAuditLog(null, 'user_logged_in', { role: stored.role });
    return {
      user: { id: stored.id, email: stored.email, role: stored.role, language: stored.language },
      token,
    };
  }

  createSession(userId: string, role: UserRole): string {
    const token = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(token, {
      token,
      user_id: userId,
      role,
      expires_at: Date.now() + SESSION_TTL_MS,
    });
    return token;
  }

  getSession(token: string | undefined): SessionRecord | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expires_at) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  getUserById(userId: string): AuthUser | null {
    if (userId === 'admin-operator') {
      return { id: 'admin-operator', email: 'admin@medreport-guard.local', role: 'admin', language: 'en' };
    }
    const stored = this.usersById.get(userId);
    if (!stored) return null;
    return { id: stored.id, email: stored.email, role: stored.role, language: stored.language };
  }

  // ---- Admin first-run claim / env passcode ----
  getAdminStatus(): { envConfigured: boolean; claimed: boolean } {
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    return {
      envConfigured: Boolean(envPass && envPass.length > 0),
      claimed: Boolean(this.claimedAdminHash),
    };
  }

  claimAdminPassword(password: string): string {
    const status = this.getAdminStatus();
    if (status.envConfigured || status.claimed) {
      throw new Error('ADMIN_ALREADY_CONFIGURED');
    }
    this.claimedAdminHash = hashPassword(password);
    this.addAuditLog(null, 'admin_claimed', { mode: 'first_run_setup' });
    return this.createSession('admin-operator', 'admin');
  }

  loginAdmin(password: string): string | null {
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass && envPass.length > 0) {
      const a = Buffer.from(password, 'utf8');
      const b = Buffer.from(envPass, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
      }
      this.addAuditLog(null, 'admin_logged_in', { mode: 'env_passcode' });
      return this.createSession('admin-operator', 'admin');
    }
    if (!this.claimedAdminHash) {
      return null;
    }
    if (!verifyPassword(password, this.claimedAdminHash)) {
      return null;
    }
    this.addAuditLog(null, 'admin_logged_in', { mode: 'claimed_password' });
    return this.createSession('admin-operator', 'admin');
  }

  // ---- Encrypted Reports ----
  listReports(userId: string): ReportRecord[] {
    const map = this.reportsByUser.get(userId);
    if (!map) return [];
    const items: ReportRecord[] = [];
    for (const env of map.values()) {
      items.push(decryptJson<ReportRecord>(env));
    }
    return items.sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  }

  getReport(userId: string, reportId: string): ReportRecord | null {
    const map = this.reportsByUser.get(userId);
    if (!map) return null;
    const env = map.get(reportId);
    if (!env) return null;
    return decryptJson<ReportRecord>(env);
  }

  saveReport(userId: string, report: ReportRecord): void {
    let map = this.reportsByUser.get(userId);
    if (!map) {
      map = new Map<string, EncryptedEnvelope>();
      this.reportsByUser.set(userId, map);
    }
    map.set(report.id, encryptJson(report));
  }

  deleteReport(userId: string, reportId: string): boolean {
    const map = this.reportsByUser.get(userId);
    if (!map) return false;
    const deleted = map.delete(reportId);
    if (deleted) {
      this.addAuditLog(reportId, 'report_deleted', { encrypted_store_purged: true });
    }
    return deleted;
  }

  deleteAllUserData(userId: string): number {
    const map = this.reportsByUser.get(userId);
    const count = map ? map.size : 0;
    this.reportsByUser.set(userId, new Map());
    this.addAuditLog(null, 'user_data_erased', { reports_removed: count });
    return count;
  }

  // ---- Rules & Audit Log (Strictly PII-Free) ----
  getRules(): RulesBundle {
    return structuredClone(this.rules);
  }

  getRuleVersions(): RuleVersionEntry[] {
    return [...this.ruleVersions];
  }

  updateRuleSection<K extends keyof Omit<RulesBundle, 'version' | 'updated_at'>>(
    name: K,
    data: RulesBundle[K],
    summary: string,
  ): RulesBundle {
    this.rulesMinorVersion += 1;
    const nextVersion = `1.${this.rulesMinorVersion}.0`;
    const now = new Date().toISOString();
    this.rules = {
      ...this.rules,
      [name]: data,
      version: nextVersion,
      updated_at: now,
    };
    this.ruleVersions.unshift({
      id: `rv-${crypto.randomUUID().slice(0, 8)}`,
      name,
      version: nextVersion,
      updated_at: now,
      summary: summary.slice(0, 140),
    });
    this.addAuditLog(null, 'rules_updated', {
      rule_name: name,
      new_version: nextVersion,
    });
    return this.getRules();
  }

  addAuditLog(
    reportId: string | null,
    event: string,
    details: Record<string, string | number | boolean | string[]>,
  ): void {
    this.auditLogs.unshift({
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      report_id: reportId,
      event,
      details,
      created_at: new Date().toISOString(),
    });
    if (this.auditLogs.length > 200) {
      this.auditLogs.length = 200;
    }
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }
}

export const store = new EncryptedMemoryStore();
