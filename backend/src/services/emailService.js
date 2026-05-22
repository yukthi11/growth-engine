const { Resend } = require('resend');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });


// Personal email providers that cannot be impersonated via Resend.
// Must send via SMTP directly (requires nodemailer + app password).
const SMTP_ONLY_DOMAINS = new Set([
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.in', 'ymail.com',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
]);

/**
 * Detects which transport to use based on sender email domain.
 * @param {string|null} fromEmail
 * @returns {'smtp' | 'resend'}
 */
function detectProvider(fromEmail, password) {
    // Priority 1: User-provided credentials in the DB/UI
    if (password && password.length > 0) return 'smtp';
    
    // Priority 2: Standard personal Gmail (no password needed in many cases, but here we require it)
    if (!fromEmail) return 'resend';
    const domain = fromEmail.split('@')[1]?.toLowerCase() || '';
    if (SMTP_ONLY_DOMAINS.has(domain)) return 'smtp';

    // Priority 3: Fallback to Resend for other domains
    return 'resend';
}

async function _sendViaResend(to, subject, text, fromEmail, html) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not defined in environment variables.');
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = fromEmail || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const payload = { from, to: [to], subject, text };
    if (html) payload.html = html;
    const { data, error } = await resend.emails.send(payload);
    if (error) throw new Error(`Resend error: ${error.message}`);
    console.log(`[Email/Resend] Sent to ${to} from ${from}`);
    return data;
}

async function _sendViaSMTP(to, subject, text, fromEmail, smtpPassword, html) {
    // Lazy-require so the app doesn't crash if nodemailer isn't installed
    // and no Gmail senders are configured.
    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch {
        throw new Error(
            `nodemailer is required to send from ${fromEmail}. ` +
            `Run: npm install nodemailer in the backend directory.`
        );
    }
    const isGmail = fromEmail.includes('@gmail.com') || fromEmail.includes('@googlemail.com');
    
    let transportConfig = {};
    if (isGmail) {
        transportConfig = {
            service: 'gmail',
            auth: { user: fromEmail, pass: smtpPassword }
        };
    } else {
        // Fallback for custom domains like Google Workspace
        transportConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 465,
            secure: true,
            auth: { user: fromEmail, pass: smtpPassword }
        };
    }

    const transporter = nodemailer.createTransport(transportConfig);
    const payload = { from: fromEmail, to, subject, text };
    if (html) payload.html = html;
    const info = await transporter.sendMail(payload);
    console.log(`[Email/SMTP] Sent to ${to} from ${fromEmail} (msgId: ${info.messageId})`);
    return info;
}

/**
 * Sends an email using the provider appropriate for the sender's domain.
 *
 * - Custom domain (e.g. info@worldtrek.in) → Resend (domain must be verified in Resend dashboard)
 * - Personal account (e.g. gmail.com)       → SMTP via nodemailer + app password
 *
 * Falls back to the global Resend default if fromEmail is not supplied.
 *
 * @param {string}      to            - Recipient email address
 * @param {string}      subject       - Email subject line
 * @param {string}      text          - Plain-text email body
 * @param {string|null} fromEmail     - Sender address from workspace config (optional)
 * @param {string|null} smtpPassword  - App password, required only for SMTP providers
 * @param {string|null} html          - Rich HTML body
 */
const sendEmail = async (to, subject, text, fromEmail = null, smtpPassword = null, html = null) => {
    // 🚨 TEST MODE Interceptor
    const IS_TEST = (process.env.TEST_MODE || '').trim().toLowerCase() === 'true';
    if (IS_TEST) {
        if (!process.env.TEST_EMAIL) {
            throw new Error("SECURITY HALT: TEST_MODE is enabled but TEST_EMAIL is missing in .env. Outreach aborted to prevent real-time delivery.");
        }
        const originalTo = to;
        if (to !== process.env.TEST_EMAIL) {
            to = process.env.TEST_EMAIL;
            subject = `[TEST REDIRECT FROM ${originalTo}] ${subject}`;
            console.log(`🚨 [TEST MODE] Intercepted email to ${originalTo}. Redirecting to ${to}`);
        }
    }

    const provider = detectProvider(fromEmail, smtpPassword);
    try {
        if (provider === 'smtp') {
            if (!smtpPassword) {
                console.warn(`[Email] SMTP password missing for ${fromEmail}. Falling back to default system Resend email.`);
                return await _sendViaResend(to, subject, text, null, html);
            }
            return await _sendViaSMTP(to, subject, text, fromEmail, smtpPassword, html);
        }
        return await _sendViaResend(to, subject, text, fromEmail, html);
    } catch (err) {
        console.error(`[Email] Failed to send to ${to}:`, err.message);
        throw err;
    }
};

module.exports = { sendEmail };
