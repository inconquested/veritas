import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8" aria-label="Loading clients">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
