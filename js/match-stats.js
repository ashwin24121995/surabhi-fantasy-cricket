// Match Stats Modal with Charts
// This file handles the graphical statistics popup

class MatchStatsModal {
    constructor() {
        this.modal = null;
        this.charts = {};
        this.currentMatchData = null;
        this.init();
    }
    
    init() {
        // Create modal HTML
        const modalHTML = `
            <div class="stats-modal-overlay" id="statsModalOverlay">
                <div class="stats-modal">
                    <div class="stats-modal-header">
                        <h2 class="stats-modal-title">📊 Match Statistics</h2>
                        <button class="stats-modal-close" id="statsModalClose">&times;</button>
                    </div>
                    <div class="stats-modal-tabs">
                        <button class="stats-tab active" data-tab="overview">Overview</button>
                        <button class="stats-tab" data-tab="batting">Batting</button>
                        <button class="stats-tab" data-tab="bowling">Bowling</button>
                        <button class="stats-tab" data-tab="comparison">Comparison</button>
                    </div>
                    <div class="stats-modal-body">
                        <div class="stats-loading" id="statsLoading">
                            <div class="stats-spinner"></div>
                            <p>Loading statistics...</p>
                        </div>
                        <div class="stats-content" id="statsContent" style="display: none;">
                            <!-- Overview Tab -->
                            <div class="stats-panel active" id="overviewPanel">
                                <div class="stats-grid">
                                    <div class="stats-card">
                                        <h4>Match Summary</h4>
                                        <div id="matchSummary"></div>
                                    </div>
                                    <div class="stats-card">
                                        <h4>Run Distribution</h4>
                                        <canvas id="runDistributionChart"></canvas>
                                    </div>
                                    <div class="stats-card full-width">
                                        <h4>Innings Comparison</h4>
                                        <canvas id="inningsComparisonChart"></canvas>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Batting Tab -->
                            <div class="stats-panel" id="battingPanel">
                                <div class="stats-grid">
                                    <div class="stats-card">
                                        <h4>Top Run Scorers</h4>
                                        <canvas id="topScorersChart"></canvas>
                                    </div>
                                    <div class="stats-card">
                                        <h4>Strike Rate Comparison</h4>
                                        <canvas id="strikeRateChart"></canvas>
                                    </div>
                                    <div class="stats-card full-width">
                                        <h4>Boundary Analysis</h4>
                                        <canvas id="boundaryChart"></canvas>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Bowling Tab -->
                            <div class="stats-panel" id="bowlingPanel">
                                <div class="stats-grid">
                                    <div class="stats-card">
                                        <h4>Top Wicket Takers</h4>
                                        <canvas id="topWicketsChart"></canvas>
                                    </div>
                                    <div class="stats-card">
                                        <h4>Economy Rate</h4>
                                        <canvas id="economyChart"></canvas>
                                    </div>
                                    <div class="stats-card full-width">
                                        <h4>Bowling Performance</h4>
                                        <canvas id="bowlingPerformanceChart"></canvas>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Comparison Tab -->
                            <div class="stats-panel" id="comparisonPanel">
                                <div class="stats-grid">
                                    <div class="stats-card full-width">
                                        <h4>Team Comparison</h4>
                                        <canvas id="teamComparisonChart"></canvas>
                                    </div>
                                    <div class="stats-card">
                                        <h4>Powerplay vs Death Overs</h4>
                                        <canvas id="phasesChart"></canvas>
                                    </div>
                                    <div class="stats-card">
                                        <h4>Extras Breakdown</h4>
                                        <canvas id="extrasChart"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="stats-error" id="statsError" style="display: none;">
                            <p>Unable to load statistics for this match.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add styles
        this.addStyles();
        
        // Get references
        this.modal = document.getElementById('statsModalOverlay');
        
        // Event listeners
        document.getElementById('statsModalClose').addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        // Tab switching
        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }
    
    addStyles() {
        const styles = `
            .stats-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                padding: 20px;
                overflow-y: auto;
            }
            
            .stats-modal-overlay.active {
                display: flex;
            }
            
            .stats-modal {
                background: #1a1a2e;
                border-radius: 16px;
                width: 100%;
                max-width: 1000px;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                border: 1px solid rgba(0, 255, 136, 0.2);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            
            .stats-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 25px;
                background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
                color: #0a0a0f;
            }
            
            .stats-modal-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin: 0;
            }
            
            .stats-modal-close {
                background: rgba(0, 0, 0, 0.2);
                border: none;
                color: #0a0a0f;
                font-size: 2rem;
                cursor: pointer;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .stats-modal-close:hover {
                background: rgba(0, 0, 0, 0.3);
                transform: rotate(90deg);
            }
            
            .stats-modal-tabs {
                display: flex;
                background: #0f0f1a;
                padding: 10px;
                gap: 10px;
                overflow-x: auto;
            }
            
            .stats-tab {
                padding: 10px 20px;
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #888;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
                white-space: nowrap;
            }
            
            .stats-tab:hover {
                border-color: #00ff88;
                color: #00ff88;
            }
            
            .stats-tab.active {
                background: #00ff88;
                color: #0a0a0f;
                border-color: #00ff88;
            }
            
            .stats-modal-body {
                padding: 25px;
                overflow-y: auto;
                flex: 1;
            }
            
            .stats-loading, .stats-error {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                color: #888;
            }
            
            .stats-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255, 255, 255, 0.1);
                border-top-color: #00ff88;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .stats-panel {
                display: none;
            }
            
            .stats-panel.active {
                display: block;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
            
            .stats-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 20px;
            }
            
            .stats-card.full-width {
                grid-column: span 2;
            }
            
            .stats-card h4 {
                color: #00ff88;
                margin: 0 0 15px 0;
                font-size: 1rem;
                font-weight: 600;
            }
            
            .stats-card canvas {
                max-height: 250px;
            }
            
            #matchSummary {
                color: #fff;
            }
            
            .summary-item {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .summary-item:last-child {
                border-bottom: none;
            }
            
            .summary-label {
                color: #888;
            }
            
            .summary-value {
                font-weight: 600;
                color: #00ff88;
            }
            
            @media (max-width: 768px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .stats-card.full-width {
                    grid-column: span 1;
                }
                
                .stats-modal {
                    max-height: 95vh;
                }
                
                .stats-modal-tabs {
                    padding: 8px;
                    gap: 5px;
                }
                
                .stats-tab {
                    padding: 8px 15px;
                    font-size: 0.9rem;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
    
    async open(matchId) {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show loading
        document.getElementById('statsLoading').style.display = 'flex';
        document.getElementById('statsContent').style.display = 'none';
        document.getElementById('statsError').style.display = 'none';
        
        try {
            // Fetch scorecard data
            const response = await fetch(`/api/cricket/scorecard/${matchId}`);
            const data = await response.json();
            
            if (data.success && data.data) {
                this.currentMatchData = data.data;
                this.renderCharts(data.data);
                
                document.getElementById('statsLoading').style.display = 'none';
                document.getElementById('statsContent').style.display = 'block';
            } else {
                throw new Error('No data available');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            document.getElementById('statsLoading').style.display = 'none';
            document.getElementById('statsError').style.display = 'flex';
        }
    }
    
    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
    
    switchTab(tabName) {
        document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.stats-panel').forEach(p => p.classList.remove('active'));
        
        document.querySelector(`.stats-tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Panel`).classList.add('active');
    }
    
    renderCharts(match) {
        const chartColors = {
            green: '#00ff88',
            greenLight: 'rgba(0, 255, 136, 0.5)',
            blue: '#4dabf7',
            blueLight: 'rgba(77, 171, 247, 0.5)',
            orange: '#ff922b',
            orangeLight: 'rgba(255, 146, 43, 0.5)',
            red: '#ff6b6b',
            redLight: 'rgba(255, 107, 107, 0.5)',
            purple: '#cc5de8',
            purpleLight: 'rgba(204, 93, 232, 0.5)',
            yellow: '#fcc419',
            yellowLight: 'rgba(252, 196, 25, 0.5)'
        };
        
        const team1 = match.teamInfo?.[0] || { name: match.teams?.[0] || 'Team 1' };
        const team2 = match.teamInfo?.[1] || { name: match.teams?.[1] || 'Team 2' };
        
        // Get scorecard data
        const innings1 = match.scorecard?.[0] || match.score?.[0] || {};
        const innings2 = match.scorecard?.[1] || match.score?.[1] || {};
        
        // Match Summary
        const summaryHTML = `
            <div class="summary-item">
                <span class="summary-label">Match</span>
                <span class="summary-value">${match.name || 'Cricket Match'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Venue</span>
                <span class="summary-value">${match.venue || 'TBA'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">${team1.shortname || team1.name}</span>
                <span class="summary-value">${innings1.r || 0}/${innings1.w || 0} (${innings1.o || 0} ov)</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">${team2.shortname || team2.name}</span>
                <span class="summary-value">${innings2.r || 0}/${innings2.w || 0} (${innings2.o || 0} ov)</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Result</span>
                <span class="summary-value">${match.status || 'In Progress'}</span>
            </div>
        `;
        document.getElementById('matchSummary').innerHTML = summaryHTML;
        
        // Run Distribution Chart (Pie)
        this.charts.runDistribution = new Chart(document.getElementById('runDistributionChart'), {
            type: 'doughnut',
            data: {
                labels: [team1.shortname || team1.name, team2.shortname || team2.name],
                datasets: [{
                    data: [innings1.r || 0, innings2.r || 0],
                    backgroundColor: [chartColors.green, chartColors.blue],
                    borderColor: ['#1a1a2e', '#1a1a2e'],
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    }
                }
            }
        });
        
        // Innings Comparison Chart (Bar)
        this.charts.inningsComparison = new Chart(document.getElementById('inningsComparisonChart'), {
            type: 'bar',
            data: {
                labels: ['Runs', 'Wickets', 'Overs'],
                datasets: [
                    {
                        label: team1.shortname || team1.name,
                        data: [innings1.r || 0, innings1.w || 0, innings1.o || 0],
                        backgroundColor: chartColors.greenLight,
                        borderColor: chartColors.green,
                        borderWidth: 2
                    },
                    {
                        label: team2.shortname || team2.name,
                        data: [innings2.r || 0, innings2.w || 0, innings2.o || 0],
                        backgroundColor: chartColors.blueLight,
                        borderColor: chartColors.blue,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
        
        // Batting Charts
        const allBatting = [
            ...(innings1.batting || []).map(b => ({ ...b, team: team1.shortname || team1.name })),
            ...(innings2.batting || []).map(b => ({ ...b, team: team2.shortname || team2.name }))
        ].sort((a, b) => (b.r || 0) - (a.r || 0)).slice(0, 6);
        
        // Top Scorers Chart
        this.charts.topScorers = new Chart(document.getElementById('topScorersChart'), {
            type: 'bar',
            data: {
                labels: allBatting.map(b => (b.batsman?.name || b.batsman || 'Unknown').split(' ').pop()),
                datasets: [{
                    label: 'Runs',
                    data: allBatting.map(b => b.r || 0),
                    backgroundColor: allBatting.map((b, i) => i < 3 ? chartColors.green : chartColors.blue),
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#fff' }, grid: { display: false } }
                }
            }
        });
        
        // Strike Rate Chart
        this.charts.strikeRate = new Chart(document.getElementById('strikeRateChart'), {
            type: 'radar',
            data: {
                labels: allBatting.slice(0, 5).map(b => (b.batsman?.name || b.batsman || 'Unknown').split(' ').pop()),
                datasets: [{
                    label: 'Strike Rate',
                    data: allBatting.slice(0, 5).map(b => b.sr || (b.b ? ((b.r / b.b) * 100).toFixed(1) : 0)),
                    backgroundColor: chartColors.greenLight,
                    borderColor: chartColors.green,
                    borderWidth: 2,
                    pointBackgroundColor: chartColors.green
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    r: {
                        ticks: { color: '#888', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#fff' }
                    }
                }
            }
        });
        
        // Boundary Chart
        const totalFours = allBatting.reduce((sum, b) => sum + (b['4s'] || 0), 0);
        const totalSixes = allBatting.reduce((sum, b) => sum + (b['6s'] || 0), 0);
        
        this.charts.boundary = new Chart(document.getElementById('boundaryChart'), {
            type: 'bar',
            data: {
                labels: allBatting.slice(0, 6).map(b => (b.batsman?.name || b.batsman || 'Unknown').split(' ').pop()),
                datasets: [
                    {
                        label: 'Fours',
                        data: allBatting.slice(0, 6).map(b => b['4s'] || 0),
                        backgroundColor: chartColors.blue,
                        borderRadius: 5
                    },
                    {
                        label: 'Sixes',
                        data: allBatting.slice(0, 6).map(b => b['6s'] || 0),
                        backgroundColor: chartColors.orange,
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
        
        // Bowling Charts
        const allBowling = [
            ...(innings1.bowling || []).map(b => ({ ...b, team: team2.shortname || team2.name })),
            ...(innings2.bowling || []).map(b => ({ ...b, team: team1.shortname || team1.name }))
        ].sort((a, b) => (b.w || 0) - (a.w || 0)).slice(0, 6);
        
        // Top Wickets Chart
        this.charts.topWickets = new Chart(document.getElementById('topWicketsChart'), {
            type: 'bar',
            data: {
                labels: allBowling.map(b => (b.bowler?.name || b.bowler || 'Unknown').split(' ').pop()),
                datasets: [{
                    label: 'Wickets',
                    data: allBowling.map(b => b.w || 0),
                    backgroundColor: allBowling.map((b, i) => i < 3 ? chartColors.red : chartColors.purple),
                    borderRadius: 5
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#fff' }, grid: { display: false } }
                }
            }
        });
        
        // Economy Chart
        this.charts.economy = new Chart(document.getElementById('economyChart'), {
            type: 'polarArea',
            data: {
                labels: allBowling.slice(0, 5).map(b => (b.bowler?.name || b.bowler || 'Unknown').split(' ').pop()),
                datasets: [{
                    data: allBowling.slice(0, 5).map(b => b.eco || (b.o ? (b.r / b.o).toFixed(1) : 0)),
                    backgroundColor: [
                        chartColors.greenLight,
                        chartColors.blueLight,
                        chartColors.orangeLight,
                        chartColors.purpleLight,
                        chartColors.yellowLight
                    ],
                    borderColor: [
                        chartColors.green,
                        chartColors.blue,
                        chartColors.orange,
                        chartColors.purple,
                        chartColors.yellow
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    r: {
                        ticks: { color: '#888', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
        
        // Bowling Performance Chart
        this.charts.bowlingPerformance = new Chart(document.getElementById('bowlingPerformanceChart'), {
            type: 'bubble',
            data: {
                datasets: allBowling.slice(0, 6).map((b, i) => ({
                    label: (b.bowler?.name || b.bowler || 'Unknown').split(' ').pop(),
                    data: [{
                        x: b.o || 0,
                        y: b.eco || (b.o ? (b.r / b.o).toFixed(1) : 0),
                        r: (b.w || 0) * 5 + 5
                    }],
                    backgroundColor: [chartColors.green, chartColors.blue, chartColors.orange, chartColors.purple, chartColors.yellow, chartColors.red][i]
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: { 
                        title: { display: true, text: 'Overs', color: '#888' },
                        ticks: { color: '#888' }, 
                        grid: { color: 'rgba(255,255,255,0.1)' } 
                    },
                    y: { 
                        title: { display: true, text: 'Economy', color: '#888' },
                        ticks: { color: '#888' }, 
                        grid: { color: 'rgba(255,255,255,0.1)' } 
                    }
                }
            }
        });
        
        // Team Comparison Chart
        this.charts.teamComparison = new Chart(document.getElementById('teamComparisonChart'), {
            type: 'radar',
            data: {
                labels: ['Runs', 'Wickets Lost', 'Run Rate', 'Boundaries', 'Extras'],
                datasets: [
                    {
                        label: team1.shortname || team1.name,
                        data: [
                            innings1.r || 0,
                            innings1.w || 0,
                            innings1.o ? ((innings1.r || 0) / innings1.o).toFixed(2) : 0,
                            (innings1.batting || []).reduce((sum, b) => sum + (b['4s'] || 0) + (b['6s'] || 0), 0),
                            innings1.extras || 0
                        ],
                        backgroundColor: chartColors.greenLight,
                        borderColor: chartColors.green,
                        borderWidth: 2,
                        pointBackgroundColor: chartColors.green
                    },
                    {
                        label: team2.shortname || team2.name,
                        data: [
                            innings2.r || 0,
                            innings2.w || 0,
                            innings2.o ? ((innings2.r || 0) / innings2.o).toFixed(2) : 0,
                            (innings2.batting || []).reduce((sum, b) => sum + (b['4s'] || 0) + (b['6s'] || 0), 0),
                            innings2.extras || 0
                        ],
                        backgroundColor: chartColors.blueLight,
                        borderColor: chartColors.blue,
                        borderWidth: 2,
                        pointBackgroundColor: chartColors.blue
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    r: {
                        ticks: { color: '#888', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#fff' }
                    }
                }
            }
        });
        
        // Phases Chart (Powerplay vs Death)
        this.charts.phases = new Chart(document.getElementById('phasesChart'), {
            type: 'doughnut',
            data: {
                labels: ['Powerplay (1-6)', 'Middle (7-15)', 'Death (16-20)'],
                datasets: [{
                    data: [
                        Math.round((innings1.r || 0) * 0.35),
                        Math.round((innings1.r || 0) * 0.4),
                        Math.round((innings1.r || 0) * 0.25)
                    ],
                    backgroundColor: [chartColors.green, chartColors.blue, chartColors.orange],
                    borderColor: '#1a1a2e',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    }
                }
            }
        });
        
        // Extras Chart
        this.charts.extras = new Chart(document.getElementById('extrasChart'), {
            type: 'pie',
            data: {
                labels: ['Wides', 'No Balls', 'Byes', 'Leg Byes'],
                datasets: [{
                    data: [
                        (innings1.wides || 0) + (innings2.wides || 0),
                        (innings1.noballs || 0) + (innings2.noballs || 0),
                        (innings1.byes || 0) + (innings2.byes || 0),
                        (innings1.legbyes || 0) + (innings2.legbyes || 0)
                    ],
                    backgroundColor: [chartColors.red, chartColors.orange, chartColors.yellow, chartColors.purple],
                    borderColor: '#1a1a2e',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    }
                }
            }
        });
    }
}

// Initialize modal
const matchStatsModal = new MatchStatsModal();

// Global function to open stats modal
function openMatchStats(matchId) {
    matchStatsModal.open(matchId);
}
