import { sessionsCsv, sessionsIcs } from './review'
import { useStore } from './store'

/** hand a file built in the browser to the person: nothing is sent anywhere */
export function download(name: string, mime: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const downloadCsv = () => download('friction-sessions.csv', 'text/csv', sessionsCsv(useStore.getState().sessions))
export const downloadIcs = () => download('friction-sessions.ics', 'text/calendar', sessionsIcs(useStore.getState().sessions))

/** A calendar event that repeats every day with an alert, so the phone's own calendar does the calling back. Floating local time. */
export function reminderIcs(hhmm: string): string {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm) ? hhmm : '09:00').split(':')
  const d = new Date()
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Friction//Reminder//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:friction-daily-${h}${m}@frictionx.app`, `DTSTAMP:${day}T000000Z`,
    `DTSTART:${day}T${h}${m}00`, 'DURATION:PT10M',
    'RRULE:FREQ=DAILY', 'SUMMARY:Lock in', 'DESCRIPTION:Ten minutes keeps the run going. https://www.frictionx.app/focus',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Lock in', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}
export const downloadReminder = (hhmm: string) => download('friction-daily.ics', 'text/calendar', reminderIcs(hhmm))
