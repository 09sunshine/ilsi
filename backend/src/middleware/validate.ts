import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { AppError, ErrorCodes } from "../constants/errors.js";

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validateRequest(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        // Build a readable human-language error summary
        const summary = error.errors
          .map((e) => {
            const field = e.path.length > 0 ? e.path[e.path.length - 1] : "Field";
            const fieldName = String(field)
              .replace(/([A-Z])/g, " $1")
              .replace(/_/g, " ")
              .trim();
            const capitalized = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
            return `${capitalized}: ${e.message}`;
          })
          .slice(0, 3)
          .join(". ");

        next(new AppError(400, ErrorCodes.VALIDATION_ERROR, summary || "Please check your form inputs and try again.", details));
      } else {
        next(error);
      }
    }
  };
}
