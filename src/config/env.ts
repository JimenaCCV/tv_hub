import dotenv from 'dotenv';

// A clone of the project does not contain .env because it must never be
// committed. Platform variables (Render, GitHub Actions) or a local .env always
// take precedence. Outside production, safe local fallbacks keep `npm run dev`
// working immediately; production never uses them and fails fast instead.
dotenv.config({ path: '.env' });

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, developmentFallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (!isProduction && developmentFallback) return developmentFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function positiveNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  // MONGODB_URI is the cloud name (Atlas/Render); MONGO_URI is accepted only for older local .env files.
  mongoUri: required('MONGODB_URI', process.env.MONGO_URI || 'mongodb://localhost:27017/tvhub'),
  accessSecret: required('JWT_ACCESS_SECRET', 'dev-only-access-secret-not-for-production'),
  refreshSecret: required('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-not-for-production'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  reportNotificationEmail: process.env.REPORT_NOTIFICATION_EMAIL || 'reports@tvhub.local',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: positiveNumber('SMTP_PORT', 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || 'TV Hub <no-reply@tvhub.local>',
  reportEscalationMinutes: positiveNumber('REPORT_ESCALATION_MINUTES', 2),
  reportEscalationCron: process.env.REPORT_ESCALATION_CRON || '*/1 * * * *'
};
