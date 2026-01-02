/**
 * SourceCodeModal component - Modal for displaying indicator source code
 * Feature: 008-overlay-indicator-rendering
 * Phase 8: User Story 6 - View Indicator Source Code (Priority: P4)
 *
 * T041: Create SourceCodeModal component with read-only display and placeholder
 * T042: Add basic syntax highlighting for Pine Script (regex-based)
 * T043: Add copy to clipboard button
 */

import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../lib/utils';

/**
 * Props for SourceCodeModal component
 */
export interface SourceCodeModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback: Modal open state changed */
  onOpenChange: (open: boolean) => void;
  /** Indicator name for title */
  indicatorName: string;
  /** Source code content (or null if not available) */
  sourceCode: string | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * T042: Basic Pine Script syntax highlighting
 * Applies CSS classes to tokenized code for syntax highlighting
 */
function highlightPineScript(code: string): string {
  if (!code) return '';

  // Escape HTML first
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply syntax highlighting using regex
  // Comments (// ...)
  highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-slate-500 italic">$1</span>');

  // Keywords (study, indicator, plot, etc.)
  const keywords = [
    'study', 'indicator', 'strategy',
    'plot', 'plotshape', 'plotchar', 'plotarrow', 'plotbarcolor', 'plotcandle',
    'if', 'else', 'for', 'to', 'while', 'switch', 'case',
    'var', 'input', 'ta\\.', 'math\\.',
  ];
  const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  highlighted = highlighted.replace(keywordPattern, '<span class="text-purple-400">$1</span>');

  // Functions (sma, ema, rsi, etc.)
  const functions = [
    'sma', 'ema', 'rsi', 'macd', 'bb', 'atr', 'volume',
    'highest', 'lowest', 'max', 'min', 'abs', 'sqrt', 'log', 'exp',
    'round', 'floor', 'ceil', 'sign',
  ];
  const functionPattern = new RegExp(`\\b(${functions.join('|')})\\b`, 'gi');
  highlighted = highlighted.replace(functionPattern, '<span class="text-blue-400">$1</span>');

  // Numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');

  // Strings
  highlighted = highlighted.replace(/(".*?"|'.*?')/g, '<span class="text-green-400">$1</span>');

  // Built-in constants
  const constants = ['true', 'false', 'na', 'close', 'open', 'high', 'low', 'volume'];
  const constantPattern = new RegExp(`\\b(${constants.join('|')})\\b`, 'gi');
  highlighted = highlighted.replace(constantPattern, '<span class="text-yellow-400">$1</span>');

  return highlighted;
}

/**
 * SourceCodeModal component
 * T041: Modal with read-only source code display
 * T042: Pine Script syntax highlighting
 * T043: Copy to clipboard button
 *
 * Displays indicator source code in a modal dialog with:
 * - Read-only code display with syntax highlighting
 * - Copy to clipboard button
 * - Fallback placeholder message when source code is not available
 */
export function SourceCodeModal({
  open,
  onOpenChange,
  indicatorName,
  sourceCode,
  className,
}: SourceCodeModalProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  // T043: Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!sourceCode) return;

    try {
      await navigator.clipboard.writeText(sourceCode);
      setCopySuccess(true);

      // Reset success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy source code:', err);
    }
  }, [sourceCode]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2',
            'bg-slate-900 border border-slate-700 rounded-lg shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-slate-100">
                {indicatorName} - Source Code
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-400 mt-1">
                View and copy the Pine Script source code for this indicator
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-2">
              {/* T043: Copy button */}
              {sourceCode && (
                <button
                  onClick={handleCopy}
                  className="p-2 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                  title={copySuccess ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copySuccess ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              )}
              <DialogPrimitive.Close className="p-2 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {sourceCode ? (
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightPineScript(sourceCode),
                  }}
                />
              </pre>
            ) : (
              <div className="py-8 text-center text-slate-500">
                <p className="text-sm">
                  Source code is not available for this indicator.
                </p>
                <p className="text-xs mt-2">
                  This indicator is computed server-side. Pine Script source code will be displayed here when available.
                </p>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default SourceCodeModal;
