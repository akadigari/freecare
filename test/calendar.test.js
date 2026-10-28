import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineCalendar, CALENDAR_FILE } from '../src/calendar.js';

test('the reminder is a valid all-day event on the deadline with a week of warning', () => {
  const ics = deadlineCalendar('2027-04-29', 'en');
  const lines = ics.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.includes('BEGIN:VEVENT'));
  assert.ok(lines.includes('DTSTART;VALUE=DATE:20270429'));
  assert.ok(lines.includes('DTEND;VALUE=DATE:20270430'));
  assert.ok(lines.includes('SUMMARY:Last day to apply for hospital financial assistance'));
  assert.ok(lines.includes('BEGIN:VALARM'));
  assert.ok(lines.includes('TRIGGER:-P7D'));
  assert.ok(lines.some((line) => line.startsWith('UID:')));
  assert.ok(lines.some((line) => line.startsWith('DTSTAMP:')));
  assert.ok(lines.some((line) => line.startsWith('DESCRIPTION:') && line.includes('240 days')));
  assert.ok(!ics.includes('\n\n'), 'CRLF only');
  for (const line of lines) assert.ok(line.length <= 75, `line too long: ${line}`);
  assert.equal(CALENDAR_FILE, 'freecare-deadline.ics');
});

test('the reminder reads in Spanish', () => {
  const ics = deadlineCalendar('2027-04-29', 'es');
  assert.ok(ics.includes('SUMMARY:Último día para solicitar asistencia financiera del hospital'));
});

test('a bad date is refused instead of making a broken file', () => {
  assert.throws(() => deadlineCalendar('tomorrow', 'en'), /date/);
});
