import { Star } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden
          bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-12
          text-white lg:flex xl:p-16"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-black/20 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20">
            <span className="text-sm font-bold tracking-tight">LS</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Legacy Scale
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Build your 7-figure agency.
          </h1>
          <p className="text-xl text-white/75">
            The all-in-one platform for agency owners to learn, scale, and
            systemize their delivery.
          </p>
          <div className="flex gap-8 pt-1">
            <Stat value="1,200+" label="Active members" />
            <Stat value="61%" label="Avg. completion" />
            <Stat
              value={
                <span className="inline-flex items-center gap-1">
                  4.9
                  <Star className="size-5 fill-white text-white" />
                </span>
              }
              label="Member rating"
            />
          </div>
        </div>

        <figure className="relative max-w-md rounded-2xl bg-white/10 p-5 ring-1 ring-inset ring-white/15 backdrop-blur">
          <blockquote className="text-[15px] font-medium leading-relaxed">
            &ldquo;Legacy Scale gave me the exact system to go from $4k to
            $42k/mo in under a year. The playbooks are unreal.&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-inset ring-white/20">
              SR
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Sofia Reyes</div>
              <div className="text-xs text-white/60">Founder, Reyes Media</div>
            </div>
          </figcaption>
        </figure>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

function Stat({
  value,
  label,
}: {
  value: React.ReactNode
  label: string
}) {
  return (
    <div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-white/60">{label}</div>
    </div>
  )
}
