import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCodes } from "../constants/errors.js";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Unhandled Error]:", err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle generic / unexpected error
  const message = err?.message || "An unexpected internal server error occurred";
  res.status(err?.status || err?.statusCode || 500).json({
    success: false,
    error: {
      code: err?.code || ErrorCodes.INTERNAL_SERVER_ERROR,
      message,
    },
  });
}
