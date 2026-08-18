const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const companiesRoute = require('./routes/companies');
const leadsRoute = require('./routes/leads');
const campaignsRoute = require('./routes/campaigns');
const messagesRoute = require('./routes/messages');
const discoveryRoute = require('./routes/discovery');
const path = require('path');
const { startEmailMonitor, setIO: setEmailIO } = require('./scheduler/emailKillSwitch');
const repliesRoute = require('./routes/replies');
const whatsappRoute = require('./routes/whatsapp');
const { initWhatsApp } = require('./services/whatsappClient');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// STEP 4 - Initialize real-time bridge for replies
const { setIO: setWhatsAppIO } = require('./services/replyHandler');
const { setIO: setAutomatorIO } = require('./workers/automationWorker');
setWhatsAppIO(io);
setEmailIO(io);
setAutomatorIO(io);

// PHASE 6 - Safety Guard for Redis/Docker failures
process.on('unhandledRejection', (reason, promise) => {
    if (reason?.message?.includes('ECONNREFUSED') && reason?.port === 6379) {
        // Silently swallow Redis connection errors to keep server alive
        return;
    }
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 🚨 NEW: Global Crash Protection for Browser Timeouts
process.on('uncaughtException', (err) => {
    if (err.message?.includes('Timeout hit') || err.message?.includes('puppeteer-cluster')) {
        console.warn('⚠️  [Safety Guard] Caught background browser timeout. Process preserved.');
        return;
    }
    console.error('💥 [Critical Error] Uncaught Exception:', err);
    // For non-browser errors, we still want to log it clearly
});

app.use(cors());
app.use(express.json());
// Serve local uploads publicly for embedded email media
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
const r2Route = require('./routes/r2');
const proposalsRoute = require('./routes/proposals');
const servicesRoute = require('./routes/services');

app.use('/leads', leadsRoute);
app.use('/companies', companiesRoute);
app.use('/campaigns', campaignsRoute);
app.use('/messages', messagesRoute);
app.use('/discovery', discoveryRoute);
app.use('/replies', repliesRoute);
app.use('/whatsapp', whatsappRoute);
app.use('/proposals', proposalsRoute);
app.use('/services', servicesRoute);
app.use('/api/r2', r2Route);

app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: 'Growth Engine Running 🚀',
            dbTime: result.rows[0].now,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('🤖 AutoPilot: Scheduled for 09:00 AM Daily');
    console.log('📡 Real-time Dashboard: Socket.io Active');
    startEmailMonitor();
    
    // STEP 6 & 7: Outreach workers + WhatsApp — gated by OUTREACH_ENABLED env flag.
    // Set OUTREACH_ENABLED=true in .env to activate WhatsApp & Email sending.
    const outreachEnabled = process.env.OUTREACH_ENABLED === 'true';
    if (outreachEnabled) {
        require('./workers/whatsappWorker');
        require('./workers/emailWorker');
        console.log('🚀 [Outreach Workers] Unified WhatsApp & Email Engines Active');
        initWhatsApp().catch(err => {
            console.warn('⚠️  Failed to initialize WhatsApp. QR scan might be needed.', err.message);
        });
    } else {
        console.log('🔇 [Outreach Workers] Disabled via OUTREACH_ENABLED=false — WhatsApp & Email are OFF.');
    }
});