function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reportToCsv(report = {}) {
  const rows = [['Section', 'Metric', 'Value']];
  Object.entries(report.summary || {}).forEach(([metric, value]) => rows.push(['Summary', metric, value]));
  (report.users_by_role || []).forEach((item) => rows.push(['Users by role', item.label, item.value]));
  (report.subscriptions_by_status || []).forEach((item) => rows.push(['Subscriptions', item.label, item.value]));
  (report.payments_by_status || []).forEach((item) => {
    rows.push(['Payments', `${item.label} count`, item.value]);
    rows.push(['Payments', `${item.label} amount cents`, item.amount_cents]);
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
