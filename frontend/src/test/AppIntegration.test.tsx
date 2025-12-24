import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCandles } from '../api/candles'
import { getTDFI, getcRSI, getADXVMA } from '../api/indicators'

vi.mock('../api/candles')
vi.mock('../api/indicators', () => ({
    getTDFI: vi.fn(),
    getcRSI: vi.fn(),
    getADXVMA: vi.fn(),
}))

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn().mockReturnValue({
    addSeries: vi.fn().mockReturnValue({
      setData: vi.fn(),
      createPriceLine: vi.fn(),
      applyOptions: vi.fn(),
    }),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: vi.fn().mockReturnValue({
      fitContent: vi.fn(),
    }),
    priceScale: vi.fn().mockReturnValue({
      applyOptions: vi.fn(),
    }),
  }),
  ColorType: { Solid: 'solid' },
  LineSeries: 'LineSeries',
  CandlestickSeries: 'CandlestickSeries',
  HistogramSeries: 'HistogramSeries',
  LineStyle: {
    Solid: 0,
    Dashed: 1,
    Dotted: 2,
    LargeDashed: 3,
    SparseDotted: 4,
  },
}))

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getCandles).mockResolvedValue([]);
    vi.mocked(getTDFI).mockResolvedValue({ timestamps: ['2023-10-27T00:00:00'], tdfi: [0.1], tdfi_signal: [0], metadata: { display_type: 'pane', color_mode: 'single', color_schemes: { line: '#fff' }, series_metadata: [{ field: 'tdfi', role: 'main', label: 'TDFI', line_color: '#fff', line_style: 'solid', line_width: 2 }] } });
    vi.mocked(getcRSI).mockResolvedValue({ timestamps: [], crsi: [], upper_band: [], lower_band: [], metadata: { display_type: 'pane', color_mode: 'single', color_schemes: { line: '#fff' }, series_metadata: [{ field: 'crsi', role: 'main', label: 'cRSI', line_color: '#fff', line_style: 'solid', line_width: 2 }] } });
    vi.mocked(getADXVMA).mockResolvedValue({ timestamps: [], adxvma: [], metadata: { display_type: 'overlay', color_mode: 'single', color_schemes: { line: '#fff' }, series_metadata: [{ field: 'adxvma', role: 'main', label: 'ADXVMA', line_color: '#fff', line_style: 'solid', line_width: 2 }] } });
  });

  it('successfully saves a new layout via the toolbar', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Open the layouts dropdown from the toolbar
    const layoutButton = await screen.findByRole('button', { name: /Default Layout/i });
    await user.click(layoutButton);

    // Find the input field, type a new layout name, and save
    const layoutNameInput = await screen.findByPlaceholderText('New layout name');
    await user.type(layoutNameInput, 'My New Layout');

    const saveButton = await screen.findByRole('button', { name: /Save Layout/i });
    await user.click(saveButton);

    // The button in the toolbar should now show the new layout name
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /My New Layout/i })).toBeDefined();
    }, { timeout: 3000 });
  });

  it('toggles an indicator and sees the change', async () => {
    const user = userEvent.setup();
    render(<App />);
    
    // Open indicator search
    const indicatorsButton = screen.getByRole('button', { name: /Indicators/i });
    await user.click(indicatorsButton);

    // Select TDFI
    const tdfiItem = await screen.findByText('TDFI');
    await user.click(tdfiItem);

    // Indicator pane should now be visible
    expect(await screen.findByText(/TDFI/)).toBeDefined();
    expect(screen.getByTestId('indicator-pane-TDFI')).toBeDefined()
  });
});