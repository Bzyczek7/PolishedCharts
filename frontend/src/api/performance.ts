/**
 * Performance API Client
 *
 * Feature: 012-performance-optimization
 * Client for backend performance monitoring endpoints
 */

import { createAuthenticatedAxios } from '@/services/authService';
import type {
  PerformanceLog,
  PerformanceReport,
  ThresholdConfig,
} from '../types/performance';

/**
 * Get performance logs from backend
 */
export async function getPerformanceLogs(params?: {
  category?: string;
  operation?: string;
  start?: Date;
  end?: Date;
  limit?: number;
}): Promise<{ logs: PerformanceLog[]; total: number }> {
  const client = await createAuthenticatedAxios();

  const queryParams: Record<string, string | number> = {};
  if (params?.category) queryParams.category = params.category;
  if (params?.operation) queryParams.operation = params.operation;
  if (params?.start) queryParams.start = params.start.toISOString();
  if (params?.end) queryParams.end = params.end.toISOString();
  if (params?.limit) queryParams.limit = params.limit;

  const response = await client.get('/performance/logs', { params: queryParams });
  return response.data;
}

/**
 * Clear performance logs from backend
 */
export async function clearPerformanceLogs(): Promise<void> {
  const client = await createAuthenticatedAxios();
  await client.delete('/performance/logs');
}

/**
 * Generate a performance report from backend logs
 */
export async function generatePerformanceReport(request?: {
  start?: Date;
  end?: Date;
  thresholds?: ThresholdConfig;
}): Promise<PerformanceReport> {
  const client = await createAuthenticatedAxios();

  const response = await client.post('/performance/report', request || {});
  return response.data;
}

/**
 * Export performance data
 */
export async function exportPerformanceData(params?: {
  format?: 'json' | 'csv';
  start?: Date;
  end?: Date;
}): Promise<Blob> {
  const client = await createAuthenticatedAxios();

  const queryParams: Record<string, string> = {};
  if (params?.format) queryParams.format = params.format;
  if (params?.start) queryParams.start = params.start.toISOString();
  if (params?.end) queryParams.end = params.end.toISOString();

  const response = await client.get('/performance/export', {
    params: queryParams,
    responseType: 'blob',
  });

  return response.data;
}
