import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCodes } from "../constants/errors.js";

/**
 * Translates low-level Postgres errors into clear human language.
 */
function humanizeDatabaseError(err: any): { message: string; statusCode: number; code: string } | null {
  if (!err) return null;

  // Postgres Error Codes
  // 23502 = not_null_violation
  if (err.code === "23502") {
    const col = err.column ? err.column.replace(/_/g, " ") : "a required field";
    return {
      statusCode: 400,
      code: ErrorCodes.VALIDATION_ERROR,
      message: `Please provide a value for ${col}. It cannot be empty.`,
    };
  }

  // 23505 = unique_violation
  if (err.code === "23505") {
    let detail = err.detail || "";
    const match = detail.match(/Key \((.*?)\)=\((.*?)\) already exists/);
    if (match) {
      const field = match[1].replace(/_/g, " ");
      return {
        statusCode: 409,
        code: "CONFLICT",
        message: `An entry with this ${field} ("${match[2]}") already exists. Please choose a different one.`,
      };
    }
    return {
      statusCode: 409,
      code: "CONFLICT",
      message: "A record with this information already exists in the system.",
    };
  }

  // 23503 = foreign_key_violation
  if (err.code === "23503") {
    return {
      statusCode: 400,
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "The referenced lesson, module, or cohort could not be found or has been removed.",
    };
  }

  // 22P02 = invalid_text_representation (UUID mismatch, etc.)
  if (err.code === "22P02") {
    return {
      statusCode: 400,
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Invalid identifier or format provided. Please refresh the page and try again.",
    };
  }

  return null;
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Unhandled Error]:", err);

  // Check for Postgres database errors
  const dbError = humanizeDatabaseError(err);
  if (dbError) {
    res.status(dbError.statusCode).json({
      success: false,
      error: {
        code: dbError.code,
        message: dbError.message,
      },
    });
    return;
  }

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
  let message = err?.message || "An unexpected internal server error occurred. Please try again.";

  // Sanitize if error contains SQL or HTML tags
  if (typeof message === "string") {
    if (message.includes("violates not-null constraint")) {
      message = "A required field was missing. Please ensure all fields are filled out.";
    } else if (message.includes("<html") || message.includes("<!DOCTYPE") || message.includes("<pre>")) {
      message = "The requested server operation failed. Please try again.";
    }
  }

  res.status(err?.status || err?.statusCode || 500).json({
    success: false,
    error: {
      code: err?.code || ErrorCodes.INTERNAL_SERVER_ERROR,
      message,
    },
  });
}

