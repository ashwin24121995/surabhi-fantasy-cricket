const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// API Routes

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const dbConnected = await testDatabaseConnection();
    res.json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
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
            'SELECT id, username, email, full_name, mobile, date_of_birth, state, profile_image, created_at FROM users WHERE id = ?',
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
    
    // Test and initialize database
    const dbConnected = await testDatabaseConnection();
    if (dbConnected) {
        await initializeDatabase();
    }
});

module.exports = app;
