import cron from 'node-cron';
import { env } from '../config/env.js';
import { Report } from '../models/report.model.js';
import { emitReportUpdated } from '../realtime/socket.js';

export async function escalateOldReports(): Promise<number> {
  const threshold = new Date(Date.now() - env.reportEscalationMinutes * 60 * 1000);
  const reports = await Report.find({
    status: 'OPEN',
    createdAt: { $lte: threshold }
  }).populate([{ path: 'channelId', select: 'name' }, { path: 'userId', select: 'email' }]);

  let escalated = 0;
  for (const report of reports) {
    try {
      report.status = 'ESCALATED';
      await report.save();
      const userId = report.populated('userId')
        ? (report.userId as unknown as { _id: { toString(): string } })._id.toString()
        : report.userId.toString();
      emitReportUpdated(userId, report.toObject());
      escalated += 1;
    } catch (error) {
      console.error(`Could not escalate report ${report.id}:`, error);
    }
  }
  if (escalated > 0) console.log(`[cron] ${escalated} report(s) escalated to ESCALATED`);
  return escalated;
}

export function startReportEscalationJob(): void {
  console.log(`[cron] Report escalation job scheduled: "${env.reportEscalationCron}" (threshold ${env.reportEscalationMinutes} min)`);
  cron.schedule(env.reportEscalationCron, () => {
    void escalateOldReports().catch((error) => console.error('Report escalation job failed:', error));
  });
}
