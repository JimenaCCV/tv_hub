import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

type ReportEmailData = {
  _id?: { toString(): string };
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  resolvedAt?: Date | null;
  evidenceUrls: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
}

let transporterPromise: Promise<Transporter> | undefined;
let usesEthereal = false;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.nodeEnv === 'test') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    if (env.smtpHost) {
      usesEthereal = false;
      return nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
      });
    }

    usesEthereal = true;
    const account = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
  })();

  return transporterPromise;
}

async function sendWithTransporter(message: SendMailOptions): Promise<void> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail(message);

  if (usesEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`Email preview: ${previewUrl}`);
  }
}

export async function sendReportCreatedEmail(report: ReportEmailData, channelName: string): Promise<void> {
  const created = formatDate(report.createdAt);

  await sendWithTransporter({
    from: env.smtpFrom,
    to: env.reportNotificationEmail,
    subject: `Nuevo Report: ${channelName}`,
    text: [
      'Se creó un nuevo Report en TV Hub.',
      `Canal: ${channelName}`,
      `Razón: ${report.reason}`,
      `Descripción: ${report.description}`,
      `Estado: ${report.status}`,
      `Fecha de creación: ${created}`,
      `Evidencias: ${report.evidenceUrls.length}`
    ].join('\n'),
    html: `
      <h2>Nuevo Report en TV Hub</h2>
      <ul>
        <li><strong>Canal:</strong> ${escapeHtml(channelName)}</li>
        <li><strong>Razón:</strong> ${escapeHtml(report.reason)}</li>
        <li><strong>Descripción:</strong> ${escapeHtml(report.description)}</li>
        <li><strong>Estado:</strong> ${escapeHtml(report.status)}</li>
        <li><strong>Fecha de creación:</strong> ${escapeHtml(created)}</li>
        <li><strong>Evidencias:</strong> ${report.evidenceUrls.length}</li>
      </ul>`
  });
}

export async function sendReportResolvedEmail(report: ReportEmailData, channelName: string, recipient: string): Promise<void> {
  const reportId = report._id?.toString() ?? 'N/D';
  const resolved = report.resolvedAt ? formatDate(report.resolvedAt) : 'N/D';

  await sendWithTransporter({
    from: env.smtpFrom,
    to: recipient,
    subject: `Tu Report fue resuelto: ${channelName}`,
    text: [
      'El equipo de soporte resolvió tu Report en TV Hub.',
      `Report: ${reportId}`,
      `Canal: ${channelName}`,
      `Estado final: ${report.status}`,
      `Fecha de resolución: ${resolved}`,
      `Tu descripción original: ${report.description}`
    ].join('\n'),
    html: `
      <h2>Tu Report fue resuelto</h2>
      <p>El equipo de soporte de TV Hub marcó tu Report como resuelto.</p>
      <ul>
        <li><strong>Report:</strong> ${escapeHtml(reportId)}</li>
        <li><strong>Canal:</strong> ${escapeHtml(channelName)}</li>
        <li><strong>Estado final:</strong> ${escapeHtml(report.status)}</li>
        <li><strong>Fecha de resolución:</strong> ${escapeHtml(resolved)}</li>
        <li><strong>Tu descripción original:</strong> ${escapeHtml(report.description)}</li>
      </ul>`
  });
}
