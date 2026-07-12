import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8" aria-label="Loading project">
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border border-border/60 shadow-sm"><CardContent className="space-y-2 p-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-24" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
