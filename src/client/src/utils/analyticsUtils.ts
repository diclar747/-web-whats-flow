/**
 * Analytics Utilities
 * Helper functions for analytics data processing and formatting
 */

import dayjs from 'dayjs';

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('es-PY').format(num);
}

/**
 * Format percentage
 */
export function formatPercentage(num: number): string {
    return `${num.toFixed(2)}%`;
}

/**
 * Calculate percentage safely
 */
export function calculatePercentage(numerator: number, denominator: number): number {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
}

/**
 * Get date range presets
 */
export function getDateRangePresets() {
    return {
        today: {
            label: 'Hoy',
            startDate: dayjs().format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        },
        yesterday: {
            label: 'Ayer',
            startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
            endDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
        },
        last7days: {
            label: 'Últimos 7 días',
            startDate: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        },
        last30days: {
            label: 'Últimos 30 días',
            startDate: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        },
        thisMonth: {
            label: 'Este mes',
            startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        },
        lastMonth: {
            label: 'Mes pasado',
            startDate: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
            endDate: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
        }
    };
}

/**
 * Format date for display
 */
export function formatDate(date: string): string {
    return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: string): string {
    return dayjs(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Get color for metric based on value
 */
export function getMetricColor(value: number, thresholds: { good: number; warning: number }): string {
    if (value >= thresholds.good) return '#4caf50'; // Green
    if (value >= thresholds.warning) return '#ff9800'; // Orange
    return '#f44336'; // Red
}

/**
 * Format chart data for Recharts
 */
export function formatChartData(data: any[], xKey: string, yKeys: string[]) {
    return data.map(item => {
        const formatted: any = { [xKey]: item[xKey] };
        yKeys.forEach(key => {
            formatted[key] = Number(item[key]) || 0;
        });
        return formatted;
    });
}

/**
 * Calculate trend (increase/decrease percentage)
 */
export function calculateTrend(current: number, previous: number): {
    value: number;
    isPositive: boolean;
    percentage: number;
} {
    const diff = current - previous;
    const percentage = previous > 0 ? (diff / previous) * 100 : 0;

    return {
        value: diff,
        isPositive: diff >= 0,
        percentage: Math.abs(percentage)
    };
}

/**
 * Export data to CSV
 */
export function exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Group data by date
 */
export function groupByDate(data: any[], dateKey: string): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    data.forEach(item => {
        const date = dayjs(item[dateKey]).format('YYYY-MM-DD');
        if (!grouped.has(date)) {
            grouped.set(date, []);
        }
        grouped.get(date)!.push(item);
    });

    return grouped;
}

/**
 * Fill missing dates in timeline data
 */
export function fillMissingDates(
    data: any[],
    startDate: string,
    endDate: string,
    dateKey: string = 'date'
): any[] {
    const result: any[] = [];
    const dataMap = new Map(data.map(item => [item[dateKey], item]));

    let currentDate = dayjs(startDate);
    const end = dayjs(endDate);

    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        const existingData = dataMap.get(dateStr);

        if (existingData) {
            result.push(existingData);
        } else {
            // Create empty data point
            result.push({
                [dateKey]: dateStr,
                total: 0,
                sent: 0,
                received: 0,
                failed: 0
            });
        }

        currentDate = currentDate.add(1, 'day');
    }

    return result;
}

/**
 * Calculate average from array of numbers
 */
export function calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return Math.round(sum / numbers.length);
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
        active: '#4caf50',
        running: '#2196f3',
        scheduled: '#ff9800',
        completed: '#9e9e9e',
        draft: '#757575',
        failed: '#f44336',
        pending: '#ffc107',
        online: '#4caf50',
        offline: '#9e9e9e',
        busy: '#ff9800',
        away: '#ffc107'
    };

    return colors[status.toLowerCase()] || '#9e9e9e';
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours < 24) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Aggregate data by period (day, week, month)
 */
export function aggregateByPeriod(
    data: any[],
    dateKey: string,
    period: 'day' | 'week' | 'month'
): any[] {
    const grouped = new Map<string, any[]>();

    data.forEach(item => {
        let key: string;
        const date = dayjs(item[dateKey]);

        switch (period) {
            case 'week':
                key = date.startOf('week').format('YYYY-MM-DD');
                break;
            case 'month':
                key = date.startOf('month').format('YYYY-MM-DD');
                break;
            default:
                key = date.format('YYYY-MM-DD');
        }

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(item);
    });

    return Array.from(grouped.entries()).map(([date, items]) => ({
        date,
        count: items.length,
        items
    }));
}
