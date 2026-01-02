/**
 * LoadingIndicator Component
 * Feature: 012-performance-optimization
 * User Story 5 - Overall Application Responsiveness
 *
 * Provides visual feedback within 200ms for long-running operations
 * to ensure the application feels responsive during all interactions.
 *
 * Success Criteria:
 * - SC-007: UI feedback <= 200ms
 * - FR-013: Loading state for long operations (> 200ms)
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading indicator state managed globally
 */
interface LoadingState {
  isLoading: boolean;
  message?: string;
  startTime?: number;
}

/**
 * Props for LoadingIndicator component
 */
export interface LoadingIndicatorProps {
  /** Minimum duration in ms before showing loading indicator (default: 200ms) */
  delay?: number;
  /** Custom loading message */
  message?: string;
}

/**
 * Global loading state (singleton pattern)
 * Components can import setLoadingState to trigger the indicator
 */
let globalLoadingState: LoadingState = { isLoading: false };
const listeners = new Set<(state: LoadingState) => void>();

/**
 * Set the global loading state
 * @param isLoading - Whether loading is active
 * @param message - Optional loading message
 */
export function setLoadingState(isLoading: boolean, message?: string): void {
  globalLoadingState = {
    isLoading,
    message,
    startTime: isLoading ? Date.now() : undefined
  };
  // Notify all listeners
  listeners.forEach(listener => listener(globalLoadingState));
}

/**
 * Subscribe to loading state changes
 * @param listener - Callback function when state changes
 * @returns Unsubscribe function
 */
export function subscribeToLoadingState(
  listener: (state: LoadingState) => void
): () => void {
  listeners.add(listener);
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current loading state (synchronous)
 */
export function getLoadingState(): LoadingState {
  return globalLoadingState;
}

/**
 * LoadingIndicator Component
 *
 * Displays a centered loading spinner with message.
 * Only shows after the specified delay to avoid flickering for fast operations.
 *
 * @example
 * ```tsx
 * // Show loading for a specific operation
 * setLoadingState(true, 'Loading chart data...');
 * // ... perform operation ...
 * setLoadingState(false);
 * ```
 */
export function LoadingIndicator({ delay = 200, message }: LoadingIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string | undefined>();

  useEffect(() => {
    // Subscribe to global loading state changes
    const unsubscribe = subscribeToLoadingState((state) => {
      if (state.isLoading) {
        // Loading started - show indicator after delay
        const timer = setTimeout(() => {
          setVisible(true);
          setCurrentMessage(state.message || 'Loading...');
        }, delay);

        // Clear timer if loading finishes before delay
        return () => clearTimeout(timer);
      } else {
        // Loading finished - hide immediately
        setVisible(false);
        setCurrentMessage(undefined);
      }
    });

    return unsubscribe;
  }, [delay]);

  // Override with prop message if provided
  const displayMessage = message !== undefined ? message : currentMessage;

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-card p-6 shadow-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {displayMessage && (
          <p className="text-sm text-muted-foreground">{displayMessage}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to manage loading state for a specific operation
 * Automatically handles cleanup on unmount
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { setLoading, isLoading } = useLoadingState();
 *
 *   const handleClick = async () => {
 *     const stopLoading = setLoading(true, 'Processing...');
 *     try {
 *       await someAsyncOperation();
 *     } finally {
 *       stopLoading();
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */
export function useLoadingState() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLoadingState((state) => {
      setIsLoading(state.isLoading);
    });

    return unsubscribe;
  }, []);

  /**
   * Set loading state
   * @param loading - Whether loading is active
   * @param message - Optional loading message
   * @returns Function to stop loading
   */
  const setLoading = (loading: boolean, message?: string) => {
    setLoadingState(loading, message);
    // Return a function to stop loading
    if (loading) {
      return () => setLoadingState(false);
    }
    return () => {};
  };

  return {
    isLoading,
    setLoading,
    setLoadingState,
  };
}

/**
 * Higher-order component to add loading state to a button
 *
 * @example
 * ```tsx
 * const SubmitButton = withLoadingState(
 *   ({ onClick, isLoading, children, ...props }) => (
 *     <Button onClick={onClick} disabled={isLoading} {...props}>
 *       {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
 *       {children}
 *     </Button>
 *   )
 * );
 *
 * // Usage
 * <SubmitButton onClick={async () => await submitForm()}>
 *   Submit
 * </SubmitButton>
 * ```
 */
export function withLoadingState<P extends { onClick?: (...args: any[]) => any }>(
  Component: React.ComponentType<P & { isLoading?: boolean }>
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    const { isLoading } = useLoadingState();

    const handleClick = async (...args: any[]) => {
      if (props.onClick) {
        setLoadingState(true);
        try {
          await props.onClick(...args);
        } finally {
          setLoadingState(false);
        }
      }
    };

    return <Component {...props} onClick={handleClick} isLoading={isLoading} />;
  };
}

export default LoadingIndicator;
