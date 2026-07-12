export type SearchQueryParams = {
    limit: number,
    page: number,
    search: string | undefined,
    sort: 'asc' | 'desc',
    sortBy: string | undefined
}