// Generate dynamic colors using HSL (unlimited colors)
function generateDynamicColors(count, opacity = 0.85) {
    const colors = [];
    const hueStep = 360 / count;
    
    for (let i = 0; i < count; i++) {
        const hue = (i * hueStep) % 360;
        const saturation = 70; // Keep consistent saturation
        const lightness = 50;  // Keep consistent brightness
        colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`);
    }
    return colors;
}

// Aggregated data for large datasets
function aggregateData(rawData, groupBy = 'day') {
    const grouped = {};
    
    rawData.forEach(item => {
        const date = new Date(item.date);
        let key;
        
        if (groupBy === 'hour') {
            key = date.toISOString().slice(0, 13); // Hour
        } else if (groupBy === 'day') {
            key = date.toISOString().slice(0, 10); // Day
        } else if (groupBy === 'week') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().slice(0, 10);
        }
        
        if (!grouped[key]) {
            grouped[key] = { sum: 0, count: 0, items: [] };
        }
        grouped[key].sum += item.value || 0;
        grouped[key].count += 1;
        grouped[key].items.push(item);
    });
    
    return Object.entries(grouped).map(([date, data]) => ({
        date,
        value: data.sum,
        count: data.count,
        average: data.sum / data.count,
    }));
}

// Limit data to top N items
function getTopN(data, key, limit = 10) {
    return data
        .sort((a, b) => b[key] - a[key])
        .slice(0, limit);
}

// Large dataset chart options
const largeDatasetChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 150, // Reduced from 900ms for snappier response
        easing: 'easeOutQuart',
    },
    plugins: {
        legend: { display: true, position: 'right' },
        decimation: {
            enabled: true,
            algorithm: 'lttb', // Largest-Triangle-Three-Buckets
            samples: 50, // Keep 50 representative points from 1000+
        }
    },
    parsing: false,
    normalized: true,
};
