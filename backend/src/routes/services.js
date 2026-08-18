const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const UPDATABLE_FIELDS = ['category', 'name', 'description', 'base_price', 'monthly_price', 'price_type', 'gap_tags', 'is_active', 'sort_order'];

/**
 * Helper to handle database errors (DRY).
 */
const handleDBError = (res, err, message = 'Database operation failed') => {
    console.error(`[Services DB Error]: ${err.message}`, err);
    return res.status(500).json({ error: message });
};

/**
 * 1. GET /services
 * Returns the full catalog, grouped by category, ordered for display.
 * Query: ?includeInactive=true to include disabled services (admin view).
 */
router.get('/', async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';

    try {
        const result = await pool.query(
            `SELECT * FROM services
             ${includeInactive ? '' : 'WHERE is_active = TRUE'}
             ORDER BY category, sort_order, name`
        );

        const grouped = result.rows.reduce((acc, service) => {
            acc[service.category] = acc[service.category] || [];
            acc[service.category].push(service);
            return acc;
        }, {});

        res.json({ services: result.rows, byCategory: grouped });
    } catch (err) {
        return handleDBError(res, err, 'Failed to fetch service catalog');
    }
});

/**
 * 2. POST /services
 * Adds a new catalog entry (custom offering not in the base price sheet).
 */
router.post('/', async (req, res) => {
    const { category, name, description, base_price, monthly_price, price_type, gap_tags, sort_order } = req.body;

    if (!category || !name) {
        return res.status(400).json({ error: 'category and name are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO services (category, name, description, base_price, monthly_price, price_type, gap_tags, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                category,
                name.trim(),
                description || null,
                base_price ?? null,
                monthly_price ?? null,
                price_type || 'one_time',
                gap_tags || [],
                sort_order ?? 0,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation on name
            return res.status(409).json({ error: `A service named "${name}" already exists` });
        }
        return handleDBError(res, err, 'Failed to create service');
    }
});

/**
 * 3. PATCH /services/:id
 * Edits any subset of catalog fields — this is how base prices get customized
 * from the seeded defaults without touching code.
 */
router.patch('/:id', async (req, res) => {
    const { id } = req.params;

    const updates = [];
    const values = [];

    for (const field of UPDATABLE_FIELDS) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${values.length + 1}`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    try {
        const result = await pool.query(
            `UPDATE services SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        return handleDBError(res, err, 'Failed to update service');
    }
});

/**
 * 4. DELETE /services/:id
 * Soft-deletes by default (is_active = false) so past proposals that
 * reference this service keep displaying correctly. Pass ?hard=true to
 * actually remove the row (only safe if never used in a proposal).
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const hard = req.query.hard === 'true';

    try {
        const result = hard
            ? await pool.query('DELETE FROM services WHERE id = $1 RETURNING *', [id])
            : await pool.query('UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ success: true, deleted: result.rows[0] });
    } catch (err) {
        return handleDBError(res, err, 'Failed to delete service');
    }
});

module.exports = router;
