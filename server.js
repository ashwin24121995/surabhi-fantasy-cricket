const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Cricket API Configuration
const CRICKET_API_KEY = process.env.CRICKET_API_KEY;
const CRICKET_API_BASE_URL = process.env.CRICKET_API_BASE_URL || 'https://api.cricapi.com/v1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'surabhi-fantasy-cricket-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database connection pool
const pool = mysql.createPool({
    uri: process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testDatabaseConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Initialize database tables
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Create users table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(100) NOT NULL,
                mobile VARCHAR(15),
                date_of_birth DATE NOT NULL,
                state VARCHAR(50) NOT NULL,
                profile_image VARCHAR(255),
                total_points INT DEFAULT 0,
                matches_played INT DEFAULT 0,
                contests_won INT DEFAULT 0,
                is_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login TIMESTAMP NULL,
                INDEX idx_email (email),
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create user_sessions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_token VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_session_token (session_token),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create contests table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS contests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                match_id VARCHAR(100) NOT NULL,
                match_name VARCHAR(255) NOT NULL,
                contest_name VARCHAR(100) NOT NULL,
                contest_type ENUM('mega', 'head_to_head', 'practice', 'winner_takes_all') DEFAULT 'practice',
                max_participants INT DEFAULT 100,
                current_participants INT DEFAULT 0,
                entry_fee DECIMAL(10,2) DEFAULT 0.00,
                prize_pool DECIMAL(10,2) DEFAULT 0.00,
                first_prize DECIMAL(10,2) DEFAULT 0.00,
                status ENUM('upcoming', 'live', 'completed', 'cancelled') DEFAULT 'upcoming',
                match_start_time DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_match_id (match_id),
                INDEX idx_status (status),
                INDEX idx_match_start_time (match_start_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create user_teams table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_teams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                contest_id INT NOT NULL,
                match_id VARCHAR(100) NOT NULL,
                team_name VARCHAR(100) DEFAULT 'My Team',
                captain_id VARCHAR(100) NOT NULL,
                vice_captain_id VARCHAR(100) NOT NULL,
                total_credits DECIMAL(4,1) DEFAULT 100.0,
                total_points DECIMAL(10,2) DEFAULT 0.00,
                player_rank INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_contest_id (contest_id),
                INDEX idx_match_id (match_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create team_players table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS team_players (
                id INT AUTO_INCREMENT PRIMARY KEY,
                team_id INT NOT NULL,
                player_id VARCHAR(100) NOT NULL,
                player_name VARCHAR(100) NOT NULL,
                player_role ENUM('batsman', 'bowler', 'all_rounder', 'wicket_keeper') NOT NULL,
                credits DECIMAL(4,1) NOT NULL,
                points DECIMAL(10,2) DEFAULT 0.00,
                is_captain BOOLEAN DEFAULT FALSE,
                is_vice_captain BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (team_id) REFERENCES user_teams(id) ON DELETE CASCADE,
                INDEX idx_team_id (team_id),
                INDEX idx_player_id (player_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create leaderboard table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                contest_id INT NOT NULL,
                team_id INT NOT NULL,
                total_points DECIMAL(10,2) DEFAULT 0.00,
                player_rank INT DEFAULT 0,
                prize_won DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
                FOREIGN KEY (team_id) REFERENCES user_teams(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_contest (user_id, contest_id),
                INDEX idx_contest_id (contest_id),
                INDEX idx_rank (rank)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create contact_messages table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                subject VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create newsletter_subscribers table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unsubscribed_at TIMESTAMP NULL,
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // Create cookie_consents table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS cookie_consents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                session_id VARCHAR(255),
                consent_given BOOLEAN DEFAULT FALSE,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_session_id (session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        connection.release();
        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        return false;
    }
}

// Restricted states list
const RESTRICTED_STATES = [
    'Andhra Pradesh',
    'Assam',
    'Nagaland',
    'Odisha',
    'Sikkim',
    'Telangana'
];

// Helper function to convert GMT to IST
function convertToIST(dateTimeGMT) {
    const date = new Date(dateTimeGMT);
    // Add 5 hours 30 minutes for IST
    date.setMinutes(date.getMinutes() + 330);
    return date;
}

// Helper function to format date for display
function formatDateIST(dateTimeGMT) {
    const istDate = convertToIST(dateTimeGMT);
    return istDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Helper function to calculate player credits based on role and stats
function calculatePlayerCredits(player) {
    let baseCredits = 8.0;
    
    switch (player.role?.toLowerCase()) {
        case 'batsman':
            baseCredits = 8.5;
            break;
        case 'bowler':
            baseCredits = 8.0;
            break;
        case 'batting allrounder':
        case 'bowling allrounder':
        case 'all-rounder':
        case 'allrounder':
            baseCredits = 9.0;
            break;
        case 'wicketkeeper':
        case 'wk-batsman':
            baseCredits = 8.5;
            break;
        default:
            baseCredits = 8.0;
    }
    
    // Add some variance based on player name hash (for consistency)
    const nameHash = player.name?.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 0;
    const variance = (nameHash % 20) / 10 - 1; // -1 to +1
    
    return Math.min(11, Math.max(7, baseCredits + variance)).toFixed(1);
}

// ==================== CRICKET API ROUTES ====================

// Get current/live matches
app.get('/api/cricket/current-matches', async (req, res) => {
    try {
        // Fetch current matches
        const currentResponse = await fetch(`${CRICKET_API_BASE_URL}/currentMatches?apikey=${CRICKET_API_KEY}&offset=0`);
        const currentData = await currentResponse.json();
        
        // Fetch upcoming series to get upcoming matches
        const seriesResponse = await fetch(`${CRICKET_API_BASE_URL}/series?apikey=${CRICKET_API_KEY}&offset=0`);
        const seriesData = await seriesResponse.json();
        
        let allMatches = [];
        let upcomingMatches = [];
        
        // Process current matches
        if (currentData.status === 'success' && currentData.data) {
            allMatches = currentData.data.map(match => ({
                id: match.id,
                name: match.name,
                matchType: match.matchType?.toUpperCase(),
                status: match.status,
                venue: match.venue,
                date: match.date,
                dateTimeGMT: match.dateTimeGMT,
                dateTimeIST: formatDateIST(match.dateTimeGMT),
                teams: match.teams,
                teamInfo: match.teamInfo,
                score: match.score,
                tossWinner: match.tossWinner,
                tossChoice: match.tossChoice,
                matchWinner: match.matchWinner,
                seriesId: match.series_id,
                fantasyEnabled: match.fantasyEnabled,
                hasSquad: match.hasSquad,
                matchStarted: match.matchStarted,
                matchEnded: match.matchEnded
            }));
        }
        
        // Find upcoming series (starting within next 60 days)
        const now = new Date();
        const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        
        if (seriesData.status === 'success' && seriesData.data) {
            const upcomingSeries = seriesData.data.filter(s => {
                const startDate = new Date(s.startDate);
                return startDate >= now && startDate <= sixtyDaysLater;
            }).slice(0, 15); // Limit to 15 series to get matches from all countries
            
            // Fetch matches for each upcoming series
            for (const series of upcomingSeries) {
                try {
                    const seriesInfoResponse = await fetch(`${CRICKET_API_BASE_URL}/series_info?apikey=${CRICKET_API_KEY}&id=${series.id}`);
                    const seriesInfo = await seriesInfoResponse.json();
                    
                    if (seriesInfo.status === 'success' && seriesInfo.data?.matchList) {
                        const seriesMatches = seriesInfo.data.matchList
                            .filter(m => !m.matchStarted && !m.matchEnded)
                            .map(match => ({
                                id: match.id,
                                name: match.name,
                                matchType: match.matchType?.toUpperCase(),
                                status: match.status,
                                venue: match.venue,
                                date: match.date,
                                dateTimeGMT: match.dateTimeGMT,
                                dateTimeIST: formatDateIST(match.dateTimeGMT),
                                teams: match.teams,
                                teamInfo: match.teamInfo,
                                score: match.score || [],
                                seriesId: series.id,
                                seriesName: series.name,
                                fantasyEnabled: match.fantasyEnabled,
                                hasSquad: match.hasSquad,
                                matchStarted: match.matchStarted,
                                matchEnded: match.matchEnded
                            }));
                        upcomingMatches.push(...seriesMatches);
                    }
                } catch (err) {
                    console.error(`Error fetching series ${series.id}:`, err.message);
                }
            }
        }
        
        // Remove duplicates from upcoming matches
        const seenIds = new Set(allMatches.map(m => m.id));
        upcomingMatches = upcomingMatches.filter(m => {
            if (seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
        });
        
        // Sort upcoming matches by date
        upcomingMatches.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
        
        // Separate current matches into live and completed
        const liveMatches = allMatches.filter(m => m.matchStarted && !m.matchEnded);
        const completedMatches = allMatches.filter(m => m.matchEnded);
        
        res.json({
            success: true,
            live: liveMatches,
            upcoming: upcomingMatches,
            completed: completedMatches,
            total: allMatches.length + upcomingMatches.length
        });
        
    } catch (error) {
        console.error('Error fetching current matches:', error);
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});

// Get live scores (quick endpoint)
app.get('/api/cricket/live-scores', async (req, res) => {
    try {
        const response = await fetch(`${CRICKET_API_BASE_URL}/cricScore?apikey=${CRICKET_API_KEY}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch live scores' });
        }
        
        const scores = data.data.map(match => ({
            id: match.id,
            matchType: match.matchType?.toUpperCase(),
            status: match.status,
            matchStatus: match.ms,
            team1: match.t1,
            team2: match.t2,
            team1Score: match.t1s,
            team2Score: match.t2s,
            team1Img: match.t1img,
            team2Img: match.t2img,
            series: match.series,
            dateTimeGMT: match.dateTimeGMT,
            dateTimeIST: formatDateIST(match.dateTimeGMT)
        }));
        
        res.json({
            success: true,
            matches: scores
        });
        
    } catch (error) {
        console.error('Error fetching live scores:', error);
        res.status(500).json({ error: 'Failed to fetch live scores' });
    }
});

// Get match details
app.get('/api/cricket/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const response = await fetch(`${CRICKET_API_BASE_URL}/match_info?apikey=${CRICKET_API_KEY}&id=${matchId}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch match details' });
        }
        
        const match = data.data;
        res.json({
            success: true,
            match: {
                id: match.id,
                name: match.name,
                matchType: match.matchType?.toUpperCase(),
                status: match.status,
                venue: match.venue,
                date: match.date,
                dateTimeGMT: match.dateTimeGMT,
                dateTimeIST: formatDateIST(match.dateTimeGMT),
                teams: match.teams,
                teamInfo: match.teamInfo,
                score: match.score,
                tossWinner: match.tossWinner,
                tossChoice: match.tossChoice,
                matchWinner: match.matchWinner,
                seriesId: match.series_id,
                fantasyEnabled: match.fantasyEnabled,
                hasSquad: match.hasSquad,
                matchStarted: match.matchStarted,
                matchEnded: match.matchEnded
            }
        });
        
    } catch (error) {
        console.error('Error fetching match details:', error);
        res.status(500).json({ error: 'Failed to fetch match details' });
    }
});

// Get match squad
app.get('/api/cricket/squad/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const response = await fetch(`${CRICKET_API_BASE_URL}/match_squad?apikey=${CRICKET_API_KEY}&id=${matchId}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch squad' });
        }
        
        // Process squad data with credits
        const squads = data.data.map(team => ({
            teamName: team.teamName,
            shortname: team.shortname,
            img: team.img,
            players: team.players.map(player => ({
                id: player.id,
                name: player.name,
                role: player.role || 'Unknown',
                battingStyle: player.battingStyle,
                bowlingStyle: player.bowlingStyle,
                country: player.country,
                playerImg: player.playerImg,
                credits: calculatePlayerCredits(player)
            }))
        }));
        
        res.json({
            success: true,
            squads
        });
        
    } catch (error) {
        console.error('Error fetching squad:', error);
        res.status(500).json({ error: 'Failed to fetch squad' });
    }
});

// Get match scorecard
app.get('/api/cricket/scorecard/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const response = await fetch(`${CRICKET_API_BASE_URL}/match_scorecard?apikey=${CRICKET_API_KEY}&id=${matchId}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch scorecard' });
        }
        
        res.json({
            success: true,
            scorecard: data.data
        });
        
    } catch (error) {
        console.error('Error fetching scorecard:', error);
        res.status(500).json({ error: 'Failed to fetch scorecard' });
    }
});

// Get fantasy points for a match
app.get('/api/cricket/points/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const response = await fetch(`${CRICKET_API_BASE_URL}/match_points?apikey=${CRICKET_API_KEY}&id=${matchId}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch fantasy points' });
        }
        
        res.json({
            success: true,
            points: data.data
        });
        
    } catch (error) {
        console.error('Error fetching fantasy points:', error);
        res.status(500).json({ error: 'Failed to fetch fantasy points' });
    }
});

// Get series list
app.get('/api/cricket/series', async (req, res) => {
    try {
        const offset = req.query.offset || 0;
        const response = await fetch(`${CRICKET_API_BASE_URL}/series?apikey=${CRICKET_API_KEY}&offset=${offset}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch series' });
        }
        
        res.json({
            success: true,
            series: data.data,
            total: data.info.totalRows
        });
        
    } catch (error) {
        console.error('Error fetching series:', error);
        res.status(500).json({ error: 'Failed to fetch series' });
    }
});

// Get player info
app.get('/api/cricket/player/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const response = await fetch(`${CRICKET_API_BASE_URL}/players_info?apikey=${CRICKET_API_KEY}&id=${playerId}`);
        const data = await response.json();
        
        if (data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch player info' });
        }
        
        res.json({
            success: true,
            player: data.data
        });
        
    } catch (error) {
        console.error('Error fetching player info:', error);
        res.status(500).json({ error: 'Failed to fetch player info' });
    }
});

// ==================== CONTEST API ROUTES ====================

// Get contests for a match
app.get('/api/contests/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        
        const [contests] = await pool.execute(
            `SELECT * FROM contests WHERE match_id = ? AND status IN ('upcoming', 'live') ORDER BY entry_fee ASC`,
            [matchId]
        );
        
        res.json({
            success: true,
            contests
        });
        
    } catch (error) {
        console.error('Error fetching contests:', error);
        res.status(500).json({ error: 'Failed to fetch contests' });
    }
});

// Create a contest (admin only - for now open)
app.post('/api/contests/create', async (req, res) => {
    try {
        const { matchId, matchName, contestName, contestType, maxParticipants, entryFee, prizePool, firstPrize, matchStartTime } = req.body;
        
        if (!matchId || !matchName || !contestName || !matchStartTime) {
            return res.status(400).json({ error: 'Required fields missing' });
        }
        
        const [result] = await pool.execute(
            `INSERT INTO contests (match_id, match_name, contest_name, contest_type, max_participants, entry_fee, prize_pool, first_prize, match_start_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [matchId, matchName, contestName, contestType || 'practice', maxParticipants || 100, entryFee || 0, prizePool || 0, firstPrize || 0, matchStartTime]
        );
        
        res.status(201).json({
            success: true,
            message: 'Contest created successfully',
            contestId: result.insertId
        });
        
    } catch (error) {
        console.error('Error creating contest:', error);
        res.status(500).json({ error: 'Failed to create contest' });
    }
});

// Join a contest with team
app.post('/api/contests/:contestId/join', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Please login to join contest' });
        }
        
        const { contestId } = req.params;
        const { matchId, teamName, captainId, viceCaptainId, players } = req.body;
        
        // Validate team
        if (!players || players.length !== 11) {
            return res.status(400).json({ error: 'Team must have exactly 11 players' });
        }
        
        if (!captainId || !viceCaptainId) {
            return res.status(400).json({ error: 'Captain and Vice Captain must be selected' });
        }
        
        // Check if user already joined this contest
        const [existing] = await pool.execute(
            'SELECT id FROM user_teams WHERE user_id = ? AND contest_id = ?',
            [req.session.userId, contestId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already joined this contest' });
        }
        
        // Calculate total credits
        const totalCredits = players.reduce((sum, p) => sum + parseFloat(p.credits), 0);
        
        if (totalCredits > 100) {
            return res.status(400).json({ error: 'Total credits cannot exceed 100' });
        }
        
        // Create team
        const [teamResult] = await pool.execute(
            `INSERT INTO user_teams (user_id, contest_id, match_id, team_name, captain_id, vice_captain_id, total_credits)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.session.userId, contestId, matchId, teamName || 'My Team', captainId, viceCaptainId, totalCredits]
        );
        
        const teamId = teamResult.insertId;
        
        // Add players to team
        for (const player of players) {
            await pool.execute(
                `INSERT INTO team_players (team_id, player_id, player_name, player_role, credits, is_captain, is_vice_captain)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [teamId, player.id, player.name, player.role.toLowerCase().replace(/[- ]/g, '_'), player.credits, player.id === captainId, player.id === viceCaptainId]
            );
        }
        
        // Update contest participants count
        await pool.execute(
            'UPDATE contests SET current_participants = current_participants + 1 WHERE id = ?',
            [contestId]
        );
        
        // Add to leaderboard
        await pool.execute(
            'INSERT INTO leaderboard (user_id, contest_id, team_id) VALUES (?, ?, ?)',
            [req.session.userId, contestId, teamId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Successfully joined the contest!',
            teamId
        });
        
    } catch (error) {
        console.error('Error joining contest:', error);
        res.status(500).json({ error: 'Failed to join contest' });
    }
});

// Get leaderboard for a contest
app.get('/api/contests/:contestId/leaderboard', async (req, res) => {
    try {
        const { contestId } = req.params;
        
        const [leaderboard] = await pool.execute(
            `SELECT l.*, u.username, u.full_name, ut.team_name, ut.total_points
             FROM leaderboard l
             JOIN users u ON l.user_id = u.id
             JOIN user_teams ut ON l.team_id = ut.id
             WHERE l.contest_id = ?
             ORDER BY ut.total_points DESC, l.created_at ASC`,
            [contestId]
        );
        
        // Assign ranks
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        
        res.json({
            success: true,
            leaderboard
        });
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Get user's teams
app.get('/api/user/teams', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Please login to view teams' });
        }
        
        const [teams] = await pool.execute(
            `SELECT ut.*, c.contest_name, c.match_name, c.status as contest_status
             FROM user_teams ut
             JOIN contests c ON ut.contest_id = c.id
             WHERE ut.user_id = ?
             ORDER BY ut.created_at DESC`,
            [req.session.userId]
        );
        
        res.json({
            success: true,
            teams
        });
        
    } catch (error) {
        console.error('Error fetching user teams:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// ==================== AUTH API ROUTES ====================

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const dbConnected = await testDatabaseConnection();
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        cricketApi: CRICKET_API_KEY ? 'configured' : 'not configured',
        timestamp: new Date().toISOString()
    });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, fullName, mobile, dateOfBirth, state } = req.body;
        
        // Validation
        if (!username || !email || !password || !fullName || !dateOfBirth || !state) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }
        
        // Check age (must be 18+)
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 18) {
            return res.status(400).json({ error: 'You must be at least 18 years old to register' });
        }
        
        // Check restricted states
        if (RESTRICTED_STATES.includes(state)) {
            return res.status(400).json({ 
                error: `Users from ${state} are not permitted to participate due to government compliance requirements` 
            });
        }
        
        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Insert user
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password_hash, full_name, mobile, date_of_birth, state) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, email, passwordHash, fullName, mobile || null, dateOfBirth, state]
        );
        
        res.status(201).json({
            success: true,
            message: 'Registration successful! Please login to continue.',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const user = users[0];
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last login
        await pool.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );
        
        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.email = user.email;
        
        res.json({
            success: true,
            message: 'Login successful!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                mobile: user.mobile,
                state: user.state,
                dateOfBirth: user.date_of_birth,
                profileImage: user.profile_image,
                totalPoints: user.total_points,
                matchesPlayed: user.matches_played,
                contestsWon: user.contests_won,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// User Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const [users] = await pool.execute(
            'SELECT id, username, email, full_name, mobile, date_of_birth, state, profile_image, total_points, matches_played, contests_won, created_at FROM users WHERE id = ?',
            [req.session.userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// Contact form submission
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        await pool.execute(
            'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
            [name, email, subject, message]
        );
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.'
        });
        
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit message. Please try again.' });
    }
});

// Newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Check if already subscribed
        const [existing] = await pool.execute(
            'SELECT id, is_active FROM newsletter_subscribers WHERE email = ?',
            [email]
        );
        
        if (existing.length > 0) {
            if (existing[0].is_active) {
                return res.status(400).json({ error: 'This email is already subscribed' });
            } else {
                // Reactivate subscription
                await pool.execute(
                    'UPDATE newsletter_subscribers SET is_active = TRUE, unsubscribed_at = NULL WHERE email = ?',
                    [email]
                );
                return res.json({ success: true, message: 'Welcome back! Your subscription has been reactivated.' });
            }
        }
        
        await pool.execute(
            'INSERT INTO newsletter_subscribers (email) VALUES (?)',
            [email]
        );
        
        res.status(201).json({
            success: true,
            message: 'Thank you for subscribing to our newsletter!'
        });
        
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
    }
});

// Cookie consent
app.post('/api/cookie-consent', async (req, res) => {
    try {
        const { consent } = req.body;
        const sessionId = req.sessionID;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        await pool.execute(
            'INSERT INTO cookie_consents (user_id, session_id, consent_given, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId || null, sessionId, consent, ipAddress, userAgent]
        );
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Cookie consent error:', error);
        res.status(500).json({ error: 'Failed to save consent' });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve pages directory
app.use('/pages', express.static(path.join(__dirname, 'pages')));

// Serve assets directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve CSS directory
app.use('/css', express.static(path.join(__dirname, 'css')));

// Serve JS directory
app.use('/js', express.static(path.join(__dirname, 'js')));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes - serve the appropriate HTML file or 404
app.get('*', (req, res) => {
    const requestedPath = req.path;
    
    // Check if it's a page request
    if (requestedPath.startsWith('/pages/')) {
        const pagePath = path.join(__dirname, requestedPath);
        res.sendFile(pagePath, (err) => {
            if (err) {
                res.status(404).sendFile(path.join(__dirname, 'pages', '404.html'), (err) => {
                    if (err) {
                        res.status(404).send('Page not found');
                    }
                });
            }
        });
    } else {
        // Try to serve as static file, otherwise send 404
        res.sendFile(path.join(__dirname, requestedPath), (err) => {
            if (err) {
                res.status(404).sendFile(path.join(__dirname, 'pages', '404.html'), (err) => {
                    if (err) {
                        res.status(404).send('Page not found');
                    }
                });
            }
        });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏏 Cricket API: ${CRICKET_API_KEY ? 'Configured' : 'Not configured'}`);
    
    // Test and initialize database
    const dbConnected = await testDatabaseConnection();
    if (dbConnected) {
        await initializeDatabase();
    }
});

module.exports = app;
