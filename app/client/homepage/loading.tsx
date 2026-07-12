import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6 p-6 lg:p-8" aria-label="Loading client homepage">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border border-border/60 shadow-sm lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
