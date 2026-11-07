import { Check, Copy, CloudUpload } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Panel } from '@/components/app/shared'
import { fx_say } from '@/lib/actions'
import { BACKUP_KEY_LENGTH, backupNow, deleteBackup, enableBackup, replaceBackup, restoreBackup, showKey, takeNewerBackup, useBackup, validKey } from '@/lib/backup'
import { canon } from '@/lib/transfer'

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`
}
const btn = 'inline-flex h-11 items-center justify-center gap-2 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10 disabled:opacity-50'

/** Supporters: an encrypted copy of everything in this browser, kept on the server so it survives a lost phone or a cleared browser. */
export function BackupPanel() {
  const b = useBackup()
  const [fresh, setFresh] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const [sure, setSure] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t) }, [])
  const key = fresh ?? (show ? b.state?.code ?? null : null)
  const copy = async (k: string) => { try { await navigator.clipboard.writeText(showKey(k)); fx_say({ title: 'Backup key copied', description: 'Keep it somewhere safe, apart from this device.' }) } catch { fx_say({ title: 'Copy it by hand', description: showKey(k) }) } }
  const on = async () => { try { setFresh(await enableBackup()) } catch { /* the error is shown below */ } }
  const stop = async () => { setSure(false); setShow(false); setFresh(null); const ok = await deleteBackup(); fx_say({ title: ok ? 'Backup deleted' : 'Backup will be deleted', description: ok ? 'The copy on the server is gone and the key is forgotten here.' : 'You are offline, so it is removed the next time the app can reach the server.', variant: ok ? 'success' : undefined }) }

  return (
    <Panel className="grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud">Cloud backup · supporter</p>
        {b.state && !b.conflict && <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2"><i className="size-2 rounded-full bg-ok" aria-hidden />{b.busy ? 'Saving…' : `Saved ${ago(b.state.at)}`}</span>}
      </div>

      {!b.state ? (
        <>
          <p className="max-w-prose text-[13px] leading-[1.45] text-ink-2">Keep an encrypted copy of everything Friction holds in this browser, so a lost phone or a cleared browser costs you a minute and not your history. It is sealed here with a key only you have: the server stores it but cannot read it. It saves itself every few minutes while Friction is open.</p>
          <div><button className="inline-flex h-11 items-center gap-2 bg-signal px-5 text-sm font-semibold text-on-signal disabled:opacity-60" onClick={on} disabled={b.busy}><CloudUpload className="size-4" />{b.busy ? 'Sealing and saving…' : 'Turn on cloud backup'}</button></div>
        </>
      ) : (
        <>
          {b.conflict && (
            <div role="alert" className="grid gap-2 border border-signal bg-signal/10 p-3">
              <p className="text-[13px] leading-[1.45] text-ink">Another device saved a newer copy, so nothing was overwritten. Choose which to keep.</p>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => void takeNewerBackup().catch((e) => fx_say({ title: (e as Error).message, variant: 'danger' }))}>Use the newer copy (replaces this device)</button>
                <button className={btn} onClick={() => void replaceBackup()}>Keep this device (replaces the copy)</button>
              </div>
            </div>
          )}
          {key && (
            <div className="grid gap-1.5 border border-signal bg-signal/10 p-3 text-center" role="status">
              <span className="hud text-signal">{fresh ? 'Your backup key. Write it down now.' : 'Your backup key'}</span>
              <span className="fig select-all text-[clamp(1.1rem,3.4vw,1.5rem)] font-bold tracking-[0.1em]">{showKey(key)}</span>
              <span className="text-[13px] leading-[1.4] text-ink-2">It is the only way to open the backup, on this device or a new one. Nobody can reset it, including us.</span>
              <div className="flex justify-center gap-2">
                <button className={btn} onClick={() => void copy(key)}><Copy className="size-4" />Copy key</button>
                {fresh && <button className={btn} onClick={() => setFresh(null)}><Check className="size-4" />I have saved it</button>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => void backupNow(true).then((r) => { if (r === 'saved') fx_say({ title: 'Backed up', variant: 'success' }) })} disabled={b.busy}>Save now</button>
            {!fresh && <button className={btn} onClick={() => setShow(!show)}>{show ? 'Hide key' : 'Show my key'}</button>}
            {sure ? (
              <>
                <button className="inline-flex h-11 items-center border border-danger px-4 text-sm font-semibold text-danger hover:bg-danger/10" onClick={() => void stop()}>Yes, delete the backup</button>
                <button className={btn} onClick={() => setSure(false)}>Keep it</button>
              </>
            ) : <button className={btn} onClick={() => setSure(true)}>Turn off and delete</button>}
          </div>
          <p className="text-[13px] leading-[1.4] text-ink-3">To restore on another device, type the key in under Bring data here. Erase everything also deletes the copy.</p>
        </>
      )}
      {b.error && <p role="alert" className="text-[13px] leading-[1.4] text-danger">{b.error}</p>}
    </Panel>
  )
}

/** Type in a backup key, from anywhere, and take the data it holds. Reloads when it works. */
export function RestoreBackup() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const c = canon(text).slice(0, BACKUP_KEY_LENGTH)
  const go = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try { await restoreBackup(text); setOk(true) } catch (x) { setErr((x as Error).message); setBusy(false) }
  }
  return (
    <form onSubmit={go} className="grid gap-1.5">
      <label className="hud" htmlFor="backup-key">Backup key</label>
      <input id="backup-key" value={showKey(c)} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-invalid={!!err} className="h-11 w-full border border-ink/30 bg-transparent px-3 text-[15px] tracking-[0.06em] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal" />
      <button type="submit" disabled={busy || !validKey(c)} className="h-11 border border-ink/30 px-4 text-sm text-ink hover:bg-ink/10 disabled:opacity-40">{ok ? 'Done, opening…' : busy ? 'Opening the backup…' : 'Restore from backup'}</button>
      {err && <p role="alert" className="text-[13px] leading-[1.4] text-danger">{err}</p>}
    </form>
  )
}
