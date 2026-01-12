import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UseApiRequestOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  retryCount?: number;
  retryDelay?: number;
  preventDuplicates?: boolean;
}

interface UseApiRequestReturn<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useApiRequest<T, Args extends unknown[] = []>(
  requestFn: (...args: Args) => Promise<T>,
  options: UseApiRequestOptions<T> = {}
): UseApiRequestReturn<T, Args> {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage = "An error occurred. Please try again.",
    retryCount = 0,
    retryDelay = 1000,
    preventDuplicates = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isExecutingRef = useRef(false);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Prevent duplicate submissions
      if (preventDuplicates && isExecutingRef.current) {
        console.log("Request already in progress, skipping duplicate");
        return null;
      }

      isExecutingRef.current = true;
      setIsLoading(true);
      setError(null);

      let lastError: Error | null = null;
      let attempts = 0;

      while (attempts <= retryCount) {
        try {
          const result = await requestFn(...args);
          
          if (successMessage) {
            toast.success(successMessage);
          }
          
          onSuccess?.(result);
          setIsLoading(false);
          isExecutingRef.current = false;
          return result;
          
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          attempts++;
          
          if (attempts <= retryCount) {
            console.log(`Request failed, retrying (${attempts}/${retryCount})...`);
            await sleep(retryDelay * attempts); // Exponential backoff
          }
        }
      }

      // All retries exhausted
      setError(lastError);
      toast.error(lastError?.message || errorMessage);
      onError?.(lastError!);
      setIsLoading(false);
      isExecutingRef.current = false;
      return null;
    },
    [requestFn, onSuccess, onError, successMessage, errorMessage, retryCount, retryDelay, preventDuplicates]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    isExecutingRef.current = false;
  }, []);

  return { execute, isLoading, error, reset };
}
