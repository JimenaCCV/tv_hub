import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { Channel } from '../models/channel.model.js';
import { reportUploadsDirectory } from '../middleware/upload.js';
import { Report, reportReasons, reportStatuses } from '../models/report.model.js';
import { AppError } from '../utils/app-error.js';

function getUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
  return request.auth.userId;
}

function readRequiredText(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(400, code, message);
  return value.trim();
}

function readReason(value: unknown): (typeof reportReasons)[number] {
  const reason = readRequiredText(value, 'INVALID_REPORT_REASON', 'Report reason is invalid');
  if (!reportReasons.includes(reason as (typeof reportReasons)[number])) {
    throw new AppError(400, 'INVALID_REPORT_REASON', 'Report reason is invalid');
  }
  return reason as (typeof reportReasons)[number];
}

function readDescription(value: unknown): string {
  const description = readRequiredText(value, 'INVALID_REPORT_DESCRIPTION', 'Description is required');
  if (description.length > 1000) {
    throw new AppError(400, 'INVALID_REPORT_DESCRIPTION', 'Description must be 1000 characters or fewer');
  }
  return description;
}

function readReportId(value: unknown): string {
  if (typeof value !== 'string' || !isValidObjectId(value)) {
    throw new AppError(400, 'INVALID_REPORT_ID', 'Report id is invalid');
  }
  return value;
}

// Files are removed by name from the uploads folder; path.basename prevents
// a stored URL from ever pointing outside of uploads/reports.
async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((filePath) => unlink(filePath).catch(() => undefined)));
}

function evidencePaths(urls: string[]): string[] {
  return urls.map((url) => path.join(reportUploadsDirectory, path.basename(url)));
}

export const createReport: RequestHandler = async (request, response) => {
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];

  try {
    const userId = getUserId(request);
    const channelId = readRequiredText(request.body.channelId, 'INVALID_CHANNEL_ID', 'Channel id is invalid');
    if (!isValidObjectId(channelId)) throw new AppError(400, 'INVALID_CHANNEL_ID', 'Channel id is invalid');

    const reason = readReason(request.body.reason);
    const description = readDescription(request.body.description);

    const channel = await Channel.findOne({ _id: channelId, isActive: true });
    if (!channel) throw new AppError(404, 'CHANNEL_NOT_FOUND', 'Channel was not found');

    // MongoDB stores only the URL references; the image bytes stay in uploads/reports.
    const evidenceUrls = files.map((file) => `/uploads/reports/${file.filename}`);

    const report = await Report.create({ userId, channelId, reason, description, evidenceUrls });

    response.status(201).json({ report });
  } catch (error) {
    await removeFiles(files.map((file) => file.path));
    throw error;
  }
};

export const listReports: RequestHandler = async (request, response) => {
  // TODO v4.5 6:
  // Completa el método de Mongoose utilizado para consultar los Reports del usuario.
  // Objetivo: recuperar los reportes existentes del usuario autenticado.
  // Resultado esperado: GET /api/reports devolverá los Reports ordenados por fecha.
  const reports = await Report.find({ userId: getUserId(request) })
    .populate('channelId', 'name')
    .sort('-createdAt');

  response.json({ reports });
};

export const updateReport: RequestHandler = async (request, response) => {
  const userId = getUserId(request);
  const reportId = readReportId(request.params.id);
  const { reason, description, status } = request.body ?? {};

  const changes: Record<string, string> = {};
  if (reason !== undefined) changes.reason = readReason(reason);
  if (description !== undefined) changes.description = readDescription(description);
  if (status !== undefined) {
    if (!reportStatuses.includes(status)) throw new AppError(400, 'INVALID_REPORT_STATUS', 'Report status is invalid');
    changes.status = status;
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'EMPTY_REPORT_UPDATE', 'Provide reason, description or status to update');
  }

  // Filtering by userId as well as _id prevents editing someone else's report.
  const report = await Report.findOneAndUpdate(
    { _id: reportId, userId },
    changes,
    { new: true, runValidators: true }
  );
  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');

  response.json({ report });
};

export const deleteReport: RequestHandler = async (request, response) => {
  const report = await Report.findOneAndDelete({
    _id: readReportId(request.params.id),
    userId: getUserId(request)
  });
  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');

  // Deleting the document does not delete the files, so clean up the disk as well.
  await removeFiles(evidencePaths(report.evidenceUrls));

  response.status(204).end();
};
