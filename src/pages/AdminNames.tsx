import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Trash2, Tv } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { SavedText, useAutoSaved, VisibilityField } from '../components/admin/ShowerAdminBits'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { FilterTabs } from '../components/admin/FilterTabs'
import { useToast } from '../hooks/useToast'
import { deleteNameIdea, getNamesSettings, listNameIdeasAdmin, saveNamesSettings, setNameIdeaStatus, type AdminNameIdea } from '../services/showerService'
import { toFriendlyMessage } from '../utils/errors'
import { formatShortDate } from '../utils/formatting'

type Filter = 'all' | 'pending' | 'hidden'
const FOR_LABEL = { girl: 'Girl', boy: 'Boy', any: 'Either' } as const

/** Admin → Name Ideas: every name guests suggested — show, hide or remove them, and how it works. */
export default function AdminNames() {
  const toast = useToast()
  const settings = useAutoSaved(getNamesSettings, saveNamesSettings)
  const [list, setList] = useState<AdminNameIdea[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const reload = useCallback(async () => {
    try {
      setList(await listNameIdeasAdmin())
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }, [toast])

  useEffect(() => {
    document.title = 'Name Ideas · Baby shower admin'
    void reload()
  }, [reload])

  const act = (p: Promise<void>) =>
    void p.then(reload).catch((e) => toast.error(toFriendlyMessage(e)))

  const shown = (list ?? []).filter((i) => filter === 'all' || i.status === filter)
  const s = settings.value
  return (
    <>
      <PageHeader title="Name Ideas" description="Guests suggest names for the baby on the website. Show, hide or remove any idea." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <FilterTabs<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: list?.length },
              { value: 'pending', label: 'Waiting', count: list?.filter((i) => i.status === 'pending').length },
              { value: 'hidden', label: 'Hidden', count: list?.filter((i) => i.status === 'hidden').length },
            ]}
          />
          {!list ? (
            <Skeleton className="h-48" />
          ) : shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-paper px-5 py-10 text-center text-sm text-muted">No name ideas here yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
              {shown.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-xl text-ink">{i.suggestion}</span>
                      <Badge tone={i.forGender === 'girl' ? 'rose' : i.forGender === 'boy' ? 'ink' : 'gray'}>{FOR_LABEL[i.forGender]}</Badge>
                      {i.status === 'pending' && <Badge tone="gold">Waiting</Badge>}
                      {i.status === 'hidden' && <Badge tone="gray">Hidden</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {i.byName} · {formatShortDate(i.at)}
                      {i.note && <span className="block italic text-ink-soft">“{i.note}”</span>}
                    </p>
                  </div>
                  {i.status !== 'visible' ? (
                    <Button size="sm" variant="outline" icon={<Eye aria-hidden="true" className="size-4" />} onClick={() => act(setNameIdeaStatus(i.id, 'visible'))}>
                      Show
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<EyeOff aria-hidden="true" className="size-4" />} onClick={() => act(setNameIdeaStatus(i.id, 'hidden'))}>
                      Hide
                    </Button>
                  )}
                  <Button size="sm" variant="danger-quiet" aria-label={`Remove ${i.suggestion}`} icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => act(deleteNameIdea(i.id))} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-5 rounded-xl border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl text-ink">Settings</h2>
            <SavedText state={settings.state} />
          </div>
          {!s ? (
            <Skeleton className="h-48" />
          ) : (
            <>
              <VisibilityField label="Name ideas page" mode={s.mode} from={s.from} onChange={settings.update} />
              <fieldset className="space-y-2 text-sm">
                <legend className="mb-1 font-medium text-ink">When a guest suggests a name</legend>
                {(
                  [
                    ['instant', 'Show it straight away'],
                    ['approve', 'Wait for me to show it'],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-ink-soft">
                    <input type="radio" name="names-approval" className="accent-ink" checked={s.approval === v} onChange={() => settings.update({ approval: v })} />
                    {l}
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm text-ink-soft">
                Ideas per guest
                <input type="number" min={1} max={10} className="input-base mt-1.5 w-24" value={s.perGuest} onChange={(e) => settings.update({ perGuest: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              </label>
            </>
          )}
          <Link to="/show/names" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne px-5 text-sm text-ink transition hover:bg-champagne-light/40">
            <Tv aria-hidden="true" className="size-4 text-gold" /> Present on the big screen
          </Link>
        </aside>
      </div>
    </>
  )
}
