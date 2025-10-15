// Discriminated union types for type-safe API responses
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Helper to create success responses
export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

// Helper to create error responses
export function error(code: string, message: string): ApiError {
  return { success: false, error: { code, message } };
}
