export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string) => new AppError(400, msg);
export const unauthorized = (msg = "Please sign in to continue.") => new AppError(401, msg);
export const forbidden = (msg: string) => new AppError(403, msg);
export const notFound = (msg = "Document not found.") => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);
