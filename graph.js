// Initialize the plasma concentration graph
let plasmaChart = null;

const CHART_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const Y_AXIS_LABEL = 'PUN (mg/dL)';
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
let yAxisLabelFontSize = 13; // px; rescaled by applyChartScale()

const horizontalYAxisLabelPlugin = {
    id: 'horizontalYAxisLabel',
    afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const yScale = scales.y;
        if (!chartArea || !yScale) return;
        ctx.save();
        ctx.font = `bold ${yAxisLabelFontSize}px ${CHART_FONT_FAMILY}`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(Y_AXIS_LABEL, yScale.left - 4, (chartArea.top + chartArea.bottom) / 2);
        ctx.restore();
    }
};

const TREATMENT_COLORS = [
    'rgb(255, 99, 132)',   // Prescription 1 - red
    'rgb(75, 192, 192)',   // Prescription 2 - teal
    'rgb(54, 162, 235)',   // Prescription 3 - blue
    'rgb(255, 159, 64)'    // Prescription 4 - orange
];
const TREATMENT_LABELS = [
    'Prescription 1',
    'Prescription 2',
    'Prescription 3',
    'Prescription 4'
];


function createCustomLegend() {
    const legendContainer = document.getElementById('customLegend');
    const toRgba = (rgb) => rgb.replace('rgb', 'rgba').replace(')', ', 0.5)');
    const datasets = [];
    for (let i = 0; i < 4; i++) {
        datasets.push({ label: TREATMENT_LABELS[i], color: TREATMENT_COLORS[i], dashed: false, index: i * 2 });
        datasets.push({ label: TREATMENT_LABELS[i] + ' Avg', color: toRgba(TREATMENT_COLORS[i]), dashed: true, index: i * 2 + 1 });
    }
    
    legendContainer.innerHTML = '';
    
    datasets.forEach(dataset => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.id = `legend-item-${dataset.index}`;
        // Slots start empty; updateLegendLabels reveals a slot once it holds a treatment
        legendItem.style.display = 'none';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.id = `legend-${dataset.index}`;
        checkbox.addEventListener('change', () => {
            if (plasmaChart) {
                const meta = plasmaChart.getDatasetMeta(dataset.index);
                meta.hidden = !checkbox.checked;
                plasmaChart.update();
            }
        });
        
        const colorBox = document.createElement('span');
        colorBox.className = dataset.dashed ? 'legend-color dashed' : 'legend-color';
        colorBox.style.backgroundColor = dataset.dashed ? 'transparent' : dataset.color;
        colorBox.style.color = dataset.color;
        
        const label = document.createElement('span');
        label.id = `legend-label-${dataset.index}`;
        label.textContent = dataset.label;

        legendItem.appendChild(checkbox);
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

// Renumber the legend to match the Numeric Results columns.
// Colors are pinned to a slot for the life of a run (see colorIndex in controller.js), but the
// table numbers by recency — newest is Prescription 1 — so a slot's *number* changes as history
// shifts. treatmentsData[slot].num carries the column that slot occupies; slots with no
// treatment are hidden rather than advertising a run that isn't there.
function updateLegendLabels(treatmentsData) {
    for (let i = 0; i < 4; i++) {
        const treatment = treatmentsData[i];
        const hasData = !!(treatment && treatment.data && treatment.data.length > 0);
        const name = hasData && treatment.num ? `Prescription ${treatment.num}` : TREATMENT_LABELS[i];

        [[i * 2, name, 0], [i * 2 + 1, `${name} Avg`, 1]].forEach(([idx, text, sub]) => {
            const item = document.getElementById(`legend-item-${idx}`);
            const label = document.getElementById(`legend-label-${idx}`);
            if (item) {
                item.style.display = hasData ? '' : 'none';
                // Flex order so the legend reads 1, 2, 3, 4 like the results columns,
                // instead of in color-slot order; each line sits next to its own Avg.
                item.style.order = hasData ? treatment.num * 2 + sub : 99;
            }
            if (label) label.textContent = text;
        });
    }
}

function initializeGraph() {
    const ctx = document.getElementById('plasmaGraph');
    
    // Empty data on initialization - 4 treatments, each with solid + avg dashed line
    const sampleData = {
        labels: [],
        datasets: []
    };
    for (let i = 0; i < 4; i++) {
        sampleData.datasets.push({
            label: TREATMENT_LABELS[i],
            data: [],
            borderColor: TREATMENT_COLORS[i],
            tension: 0.4,
            fill: false
        });
        sampleData.datasets.push({
            label: TREATMENT_LABELS[i] + ' Avg',
            data: [],
            borderColor: TREATMENT_COLORS[i].replace('rgb', 'rgba').replace(')', ', 0.5)'),
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0,
            fill: false,
            pointRadius: 0
        });
    }
    
    plasmaChart = new Chart(ctx, {
        type: 'line',
        data: sampleData,
        options: {
            layout: {
                padding: { left: 95, right: 12, top: 6, bottom: 6 }
            },
            // Fill .chart-container rather than a fixed 2:1 shape — with an aspect ratio the
            // graph grew taller as the window got wider and pushed the page off-screen.
            responsive: true,
            maintainAspectRatio: false,
            font: {
                family: CHART_FONT_FAMILY
            },
            plugins: {
                legend: {
                    display: false  // Hide default legend, we'll use custom one
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Time',
                        font: {
                            family: CHART_FONT_FAMILY,
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        font: {
                            family: CHART_FONT_FAMILY
                        },
                        callback: function(value, index, ticks) {
                            // Only show labels at exact day boundaries
                            if (value % 1440 !== 0) return '';
                            const dayIndex = Math.floor(value / 1440);
                            // Fall back to Mon/Tue/... when full names won't fit in a day's width
                            // ("Wednesday" is ~5.5em wide), e.g. on small windows.
                            const fontSize = this.options.ticks.font.size || 12;
                            const days = this.width / 7 < fontSize * 7 ? DAY_NAMES_SHORT : DAY_NAMES;
                            return days[dayIndex] || '';
                        },
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0
                    },
                    min: 0,
                    max: 10080,
                    afterBuildTicks: function(axis) {
                        // Force exactly 7 ticks at day boundaries for each day of the week
                        axis.ticks = [0, 1440, 2880, 4320, 5760, 7200, 8640].map(value => ({ value }));
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: CHART_FONT_FAMILY
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        },
        plugins: [horizontalYAxisLabelPlugin]
    });
}

// Chart text is drawn on a canvas, so it can't use CSS rem. Size it from the page's root
// font size instead (which tracks the window — see the :root/html rules in index.html), so the
// graph's labels scale with the rest of the page. Left padding is measured to fit the
// horizontal y-axis label exactly.
function applyChartScale() {
    if (!plasmaChart) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const o = plasmaChart.options;
    const tickSize = Math.round(0.875 * rem);
    o.scales.x.ticks.font.size = tickSize;
    o.scales.y.ticks.font.size = tickSize;
    o.scales.x.title.font.size = Math.round(1 * rem);
    yAxisLabelFontSize = Math.round(0.9375 * rem);

    const ctx = plasmaChart.ctx;
    ctx.save();
    ctx.font = `bold ${yAxisLabelFontSize}px ${CHART_FONT_FAMILY}`;
    const labelWidth = ctx.measureText(Y_AXIS_LABEL).width;
    ctx.restore();
    o.layout.padding.left = Math.ceil(labelWidth + 0.75 * rem);

    plasmaChart.update('none');
}

window.addEventListener('resize', applyChartScale);

// Function to update graph with new data - treatmentsData: [{data, avg}, ...] for up to 4 treatments
function updateGraph(timeData, treatmentsData) {
    if (plasmaChart) {
        plasmaChart.data.labels = timeData;
        
        for (let i = 0; i < 4; i++) {
            const treatment = treatmentsData[i];
            const dataIdx = i * 2;
            const avgIdx = i * 2 + 1;
            
            if (treatment && treatment.data && treatment.data.length > 0) {
                plasmaChart.data.datasets[dataIdx].data = treatment.data;
                plasmaChart.data.datasets[avgIdx].data = treatment.avg !== null
                    ? timeData.map(() => treatment.avg)
                    : [];
                // Keep tooltip names on the same numbering as the results table
                const name = treatment.num ? `Prescription ${treatment.num}` : TREATMENT_LABELS[i];
                plasmaChart.data.datasets[dataIdx].label = name;
                plasmaChart.data.datasets[avgIdx].label = `${name} Avg`;
            } else {
                plasmaChart.data.datasets[dataIdx].data = [];
                plasmaChart.data.datasets[avgIdx].data = [];
                plasmaChart.data.datasets[dataIdx].label = TREATMENT_LABELS[i];
                plasmaChart.data.datasets[avgIdx].label = TREATMENT_LABELS[i] + ' Avg';
            }
        }

        updateLegendLabels(treatmentsData);
        plasmaChart.update();
    }
}

// Initialize the graph when the page loads
window.addEventListener('load', () => {
    createCustomLegend();
    initializeGraph();
    applyChartScale();
});
