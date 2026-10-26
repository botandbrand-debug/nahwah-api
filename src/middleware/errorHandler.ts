import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../shared/errors/AppError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known operational error (thrown deliberately by our code)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // MongoDB duplicate key (unique index violation)
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    res.status(409).json({
      error: { code: 'DUPLICATE_KEY', message: `A record with this ${field} already exists` },
    });
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: first?.message ?? 'Invalid input' },
    });
    return;
  }

  // Mongoose cast error (e.g. malformed ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: { code: 'INVALID_ID', message: `Invalid ${err.path}` },
    });
    return;
  }

  // Anything else — unexpected, log full stack, hide details from client
  console.error('[unhandled error]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.nodeEnv === 'production' ? 'Something went wrong' : String(err),
    },
  });
}