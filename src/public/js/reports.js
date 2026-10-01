const reportsList = document.querySelector('#reports-list');
const reportsStatus = document.querySelector('#reports-status');
const reportFormSection = document.querySelector('#report-form-section');
const reportForm = document.querySelector('#report-form');
const reportFormStatus = document.querySelector('#report-form-status');
const channelId = new URLSearchParams(location.search).get('channelId');

async function loadUser() {
  const response = await fetch('/api/users/me');
  if (!response.ok) { location.href = '/login'; return false; }
  const user = await response.json();
  document.querySelector('#welcome').textContent = `Welcome, ${user.email}`;
  return true;
}

function formatReason(reason) {
  return reason.toLowerCase().split('_').map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ');
}

const reasons = ['STREAM_DOES_NOT_LOAD', 'WRONG_CHANNEL', 'AUDIO_PROBLEM', 'VIDEO_PROBLEM', 'OTHER'];
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

function createSelect(values, selected, format) {
  const select = document.createElement('select');
  for (const value of values) {
    const option = new Option(format(value), value, false, value === selected);
    select.append(option);
  }
  return select;
}

function createActions(report, item) {
  const actions = document.createElement('div');
  actions.className = 'report-actions';
  const edit = Object.assign(document.createElement('button'), { type: 'button', className: 'report-button', textContent: 'Edit' });
  const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'report-button', textContent: 'Delete' });
  edit.addEventListener('click', () => item.replaceWith(createEditForm(report)));
  remove.addEventListener('click', () => deleteReport(report._id));
  actions.append(edit, remove);
  return actions;
}

function createEditForm(report) {
  const form = document.createElement('form');
  form.className = 'report-item report-edit';
  const reason = createSelect(reasons, report.reason, formatReason);
  const description = Object.assign(document.createElement('textarea'), { value: report.description, maxLength: 1000, required: true });
  const status = createSelect(statuses, report.status, formatReason);
  const save = Object.assign(document.createElement('button'), { type: 'submit', className: 'report-button', textContent: 'Save' });
  const cancel = Object.assign(document.createElement('button'), { type: 'button', className: 'report-button', textContent: 'Cancel' });
  cancel.addEventListener('click', () => loadReports());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await updateReport(report._id, { reason: reason.value, description: description.value, status: status.value });
  });
  form.append(reason, description, status, save, cancel);
  return form;
}

async function updateReport(reportId, changes) {
  const response = await fetch(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportsStatus.textContent = payload.error?.message || 'Could not update the report.';
    return;
  }
  await loadReports();
}

async function deleteReport(reportId) {
  if (!confirm('Delete this report and its evidence?')) return;
  const response = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
  if (!response.ok) { reportsStatus.textContent = 'Could not delete the report.'; return; }
  await loadReports();
}

function createReportItem(report) {
  const item = document.createElement('article');
  item.className = 'report-item';
  const channel = document.createElement('h3');
  channel.textContent = report.channelId?.name || 'Channel unavailable';
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${formatReason(report.reason)}`;
  const description = document.createElement('p');
  description.textContent = report.description;
  const status = document.createElement('p');
  status.className = 'report-status';
  status.textContent = report.status;
  const created = document.createElement('p');
  created.className = 'report-date';
  created.textContent = new Date(report.createdAt).toLocaleString();
  item.append(channel, reason, description, status, created);
  report.evidenceUrls.forEach((url, index) => {
    const evidence = document.createElement('a');
    evidence.href = url;
    evidence.target = '_blank';
    evidence.rel = 'noopener';
    evidence.textContent = report.evidenceUrls.length > 1 ? `View evidence image ${index + 1}` : 'View evidence image';
    item.append(evidence, ' ');
  });
  item.append(createActions(report, item));
  return item;
}

async function loadReports() {
  const response = await fetch('/api/reports');
  if (!response.ok) { reportsStatus.textContent = 'Could not load reports.'; return; }
  const { reports } = await response.json();
  reportsStatus.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}`;
  if (reports.length === 0) {
    reportsList.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'You have not reported a channel yet.' }));
    return;
  }
  reportsList.replaceChildren(...reports.map(createReportItem));
}

async function submitReport(event) {
  event.preventDefault();
  const formData = new FormData();
  formData.append('channelId', channelId);
  formData.append('reason', document.querySelector('#report-reason').value);
  formData.append('description', document.querySelector('#report-description').value);
  const evidenceFiles = document.querySelector('#report-evidence').files;
  // The field name must match upload.array('evidence', 5) on the Route.
  for (const file of evidenceFiles) {
    formData.append('evidence', file);
  }

  reportFormStatus.textContent = 'Submitting report…';
  const response = await fetch('/api/reports', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    reportFormStatus.textContent = payload.error?.message || 'Could not submit the report.';
    return;
  }

  reportForm.reset();
  reportFormStatus.textContent = 'Report saved.';
  await loadReports();
}

function configureReportForm() {
  if (!channelId) return;
  reportFormSection.hidden = false;
  document.querySelector('#report-channel-id').value = channelId;
  document.querySelector('#report-channel').textContent = 'Report the selected channel.';
  reportForm.addEventListener('submit', submitReport);
}

document.querySelector('#logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login'; });
async function start() { if (await loadUser()) { configureReportForm(); await loadReports(); } }
start();
