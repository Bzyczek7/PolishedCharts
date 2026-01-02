# Quickstart Guide: Indicator-based Alerts (cRSI)

**Feature**: 001-indicator-alerts
**Last Updated**: 2025-12-26

## Overview

This guide shows how to create and manage TradingView-style alerts for the cRSI (cyclic smoothed RSI) indicator. Alerts are created directly from the indicator UI, not from the Monitoring panel.

## Prerequisites

- cRSI indicator added to your chart
- Backend connection available (alert creation requires server connectivity)

---

## Creating a cRSI Alert

### Step 1: Open the cRSI Context Menu

1. Hover over the cRSI oscillator pane on your chart
2. A context menu will appear after a brief delay
3. Look for the option: **"Add alert on cRSI(20)..."** (the number in parentheses shows the current period setting)

### Step 2: Configure Alert Settings

The "Edit/Create Alert" modal opens with three tabs:

#### Settings Tab

- **Enable upper band cross**: Check to trigger when cRSI crosses above the upper band
- **Enable lower band cross**: Check to trigger when cRSI crosses below the lower band
- **Cooldown**: Set the minimum time between triggers (minimum 5 seconds, default 60 seconds)

> **Tip**: You can enable both conditions, or just one. For example, enable only "lower band cross" if you only want buy signals.

#### Message Tab

- **Upper band message**: Custom message when upper band is crossed (default: "It's time to sell!")
- **Lower band message**: Custom message when lower band is crossed (default: "It's time to buy!")

> **Tip**: Use descriptive messages like "AAPL overbought - consider taking profits" or "TSLA oversold - buying opportunity"

#### Notifications Tab (Placeholder)

- This tab shows a placeholder for future notification features
- No configuration needed for now

### Step 3: Save the Alert

Click **Save** to create the alert. The modal closes and the alert appears in the Monitoring panel's Alerts list.

---

## Viewing Trigger History

### Per-Alert History

1. Open the **Monitoring** panel
2. Find your cRSI alert in the Alerts list
3. Click the **expand/collapse** arrow next to the alert
4. View all trigger events with:
   - Timestamp
   - Observed price
   - cRSI indicator value
   - Trigger message ("It's time to buy!" or "It's time to sell!")

### Global Log

1. Open the **Monitoring** panel
2. Switch to the **Log** tab
3. See all trigger events from all alerts in reverse chronological order (newest first)
4. Each entry shows:
   - Timestamp
   - Symbol
   - Alert name
   - Trigger message
   - (Optional) Price and indicator value

---

## Managing Alerts

### Mute an Alert

1. Open the **Monitoring** panel
2. Find the alert in the Alerts list
3. Click the **Mute** button (or right-click and select "Mute")
4. Alert status changes to "muted" and stops triggering

> **Use case**: Temporarily disable an alert without deleting it

### Unmute an Alert

1. Open the **Monitoring** panel
2. Find the muted alert
3. Click the **Unmute** button (or right-click and select "Unmute")
4. Alert status changes to "active" and resumes triggering

### Delete an Alert

1. Open the **Monitoring** panel
2. Find the alert in the Alerts list
3. Right-click and select **Delete**
4. Confirm deletion
5. Alert and all its trigger history are permanently removed

> **Warning**: Deleting an alert removes all its trigger history. This cannot be undone.

### Edit an Alert

1. Right-click on the cRSI oscillator pane
2. Select **"Edit alert on cRSI(20)..."** (shows for existing alerts)
3. The modal opens with current settings pre-filled
4. Make your changes
5. Click **Save** to update the existing alert (no duplicate created)

---

## Alert Behavior

### Trigger Detection

Alerts trigger when the cRSI value **crosses** a band (not just touches it):

| Condition | Triggers When... | Example |
|-----------|------------------|---------|
| Upper band cross | Previous value ≤ upper AND current value > upper | cRSI goes from 68 to 75 (upper band = 70) |
| Lower band cross | Previous value ≥ lower AND current value < lower | cRSI goes from 32 to 25 (lower band = 30) |

### Cooldown Period

After any trigger, a cooldown period prevents rapid re-triggering:

- **Minimum**: 5 seconds (enforced by backend)
- **Default**: 60 seconds
- **Configurable**: Set in Settings tab when creating/editing alert

During cooldown, the alert won't create triggers for **any** enabled condition.

### Multiple Triggers

If both upper and lower band conditions are met within a single candle update:

- **Both** triggers are created as separate AlertTrigger records
- Each has its own message (buy vs sell)
- Cooldown applies after both are created

---

## Example Workflows

### Workflow 1: Buy/Sell Signals with cRSI

**Goal**: Get buy signals when cRSI is oversold, sell signals when overbought

1. Create cRSI alert from indicator context menu
2. **Settings tab**: Enable both upper and lower band crosses
3. **Message tab**:
   - Upper: "It's time to sell! RSI overbought"
   - Lower: "It's time to buy! RSI oversold"
4. Set cooldown to 300 seconds (5 minutes) to avoid frequent signals
5. Save

**Result**: Alert creates "buy" triggers when cRSI drops below lower band, "sell" triggers when cRSI rises above upper band.

### Workflow 2: Only Buy Signals

**Goal**: Only get buy signals, ignore sell signals

1. Create cRSI alert from indicator context menu
2. **Settings tab**: Enable **only** lower band cross (uncheck upper)
3. **Message tab**: Set lower band message to "Buying opportunity!"
4. Set cooldown to 60 seconds
5. Save

**Result**: Alert only triggers when cRSI crosses below lower band. Upper band crosses are ignored.

### Workflow 3: Multiple Symbols

**Goal**: Track cRSI signals for multiple stocks

1. Switch chart to symbol "AAPL"
2. Create cRSI alert for AAPL
3. Switch chart to symbol "TSLA"
4. Create cRSI alert for TSLA
5. Open **Monitoring** panel → **Log** tab
6. See all buy/sell signals for both symbols in one place

---

## Troubleshooting

### Alert Not Triggering

**Possible causes**:
1. Alert is muted → Check alert status in Monitoring panel
2. Cooldown active → Wait for cooldown period to expire
3. Condition not met → Verify cRSI values on chart
4. Backend disconnected → Check connection status

### Can't Create Alert

**Possible causes**:
1. Backend not available → Wait for connection or check server status
2. Missing required fields → Ensure at least one condition is enabled
3. Invalid indicator parameters → Verify cRSI settings are valid

### No Triggers in Log

**Possible causes**:
1. No alerts have triggered yet → Wait for market conditions to meet alert criteria
2. Triggers too old → Log shows recent 500 triggers by default
3. Filter active → Check if symbol filter is applied

---

## Keyboard Shortcuts (Future Enhancement)

Keyboard shortcuts are not yet implemented but planned for future:
- `Alt+A`: Open alert modal from focused indicator
- `Alt+M`: Mute/unmute selected alert
- `Delete`: Delete selected alert

---

## FAQ

**Q: Can I create alerts from the Monitoring panel?**

A: No. As of this feature, alerts are only created from the indicator context menu. The Monitoring panel is for managing (mute/unmute/delete) and viewing history.

**Q: What happens if I change cRSI parameters on the chart?**

A: Existing alerts keep their original parameters. If you create an alert for cRSI(20) and then change the chart to cRSI(14), the alert continues evaluating using cRSI(20) values. To change parameters, delete the old alert and create a new one.

**Q: Do alerts work offline?**

A: Alert **creation** requires backend connectivity. However, trigger **history** can be viewed offline (cached in browser). When offline, you'll see "Backend unavailable - alerts in read-only mode" if you try to create an alert.

**Q: How long is trigger history kept?**

A: Trigger history is kept for the lifetime of the alert. When you delete an alert, all its trigger history is also deleted.

**Q: Can I export my trigger history?**

A: Export is not yet implemented. You can view history in the Log tab, but copying/exporting is a future enhancement.

**Q: What's the maximum number of alerts I can create?**

A: There's no application-level hard cap. You're limited only by system resources (CPU, memory, storage) and provider rate limits.

---

## Next Steps

- Learn about [advanced indicator alerts](../README.md) (future features)
- Configure [notification delivery](../README.md) (email, webhook - coming soon)
- Explore [alert analytics](../README.md) (trigger statistics, performance - planned)

## Implementation Walkthrough

### Backend Architecture

The indicator-based alert system is implemented with:

1. **Database Schema Extensions**:
   - Added `message_upper`, `message_lower`, and `enabled_conditions` fields to the `Alert` model
   - Added `trigger_message` and `trigger_type` fields to the `AlertTrigger` model
   - Added computed `alert_label` property for human-readable display

2. **Alert Engine Logic**:
   - Implemented cRSI band cross detection using current + previous values
   - Added support for multi-trigger scenarios (both upper and lower bands crossed)
   - Implemented cooldown logic to prevent rapid re-triggering
   - Added mute functionality to pause alert evaluation

3. **API Endpoints**:
   - Extended `/api/v1/alerts/` with message and condition fields
   - Added `/api/v1/alerts/triggers/recent` for global trigger log
   - Added support for symbol string filtering in addition to symbol_id

### Frontend Components

1. **IndicatorAlertModal**:
   - Tabbed interface for Settings, Message, and Notifications
   - Dynamic condition selection based on indicator type
   - Form validation for required fields
   - Loading states and error handling

2. **LogTab Component**:
   - Displays global trigger history in reverse chronological order
   - Auto-refresh every 30 seconds
   - Manual refresh button
   - Symbol filtering capability

3. **Indicator Context Menu**:
   - Right-click access to alert creation from indicator panes
   - "Edit alert..." option for existing alerts
   - TradingView-style compact header with action icons

### Key Features Implemented

- **Direction-Specific Messages**: Each trigger event stores the specific message used
- **Configurable Conditions**: Users can enable/disable upper/lower band conditions independently
- **Cooldown Protection**: Minimum 5-second cooldown prevents rapid signal oscillations
- **Global Log View**: Single view for all trigger events across all alerts
- **Edit Functionality**: Modify existing alerts from indicator context menu
- **Mute/Unmute**: Pause alert evaluation without deleting alerts
- **Performance Optimized**: Batch evaluation for high alert volumes
