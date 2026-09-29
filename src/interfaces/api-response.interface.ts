export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}
