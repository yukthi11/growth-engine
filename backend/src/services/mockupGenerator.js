/**
 * Mockup Generator Service
 * Renders a lead's business as a 1200×630px PNG using node-html-to-image.
 *
 * @param {object} lead  - { id, business_name, category, location }
 * @returns {Promise<Buffer|null>}
 */

'use strict';

const { readFileSync } = require('fs');
const path = require('path');
const nodeHtmlToImage = require('node-html-to-image');
const CATEGORY_CONFIG = require('../mockups/categoryConfig');

const TEMPLATE_PATH = path.join(__dirname, '../mockups/template.html');

// Cache template in memory — file is read once per process
let _templateCache = null;
function getTemplate() {
  if (!_templateCache) {
    _templateCache = readFileSync(TEMPLATE_PATH, 'utf8');
  }
  return _templateCache;
}

async function generateMockup(lead) {
  try {
    const config = CATEGORY_CONFIG[lead.category] ?? CATEGORY_CONFIG.generic;
    const template = getTemplate();

    const html = template
      .replace('{{CATEGORY_CONFIG}}', JSON.stringify(config))
      .replace(/\{\{business_name\}\}/g, lead.business_name || 'Business')
      .replace(/\{\{location\}\}/g, lead.location || '');

    const buffer = await nodeHtmlToImage({
      html,
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      width : 1200,
      height: 630,
      type  : 'png',
    });

    return buffer;
  } catch (err) {
    console.error(`[mockupGenerator] Failed for lead "${lead?.id}":`, err.message);
    return null;
  }
}

module.exports = { generateMockup };
