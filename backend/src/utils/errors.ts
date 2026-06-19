export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  console.error(err);
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A record with this value already exists.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found.' });
    }
    return res.status(400).json({ error: 'Database error.' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? err.message : 'Internal server error.' });
};
