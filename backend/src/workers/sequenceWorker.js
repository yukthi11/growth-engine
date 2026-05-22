const { Worker, Queue } = require('bullmq');
const { connection } = require('../config/redis');
const pool = require('../config/db');

// Queues to delegate specialized tasks
const sequenceQueue = new Queue('sequenceQueue', { connection });
const emailQueue = new Queue('emailQueue', { connection });
const whatsappQueue = new Queue('whatsappQueue', { connection });

const sequenceWorker = new Worker(
    'sequenceQueue',
    async (job) => {
        // 0. Automation Master Switch Check
        if (process.env.ENABLE_AUTOMATION === 'false') {
            console.log('⛔ [Automation Paused] ENABLE_AUTOMATION is false. Skipping job...');
            // We throw an error to let BullMQ retry later when we flip it back on
            throw new Error('Automation is manually paused');
        }

        const { enrollmentId } = job.data;
        console.log(`[Sequence] Orchestrating enrollment: ${enrollmentId}`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const enrollmentRes = await client.query(`
                SELECT e.*, l.email_address, l.phone, l.business_name, l.contact_name, l.is_blacklisted,
                       c.email as company_email, c.smtp_password
                FROM lead_enrollments e
                JOIN leads l ON e.lead_id = l.id
                JOIN companies c ON l.company_id = c.id
                WHERE e.id = $1 AND e.status = 'active'
            `, [enrollmentId]);

            if (enrollmentRes.rows.length === 0 || enrollmentRes.rows[0].is_blacklisted) {
                console.log(`[Sequence] Stopped for enrollment ${enrollmentId} (Status: ${enrollmentRes.rows[0]?.status}, Blacklisted: ${enrollmentRes.rows[0]?.is_blacklisted})`);
                await client.query('ROLLBACK');
                return;
            }

            const enrollment = enrollmentRes.rows[0];
            const stepRes = await client.query(`
                SELECT * FROM sequence_steps
                WHERE campaign_id = $1 AND step_order = $2
            `, [enrollment.campaign_id, enrollment.current_step_order]);

            if (stepRes.rows.length === 0) {
                await client.query("UPDATE lead_enrollments SET status = 'completed' WHERE id = $1", [enrollmentId]);
                await client.query('COMMIT');
                return;
            }

            const currentStep = stepRes.rows[0];

            // 1. Create message record in 'pending' status
            const messageRes = await client.query(`
                INSERT INTO messages (lead_id, campaign_id, channel, message_text, status)
                VALUES ($1, $2, $3, $4, 'pending')
                RETURNING id
            `, [enrollment.lead_id, enrollment.campaign_id, currentStep.type, currentStep.body]);
            
            const messageId = messageRes.rows[0].id;

            // 2. Delegate to specialized worker
            if (currentStep.type === 'email' && enrollment.email_address) {
                await emailQueue.add(`email-${messageId}`, {
                    messageId,
                    email: enrollment.email_address,
                    subject: currentStep.subject || 'Automated Outreach',
                    message: currentStep.body,
                    leadData: { business_name: enrollment.business_name, contact_name: enrollment.contact_name },
                    companyEmail: enrollment.company_email,
                    smtpPassword: enrollment.smtp_password
                });
            } else if (currentStep.type === 'whatsapp' && enrollment.phone) {
                await whatsappQueue.add(`whatsapp-${messageId}`, {
                    messageId,
                    phone: enrollment.phone,
                    message: currentStep.body,
                    leadData: { business_name: enrollment.business_name, contact_name: enrollment.contact_name }
                });
            }

            // 3. Schedule next step
            const nextStepRes = await client.query(`
                SELECT delay_days FROM sequence_steps
                WHERE campaign_id = $1 AND step_order = $2
            `, [enrollment.campaign_id, enrollment.current_step_order + 1]);

            let newStatus = 'completed';
            let nextRunAt = null;

            if (nextStepRes.rows.length > 0) {
                const nextDelay = nextStepRes.rows[0].delay_days || 0;
                const delayMs = nextDelay * 24 * 60 * 60 * 1000;
                nextRunAt = new Date(Date.now() + delayMs);
                newStatus = 'active';

                await sequenceQueue.add(`enrollment-${enrollmentId}-step-${enrollment.current_step_order + 1}`,
                    { enrollmentId }, { delay: delayMs });
            }

            await client.query(`
                UPDATE lead_enrollments
                SET current_step_order = current_step_order + 1,
                    last_sent_at = NOW(),
                    next_run_at = $1,
                    status = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [nextRunAt, newStatus, enrollmentId]);

            await client.query('COMMIT');
            console.log(`[Sequence] Delegated step ${enrollment.current_step_order} to ${currentStep.type} queue`);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }, { connection }
);

module.exports = sequenceWorker;
