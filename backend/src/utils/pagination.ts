export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const getPaginationParams = (query: Record<string, any>): PaginationParams => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const getPaginationResult = (total: number, params: PaginationParams): PaginationResult => ({
  page: params.page,
  limit: params.limit,
  total,
  totalPages: Math.ceil(total / params.limit),
});
