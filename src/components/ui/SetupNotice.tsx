import { Ornament } from './Ornament'

/** Shown only when the build was made without the Supabase environment variables. */
export function SetupNotice() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center">
        <p className="font-serif text-4xl italic text-champagne">♡</p>
        <Ornament className="mt-6" />
        <h1 className="mt-6 text-3xl text-ink">Almost ready</h1>
        <p className="mt-4 text-ink-soft">
          This site hasn’t been connected to its database yet. Please check back soon.
        </p>
        <p className="mt-6 rounded-lg border border-dashed border-line bg-paper px-4 py-3 text-left text-sm text-muted">
          <strong className="text-ink-soft">For the site owner:</strong> set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          (in <code>.env.local</code> for local development, or as GitHub Actions secrets for deployment) and rebuild.
        </p>
      </div>
    </main>
  )
}
