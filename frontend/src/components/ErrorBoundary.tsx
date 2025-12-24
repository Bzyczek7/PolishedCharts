/**
 * ErrorBoundary Component
 *
 * Feature: 004-candle-data-refresh
 * Purpose: T066 - Error boundary for candle data fetch failures
 *
 * Catches JavaScript errors in child component trees and displays a fallback UI.
 */
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches errors in its child component tree.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<ErrorDisplay />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-full w-full bg-slate-900 p-8">
          <div className="text-center space-y-4">
            <div className="text-rose-500 text-4xl">⚠️</div>
            <h3 className="text-lg font-semibold text-slate-200">Something went wrong</h3>
            <p className="text-sm text-slate-400 max-w-md">
              {this.state.error?.message || 'An error occurred while loading chart data'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
