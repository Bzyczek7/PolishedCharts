/**
 * NotificationHistory Component

Displays a history of sent notifications with filtering and pagination.

Features:
- Shows notification type (toast, sound, Telegram)
- Displays delivery status (sent, failed)
- Links to AlertTrigger for details
- Pagination with "load more" pattern

Usage:
    <NotificationHistory />

Feature: 013-alarm-notifications
*/

import React, { useState, useEffect, useCallback } from "react";
import { getNotificationHistory } from "@/api/notifications";
import type { NotificationDelivery, NotificationDeliveryListResponse } from "@/types/notification";

interface NotificationHistoryProps {
  limit?: number;
  onNotificationClick?: (notification: NotificationDelivery) => void;
}

const ITEMS_PER_PAGE = 50;

export function NotificationHistory({ limit = ITEMS_PER_PAGE, onNotificationClick }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "sent" | "failed">("all");

  const loadNotifications = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    const currentLimit = reset ? limit : ITEMS_PER_PAGE;

    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response: NotificationDeliveryListResponse = await getNotificationHistory(
        currentLimit,
        currentOffset
      );

      if (reset) {
        setNotifications(response.items);
      } else {
        setNotifications((prev) => [...prev, ...response.items]);
      }

      setTotal(response.total);
      setOffset(currentOffset + response.items.length);
      setHasMore(notifications.length + response.items.length < response.total);
    } catch (error) {
      console.error("Failed to load notification history:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit, offset, notifications.length]);

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const handleLoadMore = () => {
    loadNotifications(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      case "pending":
        return "text-yellow-400";
      default:
        return "text-slate-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return "✓";
      case "failed":
        return "✗";
      case "pending":
        return "⏳";
      default:
        return "?";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "toast":
        return "🔔";
      case "sound":
        return "🔊";
      case "telegram":
        return "✈️";
      default:
        return "📢";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    return n.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading notification history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Notification History</h3>
        <span className="text-sm text-slate-400">
          {total} notification{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "sent", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === f
                ? "bg-[#26a69a] text-white"
                : "bg-[#1e222d] text-slate-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No notifications found
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => onNotificationClick?.(notification)}
              className="flex items-start gap-3 p-3 bg-[#1e222d] rounded-lg hover:bg-[#2a2e39] transition-colors cursor-pointer"
            >
              {/* Type Icon */}
              <span className="text-xl flex-shrink-0" title={notification.notificationType}>
                {getTypeIcon(notification.notificationType)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white truncate">
                    {notification.alertName || notification.message || "Notification"}
                  </p>
                  <span className={`text-xs flex-shrink-0 ${getStatusColor(notification.status)}`}>
                    {getStatusIcon(notification.status)} {notification.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {notification.symbol && (
                    <span className="text-xs text-slate-400">{notification.symbol}</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {formatTimestamp(notification.triggeredAt)}
                  </span>
                </div>
                {notification.errorMessage && (
                  <p className="text-xs text-red-400 mt-1 truncate">
                    {notification.errorMessage}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : `Load more (${notifications.length} of ${total})`}
        </button>
      )}

      {!hasMore && notifications.length > 0 && (
        <p className="text-center text-xs text-slate-500 py-2">
          Showing all {total} notifications
        </p>
      )}
    </div>
  );
}

export default NotificationHistory;
