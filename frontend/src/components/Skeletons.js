/**
 * Loading placeholders tuned to this app's dark surfaces.
 *
 * These exist mainly to avoid flashing a *wrong* empty state — without them a
 * page briefly claims "No posts here" or "Not connected" before its data has
 * even arrived.
 */

export const Skeleton = ({ className = "", ...props }) => (
  <div aria-hidden className={`animate-pulse rounded bg-white/[0.07] ${className}`} {...props} />
);

const Shell = ({ children, testid }) => (
  <div data-testid={testid} aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading…</span>
    {children}
  </div>
);

/** Grid of stat tiles (Dashboard). */
export const StatsSkeleton = ({ count = 6 }) => (
  <Shell testid="skeleton-stats">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-l border-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
          </div>
          <Skeleton className="mt-4 h-7 w-14" />
        </div>
      ))}
    </div>
  </Shell>
);

/** Stacked list rows (recent posts, history). */
export const ListSkeleton = ({ rows = 4, testid = "skeleton-list" }) => (
  <Shell testid={testid}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-b-0">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className={`h-3 ${["w-2/5", "w-1/2", "w-1/3", "w-3/5"][i % 4]}`} />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
        <div className="hidden sm:flex gap-1.5">
          {Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-3.5 w-3.5 rounded-sm" />)}
        </div>
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>
    ))}
  </Shell>
);

/** Connection cards. */
export const ConnectionsSkeleton = ({ count = 6 }) => (
  <Shell testid="skeleton-connections">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  </Shell>
);

/** KPI tiles + the two chart panels (Analytics). */
export const AnalyticsSkeleton = () => (
  <Shell testid="skeleton-analytics">
    <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-white/5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3.5 w-3.5 rounded-sm" />
          </div>
          <Skeleton className="mt-4 h-7 w-20" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-white/10 bg-[#0A0A0B] p-6">
          <Skeleton className="h-3 w-32 mb-6" />
          <div className="h-[260px] flex items-end gap-2">
            {[45, 70, 35, 85, 55, 75, 40, 65, 50, 80].map((h, j) => (
              <Skeleton key={j} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </Shell>
);

/** Month grid + queue column (Calendar). */
export const CalendarSkeleton = () => (
  <Shell testid="skeleton-calendar">
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      <div className="xl:col-span-3 border border-white/10 bg-[#0A0A0B]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <Skeleton className="h-3.5 w-28" />
          <div className="flex gap-2"><Skeleton className="w-8 h-8 rounded-md" /><Skeleton className="w-8 h-8 rounded-md" /></div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-white/5 p-px">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="bg-[#0A0A0B] min-h-[84px] p-2">
              <Skeleton className="h-2.5 w-4" />
            </div>
          ))}
        </div>
      </div>
      <div className="border border-white/10 bg-[#0A0A0B]">
        <div className="px-6 py-4 border-b border-white/10"><Skeleton className="h-3.5 w-24" /></div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/2" /></div>
          ))}
        </div>
      </div>
    </div>
  </Shell>
);
