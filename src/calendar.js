// A calendar reminder for the application deadline, made on the device. Standard iCalendar
// text, so it opens in Apple Calendar, Google Calendar and Outlook.

export const CALENDAR_FILE = 'freecare-deadline.ics';

const TEXT = Object.freeze({
  en: Object.freeze({
    summary: 'Last day to apply for hospital financial assistance',
    description: 'Maryland law gives you 240 days from your first hospital bill to apply for free or reduced-cost care (Health-General 19-214.1). Send the statewide application to the hospital. Reminder made by freecare.',
  }),
  es: Object.freeze({
    summary: 'Último día para solicitar asistencia financiera del hospital',
    description: 'La ley de Maryland le da 240 días desde su primera factura del hospital para solicitar atención gratis o a costo reducido (Health-General 19-214.1). Envíe la solicitud estatal al hospital. Recordatorio hecho por freecare.',
  }),
});

// Commas, semicolons and backslashes have meaning in iCalendar text, so they are escaped.
function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// Lines longer than 75 characters are folded onto a new line that starts with a space.
function fold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

function nextDay(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const compact = (iso) => iso.replace(/-/g, '');

export function deadlineCalendar(deadlineIso, lang = 'en', now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadlineIso))) throw new RangeError('The deadline must be a date like 2027-04-29.');
  const T = TEXT[lang] ?? TEXT.en;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//freecare//Maryland hospital bill checker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:deadline-${compact(deadlineIso)}@freecare`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(deadlineIso)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(deadlineIso))}`,
    `SUMMARY:${escapeText(T.summary)}`,
    `DESCRIPTION:${escapeText(T.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(T.summary)}`,
    'TRIGGER:-P7D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n');
}
