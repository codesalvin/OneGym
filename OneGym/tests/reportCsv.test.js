import test from 'node:test';
import assert from 'node:assert/strict';
import { reportToCsv } from '../src/utils/reportCsv.js';

test('reportToCsv exports report sections and values', () => {
  const csv = reportToCsv({
    summary: { total_classes: 3 },
    users_by_role: [{ label: 'member', value: 4 }],
    subscriptions_by_status: [{ label: 'active', value: 2 }],
    payments_by_status: [{ label: 'paid', value: 2, amount_cents: 5000 }],
  });
  assert.match(csv, /Summary,total_classes,3/);
  assert.match(csv, /Users by role,member,4/);
  assert.match(csv, /Payments,paid amount cents,5000/);
});

test('reportToCsv safely quotes commas and quotes', () => {
  const csv = reportToCsv({ users_by_role: [{ label: 'member, "trial"', value: 1 }] });
  assert.match(csv, /"member, ""trial"""/);
});
