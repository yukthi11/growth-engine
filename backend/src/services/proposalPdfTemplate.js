/**
 * Shared premium PDF template for the Proposal Writer.
 * Both the fixed-format (AI-structured) and freeform (manual) proposal
 * modes render through the same header/footer shell and base typography
 * so every exported document looks consistent and professional.
 */

'use strict';

const escapeHtml = (str = '') =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

// Shared body styling — loaded once via page.setContent(), applies to both modes.
const BASE_STYLE = `
    * { box-sizing: border-box; }
    body {
        margin: 0;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #1c1c22;
        background: #ffffff;
        font-size: 11.5px;
        line-height: 1.6;
    }
    h1, h2, h3, h4 {
        font-family: Georgia, 'Times New Roman', serif;
        margin: 0;
        color: #14141a;
    }
    .cover {
        min-height: 620px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
        padding: 12px 4px 0;
    }
    .cover .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #4338ca;
    }
    .cover h1 {
        font-size: 34px;
        font-weight: 700;
        line-height: 1.15;
        margin-top: 14px;
        letter-spacing: -0.01em;
    }
    .cover .headline {
        font-size: 15px;
        font-style: italic;
        color: #4338ca;
        margin-top: 16px;
        max-width: 80%;
    }
    .cover .meta-row {
        display: flex;
        justify-content: space-between;
        border-top: 1px solid #e5e5ea;
        padding-top: 14px;
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b6b76;
    }
    section {
        margin-bottom: 30px;
        page-break-inside: avoid;
    }
    .section-label {
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #4338ca;
        display: block;
        margin-bottom: 4px;
    }
    .section-title {
        font-size: 19px;
        font-weight: 700;
        margin-bottom: 12px;
    }
    .section-rule {
        border: none;
        border-top: 1px solid #e5e5ea;
        margin: 0 0 16px;
    }
    p { margin: 0 0 10px; color: #3a3a44; }
    .metrics {
        display: flex;
        gap: 14px;
        margin-top: 16px;
    }
    .metric {
        flex: 1;
        border: 1px solid #eceef3;
        background: #faf9fc;
        border-radius: 10px;
        padding: 14px 10px;
        text-align: center;
    }
    .metric .value {
        font-size: 20px;
        font-weight: 700;
        color: #4338ca;
    }
    .metric .label {
        font-size: 8.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b6b76;
        margin-top: 4px;
    }
    .helps-block {
        border: 1px solid #eceef3;
        background: #faf9fc;
        border-radius: 10px;
        padding: 16px 18px;
        margin-bottom: 12px;
        page-break-inside: avoid;
    }
    .helps-block h4 {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 10px;
    }
    .helps-item { margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #e5e5ea; }
    .helps-item:last-child { margin-bottom: 0; }
    .helps-item strong { display: block; color: #1c1c22; font-size: 11px; }
    .helps-item span { color: #55555f; font-size: 10.5px; }
    .two-col { display: flex; gap: 30px; }
    .two-col > div { flex: 1; }
    ul.deliverables { margin: 0; padding-left: 16px; }
    ul.deliverables li { margin-bottom: 6px; color: #3a3a44; }
    .timeline-item { position: relative; padding-left: 16px; border-left: 2px solid #e5e5ea; margin-bottom: 14px; }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-item::before {
        content: '';
        position: absolute;
        left: -5px; top: 3px;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #4338ca;
    }
    .timeline-item strong { display: block; font-size: 11px; color: #1c1c22; }
    .timeline-item span { font-size: 10.5px; color: #55555f; }
    table.investment { width: 100%; border-collapse: collapse; border: 1px solid #eceef3; border-radius: 10px; overflow: hidden; }
    table.investment thead th {
        background: #f4f4f8;
        text-align: left;
        font-size: 8.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b6b76;
        padding: 10px 12px;
        border-bottom: 1px solid #eceef3;
    }
    table.investment td {
        padding: 10px 12px;
        font-size: 10.5px;
        border-bottom: 1px solid #f0f0f4;
        color: #3a3a44;
    }
    table.investment td:first-child { font-weight: 700; color: #1c1c22; }
    table.investment td:last-child { text-align: right; font-weight: 700; color: #4338ca; }
    .summary-box {
        margin-top: 14px;
        border: 1px solid #eceef3;
        background: #faf9fc;
        border-radius: 10px;
        padding: 16px 18px;
    }
    .summary-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 6px 0; color: #3a3a44; }
    .summary-row.total { border-bottom: 1px solid #eceef3; margin-bottom: 4px; padding-bottom: 10px; font-size: 12px; font-weight: 700; color: #1c1c22; }
    .summary-row.total .amount { color: #4338ca; font-size: 15px; }
    .summary-row span:last-child { font-weight: 700; color: #1c1c22; }
    .freeform-body { font-size: 11.5px; color: #1c1c22; }
    .freeform-body h1, .freeform-body h2, .freeform-body h3 { margin: 18px 0 8px; }
    .freeform-body p { margin: 0 0 10px; }
    .freeform-body ul, .freeform-body ol { margin: 0 0 10px 18px; }
`;

function renderCover(proposal, meta) {
    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
    <div class="cover">
        <div>
            <span class="eyebrow">${escapeHtml(proposal.cover_page?.category_name || 'Business Proposal')}</span>
            <h1>${escapeHtml(proposal.cover_page?.project_name || meta.projectName || '')}</h1>
            <p class="headline">"${escapeHtml(proposal.cover_page?.headline || '')}"</p>
        </div>
        <div class="meta-row">
            <span>Prepared For: ${escapeHtml(meta.businessName || '')}</span>
            <span>Date: ${escapeHtml(date)}</span>
        </div>
    </div>`;
}

function renderFixedBody(proposal, meta) {
    const benefits = (proposal.key_benefits || []).map((m) => `
        <div class="metric">
            <div class="value">${escapeHtml(m.value)}</div>
            <div class="label">${escapeHtml(m.label)}</div>
        </div>`).join('');

    const helps = (proposal.how_it_helps || []).map((section) => `
        <div class="helps-block">
            <h4>${escapeHtml(section.section_name)}</h4>
            ${(section.items || []).map((item) => `
                <div class="helps-item">
                    <strong>${escapeHtml(item.feature)}</strong>
                    <span>${escapeHtml(item.benefit)}</span>
                </div>`).join('')}
        </div>`).join('');

    const deliverables = (proposal.deliverables || []).map((d) => `<li>${escapeHtml(d)}</li>`).join('');

    const timeline = (proposal.timeline || []).map((step) => `
        <div class="timeline-item">
            <strong>${escapeHtml(step.phase)}</strong>
            <span>${escapeHtml(step.description)}</span>
        </div>`).join('');

    const investmentRows = (proposal.investment || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.milestone_name)}</td>
            <td>${escapeHtml(item.project_scope)}</td>
            <td>${escapeHtml(item.amount)}</td>
        </tr>`).join('');

    const fs = proposal.final_summary || {};

    return `
    ${renderCover(proposal, meta)}

    <section>
        <span class="section-label">01 / Challenge</span>
        <h2 class="section-title">Problem Overview</h2>
        <hr class="section-rule" />
        <p>${escapeHtml(proposal.problem_overview?.description || '')}</p>
        <div class="metrics">${benefits}</div>
    </section>

    <section>
        <span class="section-label">02 / Architecture</span>
        <h2 class="section-title">How This Solution Helps</h2>
        <hr class="section-rule" />
        ${helps}
    </section>

    <section>
        <div class="two-col">
            <div>
                <span class="section-label">Scope</span>
                <h2 class="section-title" style="font-size:15px;">Deliverables</h2>
                <ul class="deliverables">${deliverables}</ul>
            </div>
            <div>
                <span class="section-label">Delivery</span>
                <h2 class="section-title" style="font-size:15px;">Expected Timeline</h2>
                ${timeline}
            </div>
        </div>
    </section>

    <section>
        <span class="section-label">03 / Financial Investment</span>
        <h2 class="section-title">Investment Summary</h2>
        <hr class="section-rule" />
        <table class="investment">
            <thead>
                <tr><th>Milestone</th><th>Project Scope</th><th style="text-align:right;">Amount</th></tr>
            </thead>
            <tbody>${investmentRows}</tbody>
        </table>
        <div class="summary-box">
            <div class="summary-row total">
                <span>Total Investment</span>
                <span class="amount">${escapeHtml(fs.total_investment || '')}</span>
            </div>
            <div class="summary-row"><span>Payment Structure</span><span>${escapeHtml(fs.payment_structure || '')}</span></div>
            <div class="summary-row"><span>Support Included</span><span>${escapeHtml(fs.support_included || '')}</span></div>
            <div class="summary-row"><span>Expected Delivery</span><span>${escapeHtml(fs.expected_delivery || '')}</span></div>
        </div>
    </section>`;
}

function renderFreeformBody(bodyHtml, meta, coverTitle) {
    // bodyHtml comes from the Quill editor (already-sanitized HTML on the frontend);
    // it is trusted the same way the rest of the app trusts operator-authored content.
    const cover = renderCover(
        { cover_page: { category_name: 'Custom Proposal', project_name: coverTitle || meta.projectName, headline: '' } },
        meta
    );
    return `${cover}<section><div class="freeform-body">${bodyHtml}</div></section>`;
}

function wrapFullDocument(bodyHtml) {
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <style>${BASE_STYLE}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function buildHeaderTemplate({ logoDataUri, companyName }) {
    const logo = logoDataUri
        ? `<img src="${logoDataUri}" style="height:20px;width:auto;" />`
        : `<span style="font-weight:700;">${escapeHtml(companyName || '')}</span>`;
    return `
    <div style="width:100%; font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #6b6b76; padding: 0 32px; display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid #e5e5ea; padding-bottom: 6px;">
        <div style="display:flex; align-items:center; gap:8px;">
            ${logo}
            <span style="font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">${escapeHtml(companyName || '')}</span>
        </div>
        <span style="text-transform:uppercase; letter-spacing:0.1em;">Proposal</span>
    </div>`;
}

function buildFooterTemplate({ confidentialityNote }) {
    return `
    <div style="width:100%; font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: #8a8a94; padding: 6px 32px 0; display:flex; align-items:center; justify-content:space-between; border-top: 1px solid #e5e5ea;">
        <span>${escapeHtml(confidentialityNote || '')}</span>
        <span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>
    </div>`;
}

module.exports = {
    wrapFullDocument,
    renderFixedBody,
    renderFreeformBody,
    buildHeaderTemplate,
    buildFooterTemplate,
};
