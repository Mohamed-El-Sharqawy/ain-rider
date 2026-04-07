import { Elysia } from 'elysia';

export function generateDashboardHtml(services: string[], title: string = "Ain Rider | Metrics Dashboard") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --card: #18181b;
            --primary: #10b981;
            --primary-glow: rgba(16, 185, 129, 0.2);
            --error: #ef4444;
            --internal: #8b5cf6;
            --text: #fafafa;
            --text-muted: #a1a1aa;
            --border: #27272a;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background-color: var(--bg); color: var(--text); padding: 2rem; min-height: 100vh; }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; max-width: 1400px; margin-inline: auto; }
        .logo { font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 1rem; }
        .logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 30px var(--primary-glow); font-family: 'JetBrains Mono', monospace; font-weight: 900; color: white; }
        .badge { background: var(--primary-glow); color: var(--primary); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.3); letter-spacing: 0.05em; }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); gap: 1.5rem; max-width: 1400px; margin-inline: auto; }
        .grid.single { grid-template-columns: 1fr; max-width: 900px; }

        .card { background: var(--card); border: 1px solid var(--border); border-radius: 2rem; padding: 2rem; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; display: flex; flex-direction: column; }
        .card:hover { border-color: rgba(16, 185, 129, 0.5); background: #1c1c1f; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
        .service-info h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; text-transform: capitalize; letter-spacing: -0.01em; }
        .service-info p { color: var(--text-muted); font-size: 0.875rem; }

        .stats-summary { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .stat-item { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.02); }
        .stat-item .label { display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-item .value { font-size: 1.5rem; font-weight: 700; display: flex; align-items: baseline; gap: 0.5rem; }
        .value.error { color: var(--error); }
        .value.internal { color: var(--internal); }
        .value.primary { color: var(--primary); }
        .stat-item .unit { font-size: 0.75rem; color: var(--text-muted); font-weight: 400; }

        .chart-container { height: ${services.length === 1 ? '400px' : '220px'}; width: 100%; margin-top: auto; }

        .service-status { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; font-weight: 600; color: var(--primary); background: var(--primary-glow); padding: 0.3rem 0.8rem; border-radius: 99px; border: 1px solid rgba(16, 185, 129, 0.2); }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 10px var(--primary); animation: pulse-ring 2s infinite; }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
        .refresh-indicator { font-size: 0.75rem; color: var(--text-muted); }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <div class="logo-icon">/</div>
            Ain Rider Gateway 
            <span class="badge">Realtime Telemetry</span>
        </div>
        <div class="refresh-indicator" id="last-update">Waiting for first sync...</div>
    </div>

    <div class="grid ${services.length === 1 ? 'single' : ''}" id="metrics-grid"></div>

    <script>
        const SERVICES = ${JSON.stringify(services)};
        const charts = {};
        let prevMetrics = {};

        async function fetchMetrics(service) {
            try {
                const response = await fetch(\`/\${service}/metrics?raw=true\`);
                const text = await response.text();
                return parseMetrics(text, service);
            } catch (e) {
                console.error(\`Failed to fetch metrics for \${service}\`, e);
                return null;
            }
        }

        function parseMetrics(text, service) {
            const lines = text.split('\\n');
            const metrics = { requests: 0, errors: 0, internalCalls: 0, internalFails: 0, memory: 0, cpu: 0, dbLatency: 0, dbCount: 0 };

            lines.forEach(line => {
                if (line.startsWith('http_requests_total')) {
                    const matchValue = line.match(/ (\\d+)/);
                    if (matchValue) {
                        const count = parseInt(matchValue[1]);
                        metrics.requests += count;
                        if (line.includes('status_code="4') || line.includes('status_code="5')) metrics.errors += count;
                    }
                }
                if (line.startsWith('internal_api_calls_total')) {
                    const matchValue = line.match(/ (\\d+)/);
                    if (matchValue) {
                        const count = parseInt(matchValue[1]);
                        metrics.internalCalls += count;
                        if (line.includes('status="fail"')) metrics.internalFails += count;
                    }
                }
                if (line.includes('process_resident_memory_bytes')) {
                    const match = line.match(/ (\\d+)/);
                    if (match) metrics.memory = parseInt(match[1]) / (1024 * 1024);
                }
                if (line.includes('process_cpu_seconds_total')) {
                    const match = line.match(/ (\\d+\\.\\d+|\\d+)/);
                    if (match) metrics.cpu = parseFloat(match[1]);
                }
                if (line.includes('prisma_query_duration_seconds_sum')) {
                    const match = line.match(/ (\\d+\\.\\d+|\\d+)/);
                    if (match) metrics.dbLatency = parseFloat(match[1]);
                }
                if (line.includes('prisma_query_duration_seconds_count')) {
                    const match = line.match(/ (\\d+)/);
                    if (match) metrics.dbCount = parseInt(match[1]);
                }
            });
            return metrics;
        }

        function createServiceCard(service) {
            const card = document.createElement('div');
            card.className = 'card';
            card.id = \`card-\${service}\`;
            card.innerHTML = \`
                <div class="card-header">
                    <div class="service-info">
                        <h2>\${service.charAt(0).toUpperCase() + service.slice(1)} Service</h2>
                        <p>Production monitoring stack</p>
                    </div>
                    <div class="service-status">
                        <div class="pulse-dot"></div>
                        HEALTHY
                    </div>
                </div>
                <div class="stats-summary">
                    <div class="stat-item"><span class="label">Total Traffic</span><div class="value primary" id="val-\${service}-req">0<span class="unit">REQ</span></div></div>
                    <div class="stat-item"><span class="label">Error Rate</span><div class="value error" id="val-\${service}-err">0.0<span class="unit">%</span></div></div>
                    <div class="stat-item"><span class="label">Internal Calls</span><div class="value internal" id="val-\${service}-int">0<span class="unit">OP/S</span></div></div>
                    <div class="stat-item"><span class="label">DB Latency</span><div class="value" id="val-\${service}-db">0<span class="unit">MS</span></div></div>
                </div>
                <div class="chart-container"><canvas id="chart-\${service}"></canvas></div>
            \`;
            document.getElementById('metrics-grid').appendChild(card);

            const ctx = document.getElementById(\`chart-\${service}\`).getContext('2d');
            charts[service] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array(30).fill(''),
                    datasets: [
                        { label: 'HTTP traffic', data: Array(30).fill(0), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0 },
                        { label: 'Internal calls', data: Array(30).fill(0), borderColor: '#8b5cf6', borderDash: [5, 5], backgroundColor: 'transparent', tension: 0.4, borderWidth: 2, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#71717a', font: { size: 10, family: 'JetBrains Mono' }, maxTicksLimit: 5 } }
                    }
                }
            });
        }

        async function updateMetrics() {
            for (const service of SERVICES) {
                if (!document.getElementById(\`card-\${service}\`)) createServiceCard(service);
                const current = await fetchMetrics(service);
                if (current) {
                    const prev = prevMetrics[service] || current;
                    const httpRate = Math.max(0, current.requests - prev.requests);
                    const intRate = Math.max(0, current.internalCalls - prev.internalCalls);
                    const errorRate = current.requests > 0 ? (current.errors / current.requests * 100) : 0;
                    const dbCountDiff = current.dbCount - prev.dbCount;
                    const dbSumDiff = current.dbLatency - prev.dbLatency;
                    const avgDb = dbCountDiff > 0 ? (dbSumDiff / dbCountDiff * 1000).toFixed(0) : '0';

                    document.getElementById(\`val-\${service}-req\`).innerHTML = \`\${current.requests}<span class="unit">TOTAL</span>\`;
                    document.getElementById(\`val-\${service}-err\`).innerHTML = \`\${errorRate.toFixed(1)}<span class="unit">%</span>\`;
                    document.getElementById(\`val-\${service}-int\`).innerHTML = \`\${intRate}<span class="unit">OP/S</span>\`;
                    document.getElementById(\`val-\${service}-db\`).innerHTML = \`\${avgDb}<span class="unit">MS</span>\`;

                    const chart = charts[service];
                    chart.data.datasets[0].data.push(httpRate);
                    chart.data.datasets[0].data.shift();
                    chart.data.datasets[1].data.push(intRate);
                    chart.data.datasets[1].data.shift();
                    chart.update('none');
                    prevMetrics[service] = current;
                }
            }
            document.getElementById('last-update').textContent = 'SYNCED @ ' + new Date().toLocaleTimeString();
        }

        SERVICES.forEach(createServiceCard);
        updateMetrics();
    </script>
</body>
</html>`;
}

export const metricsDashboard = new Elysia()
    .get('/dashboard/metrics', () => {
        return new Response(
            generateDashboardHtml(['auth', 'trips', 'location', 'match', 'admin', 'websocket', 'payments']),
            { headers: { 'Content-Type': 'text/html' } }
        );
    });
