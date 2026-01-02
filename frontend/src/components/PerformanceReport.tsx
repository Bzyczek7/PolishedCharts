/**
 * PerformanceReport Component
 *
 * Feature: 012-performance-optimization
 * Displays performance monitoring data and bottleneck analysis
 */

import { useState, useEffect } from 'react';
import { performanceStore } from '../lib/performanceStore';
import type {
  PerformanceReport,
  Bottleneck,
  OperationRanking,
  CategoryStats,
} from '../types/performance';
import { formatDuration, formatBytes, checkSuccessCriteria } from '../lib/performance';
import { DEFAULT_THRESHOLDS } from '../types/performance';

interface PerformanceReportProps {
  /** Whether to show the report in development mode */
  showInDev?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Format a stats row for display
 */
function StatsRow({ label, stats }: { label: string; stats: CategoryStats }) {
  return (
    <div className="stats-row">
      <span className="stats-label">{label}</span>
      <span className="stats-values">
        <span title="Average">{stats.average_duration_ms.toFixed(0)}ms avg</span>
        <span title="95th percentile" className="p95">{stats.p95_duration_ms.toFixed(0)}ms p95</span>
        <span title="Count">{stats.operation_count} ops</span>
      </span>
    </div>
  );
}

/**
 * Display a single bottleneck
 */
function BottleneckItem({ bottleneck }: { bottleneck: Bottleneck }) {
  const impactColor = bottleneck.impact === 'critical' ? '#ef5350' : bottleneck.impact === 'high' ? '#ff9800' : '#ffeb3b';

  return (
    <div className="bottleneck-item" style={{ borderLeftColor: impactColor }}>
      <div className="bottleneck-header">
        <span className="bottleneck-operation">{bottleneck.operation}</span>
        <span className="bottleneck-impact" style={{ color: impactColor }}>
          {bottleneck.impact.toUpperCase()}
        </span>
      </div>
      <div className="bottleneck-details">
        <span>{bottleneck.total_duration_ms.toFixed(0)}ms total</span>
        <span>{bottleneck.percent_of_total.toFixed(1)}% of load time</span>
        <span className="bottleneck-reason">{bottleneck.reason.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

/**
 * Display a single operation ranking
 */
function RankingItem({ ranking, index }: { ranking: OperationRanking; index: number }) {
  return (
    <div className="ranking-item">
      <span className="ranking-position">#{index + 1}</span>
      <span className="ranking-operation">{ranking.operation}</span>
      <span className="ranking-stats">
        <span>{ranking.total_duration_ms.toFixed(0)}ms</span>
        <span>{ranking.count}x</span>
        <span>{ranking.percent_of_total_load_time.toFixed(1)}%</span>
      </span>
    </div>
  );
}

/**
 * Performance report component
 */
export function PerformanceReport({ showInDev = true, className = '' }: PerformanceReportProps) {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Only show in development mode if showInDev is true
  const shouldShow = import.meta.env.DEF && showInDev;

  const generateReport = () => {
    setIsGenerating(true);
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const newReport = performanceStore.generateReport(DEFAULT_THRESHOLDS);
      setReport(newReport);
      setIsGenerating(false);
      setIsOpen(true);
    }, 0);
  };

  const clearLogs = () => {
    performanceStore.clear();
    setReport(null);
  };

  const downloadReport = () => {
    if (!report) return;

    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`performance-report-container ${className}`}>
      <button
        className="performance-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Hide Performance Report' : 'Show Performance Report'}
      >
        📊
      </button>

      {isOpen && (
        <div className="performance-report-panel">
          <div className="performance-report-header">
            <h2>Performance Report</h2>
            <div className="performance-report-actions">
              <button onClick={generateReport} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </button>
              {report && (
                <>
                  <button onClick={downloadReport}>Download</button>
                  <button onClick={clearLogs}>Clear Logs</button>
                </>
              )}
              <button onClick={() => setIsOpen(false)}>Close</button>
            </div>
          </div>

          {report && (
            <div className="performance-report-content">
              {/* Summary */}
              <div className="performance-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Operations</span>
                  <span className="summary-value">{report.total_operations}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Time Range</span>
                  <span className="summary-value">
                    {formatDuration(report.end_time.getTime() - report.start_time.getTime())}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Generated</span>
                  <span className="summary-value">
                    {report.generated_at.toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Bottlenecks */}
              {report.bottlenecks.length > 0 && (
                <div className="performance-section">
                  <h3>Top {report.bottlenecks.length} Bottlenecks</h3>
                  <div className="bottlenecks-list">
                    {report.bottlenecks.map((bottleneck, index) => (
                      <BottleneckItem key={`${bottleneck.operation}-${index}`} bottleneck={bottleneck} />
                    ))}
                  </div>
                </div>
              )}

              {/* Rankings */}
              {report.rankings.length > 0 && (
                <div className="performance-section">
                  <h3>Operation Rankings (by total time)</h3>
                  <div className="rankings-list">
                    {report.rankings.slice(0, 10).map((ranking, index) => (
                      <RankingItem key={`${ranking.operation}-${index}`} ranking={ranking} index={index} />
                    ))}
                  </div>
                </div>
              )}

              {/* Category Stats */}
              <div className="performance-section">
                <h3>Category Statistics</h3>
                <div className="category-stats">
                  <StatsRow label="Data Fetch" stats={report.by_category.data_fetch} />
                  <StatsRow label="Calculation" stats={report.by_category.calculation} />
                  <StatsRow label="Rendering" stats={report.by_category.rendering} />
                  <StatsRow label="UI Interaction" stats={report.by_category.ui_interaction} />
                </div>
              </div>

              {/* Success Criteria */}
              <div className="performance-section">
                <h3>Success Criteria Check</h3>
                {(() => {
                  const results = checkSuccessCriteria(report, DEFAULT_THRESHOLDS);
                  return (
                    <div className="success-criteria">
                      {results.met.length > 0 && (
                        <div className="criteria-met">
                          <h4>✓ Met ({results.met.length})</h4>
                          <ul>
                            {results.met.map((criterion, i) => (
                              <li key={i}>{criterion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {results.not_met.length > 0 && (
                        <div className="criteria-not-met">
                          <h4>✗ Not Met ({results.not_met.length})</h4>
                          <ul>
                            {results.not_met.map((criterion, i) => (
                              <li key={i}>{criterion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {results.warnings.length > 0 && (
                        <div className="criteria-warnings">
                          <h4>⚠ Warnings ({results.warnings.length})</h4>
                          <ul>
                            {results.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {!report && (
            <div className="performance-report-empty">
              <p>No report generated yet. Click "Generate Report" to analyze performance.</p>
              <p className="hint">Perform some operations (load symbols, add indicators) first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inline styles (to be moved to CSS module in production)
 */
const styles = `
.performance-report-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.performance-toggle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #2196F3;
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.performance-toggle:hover {
  transform: scale(1.1);
}

.performance-report-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 20px;
}

.performance-report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.performance-report-actions {
  display: flex;
  gap: 10px;
}

.performance-report-actions button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.performance-report-actions button:hover {
  background: #f5f5f5;
}

.performance-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-label {
  font-size: 12px;
  color: #666;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
}

.performance-section {
  margin-bottom: 25px;
}

.performance-section h3 {
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
}

.bottlenecks-list,
.rankings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bottleneck-item {
  padding: 12px;
  border-left: 4px solid #ff9800;
  background: #fff8e1;
  border-radius: 4px;
}

.bottleneck-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.bottleneck-operation {
  font-weight: 600;
}

.bottleneck-impact {
  font-size: 12px;
  font-weight: 600;
}

.bottleneck-details {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: #666;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.ranking-position {
  font-weight: 600;
  margin-right: 10px;
  min-width: 30px;
}

.ranking-operation {
  flex: 1;
  font-weight: 500;
}

.ranking-stats {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: #666;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.stats-label {
  font-weight: 500;
}

.stats-values {
  display: flex;
  gap: 15px;
  font-size: 14px;
}

.stats-values .p95 {
  color: #2196F3;
  font-weight: 600;
}

.success-criteria {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.criteria-met {
  padding: 10px;
  background: #e8f5e9;
  border-radius: 4px;
}

.criteria-met h4 {
  color: #4CAF50;
  margin-bottom: 8px;
}

.criteria-not-met {
  padding: 10px;
  background: #ffebee;
  border-radius: 4px;
}

.criteria-not-met h4 {
  color: #f44336;
  margin-bottom: 8px;
}

.criteria-warnings {
  padding: 10px;
  background: #fff8e1;
  border-radius: 4px;
}

.criteria-warnings h4 {
  color: #ff9800;
  margin-bottom: 8px;
}

.performance-report-empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.performance-report-empty .hint {
  font-size: 14px;
  color: #999;
  margin-top: 10px;
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('performance-report-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'performance-report-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

export default PerformanceReport;
