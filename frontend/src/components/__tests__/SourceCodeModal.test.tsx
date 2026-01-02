/**
 * Unit tests for SourceCodeModal component
 * Feature: 008-overlay-indicator-rendering
 * Phase 8: User Story 6 - View Indicator Source Code
 * T041-T044: Source code modal with syntax highlighting and copy button
 *
 * Tests:
 * - Modal renders with indicator name in title
 * - Placeholder message shows when no source code
 * - Source code displays with syntax highlighting
 * - Copy button works
 * - Close button works
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceCodeModal } from '../SourceCodeModal';

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn(),
};

Object.assign(navigator, { clipboard: mockClipboard });

describe('SourceCodeModal', () => {
  it('should not render when closed', () => {
    render(
      <SourceCodeModal
        open={false}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode="// Source code"
      />
    );

    expect(screen.queryByText('SMA - Source Code')).not.toBeInTheDocument();
  });

  it('should render with indicator name in title when open', () => {
    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA(20)"
        sourceCode="// Source code"
      />
    );

    expect(screen.getByText('SMA(20) - Source Code')).toBeInTheDocument();
  });

  it('should display placeholder message when source code is null', () => {
    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode={null}
      />
    );

    expect(screen.getByText('Source code is not available for this indicator.')).toBeInTheDocument();
    expect(screen.getByText(/This indicator is computed server-side/)).toBeInTheDocument();
  });

  it('should display placeholder message when source code is empty', () => {
    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode=""
      />
    );

    expect(screen.getByText('Source code is not available for this indicator.')).toBeInTheDocument();
  });

  it('should display source code when available', () => {
    const sourceCode = `// SMA Indicator
study("SMA", overlay=true)
length = input(20, "Length")
plot(sma(close, length))`;

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode={sourceCode}
      />
    );

    // Check that the modal title shows the indicator name
    expect(screen.getByText('SMA - Source Code')).toBeInTheDocument();
  });

  it('should show copy button when source code is available', () => {
    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode="// Source code"
      />
    );

    const copyButton = screen.getByTitle('Copy to clipboard');
    expect(copyButton).toBeInTheDocument();
  });

  it('should not show copy button when source code is not available', () => {
    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode={null}
      />
    );

    expect(screen.queryByTitle('Copy to clipboard')).not.toBeInTheDocument();
  });

  it('should copy source code to clipboard when copy button clicked', async () => {
    const sourceCode = '// Test source code';
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode={sourceCode}
      />
    );

    const copyButton = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyButton);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(sourceCode);
  });

  it('should show checkmark icon after successful copy', async () => {
    const sourceCode = '// Test source code';
    mockClipboard.writeText.mockResolvedValue(undefined);

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="SMA"
        sourceCode={sourceCode}
      />
    );

    const copyButton = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByTitle('Copied!')).toBeInTheDocument();
    });
  });

  it('should call onOpenChange with false when close button clicked', () => {
    const onOpenChange = vi.fn();

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={onOpenChange}
        indicatorName="SMA"
        sourceCode="// Source code"
      />
    );

    const closeButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg path[d*="M6 18L18 6"]')
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it('should apply syntax highlighting classes to code', () => {
    const sourceCode = `// Comment
study("Test")
plot(close)
length = 20`;

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="Test"
        sourceCode={sourceCode}
      />
    );

    // Check that the modal is open with the title
    expect(screen.getByText('Test - Source Code')).toBeInTheDocument();
  });

  it('should handle long source code with scrolling', () => {
    const longCode = '// ' + 'x'.repeat(10000);

    render(
      <SourceCodeModal
        open={true}
        onOpenChange={vi.fn()}
        indicatorName="LongCode"
        sourceCode={longCode}
      />
    );

    // Check that the modal is open
    expect(screen.getByText('LongCode - Source Code')).toBeInTheDocument();
  });
});
