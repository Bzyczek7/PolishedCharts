============================================================
COMPLETE INDICATOR LIST WITH DEFAULTS
Total: 189 indicators
============================================================

INDICATORS WITH MEANINGFUL DEFAULTS (shown in input fields):
============================================================

adx: length=14
adxvma: adxvma_period=15
apo: fast=12, slow=26
aroon: length=25
atr: length=14
bbands: length=20, lower_std=2.0, upper_std=2.0
cci: length=20
cmo: length=14
crsi: cyclicmemory=40, domcycle=20, leveling=11.0, vibration=14
dema: length=20
donchian: lower_length=20, upper_length=20
eri: length=13
hma: length=20
kama: fast=2, length=10, slow=30
kc: length=20, scalar=2
mama: fastlimit=0.5, slowlimit=0.05
macd: fast=12, signal=9, slow=26
mfi: length=14
mom: length=10
percent_rank: length=20
ppo: fast=12, slow=26
pvo: fast=12, signal=9, slow=26
roc: length=10
rsi: length=14
stoch: d=3, k=14, smooth_k=3
stochrsi: d=3, k=3, length=14, rsi_length=14
t3: a=0.7, length=5
tdfi: filter_high=0.05, filter_low=-0.05, lookback=13
tema: length=20
tsi: fast=13, signal=13, slow=25
uo: fast=7, medium=14, slow=28
vwma: length=20
willr: length=14
wma: length=20
zscore: length=20, std=2.0

INDICATORS WITH NO PARAMETERS NEEDED (no input fields):
============================================================

accbands, ad, adosc, alligator, alphatrend, ao, aobv, atrts, bias, bop, brar,
cdl_doji, cdl_inside, cdl_z, cfo, cg, chandelier_exit, chop, cksp, cmf,
consecutive_streak, coppock, cti, cube, decreasing, df_dates, df_month_to_date,
df_quarter_to_date, df_year_to_date, dm, drawdown, ebsw, efi, entropy, eom, er,
erf, exhc, final_time, fwma, geometric_mean, ha, high_low_range, hpoly,
ht_trendline, hwc, hwma, increasing, jma, kst, kurtosis, kvo, linreg,
log_geometric_mean, log_return, long_run, ma, mad, massi, mcgd, median, midpoint,
midprice, ms2secs, mtd, natr, nb_ffill, nb_idiff, nb_nonzero_range, nb_rolling,
non_zero_range, nvi, obv, pd_rma, pdist, percent_return, pgo, psl, pvi, pvol, pvr,
pvt, pwma, qqe, qstick, qtd, quantile, real_body, recent_maximum_index,
recent_minimum_index, reflex, remap, rma, rsx, rvgi, rvi, rwi, short_run, signals,
signed_series, sinwma, skew, slope, sma, smc, smi, smma, squeeze, squeeze_pro,
ssf, ssf3, stc, stdev, stochf, strided_window, supertrend, swma, tal_ma, thermo,
tmo, to_utc, tos_stdevall, trendflex, trima, trix, tsignals, tsv, ttm_trend, ui,
unix_convert, unsigned_differences, v_ascending, v_dataframe, v_datetime_ordered,
v_drift, v_mamode, v_null, v_offset, v_percent, v_str, v_talib, v_tradingview,
variance, vhf, vhm, vidya, vortex, vp, vwap, weights, ytd, zero, zlma

============================================================
NOTES:
- Default values are standard trading defaults (TradingView compatible)
- RSI uses length=14 (most common)
- MACD uses 12/26/9 (standard)
- BBANDS uses 20 periods with 2 standard deviations
- KAMA uses 10/2/30 (Kaufman's original recommendation)
- MAMA uses 0.5/0.05 (Fractal Adaptive MA limits)
============================================================
