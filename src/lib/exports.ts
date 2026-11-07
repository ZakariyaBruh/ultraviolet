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
