import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000';

const client = axios.create({
    baseURL: API_BASE_URL,
});

export const getCompanies = async () => {
    const response = await client.get('/companies');
    return response.data;
};

export const getCompany = async (id) => {
    const response = await client.get(`/companies/${id}`);
    return response.data;
};

export const createCompany = async (data) => {
    const response = await client.post('/companies', data);
    return response.data;
};

export const updateCompany = async (id, data) => {
    const response = await client.patch(`/companies/${id}`, data);
    return response.data;
};

export const getCompanyStats = async (id) => {
    const response = await client.get(`/companies/${id}/stats`);
    return response.data;
};

export const getGeoStats = async (id) => {
    const response = await client.get(`/companies/${id}/geo-stats`);
    return response.data;
};

export const getLeads = async (companyId, page = 1, limit = 20, campaignId = null, search = '') => {
    const response = await client.get('/leads', {
        params: {
            company_id: companyId,
            page,
            limit,
            campaign_id: campaignId,
            search
        },
    });
    return response.data;
};

export const createLead = async (data) => {
    const response = await client.post('/leads', data);
    return response.data;
};

export const updateLead = async (id, data) => {
    const response = await client.patch(`/leads/${id}`, data);
    return response.data;
};

export const deleteLead = async (id) => {
    const response = await client.delete(`/leads/${id}`);
    return response.data;
};

// --- Campaign Methods ---

export const getCampaigns = async (companyId) => {
    const response = await client.get('/campaigns', {
        params: { company_id: companyId }
    });
    return response.data;
};

export const createCampaign = async (data) => {
    const response = await client.post('/campaigns', data);
    return response.data;
};

export const deleteCampaign = async (id) => {
    const response = await client.delete(`/campaigns/${id}`);
    return response.data;
};

export const updateCampaign = async (id, data) => {
    const response = await client.patch(`/campaigns/${id}`, data);
    return response.data;
};

export const sendCampaignOutreach = async (campaignId, channel, companyId) => {
    const response = await client.post(`/campaigns/${campaignId}/bulk-send`, {
        channel,
        companyId
    });
    return response.data;
};

export const getOutreachProgress = async (campaignId) => {
    const response = await client.get(`/campaigns/${campaignId}/outreach-progress`);
    return response.data;
};

export const getOutreachSummary = async (campaignId) => {
    const response = await client.get(`/campaigns/${campaignId}/outreach-summary`);
    return response.data;
};

// --- Discovery Methods ---

export const runDiscovery = async (data, signal = null) => {
    const response = await client.post('/discovery/run', data, { signal });
    return response.data;
};

export const runDiscoveryBatch = async (data) => {
    const response = await client.post('/discovery/queue', data);
    return response.data;
};

export const cancelDiscovery = async (companyId) => {
    const response = await client.post(`/discovery/stop/${companyId}`);
    return response.data;
};

export const getDiscoveryQueue = async (companyId) => {
    const response = await client.get(`/discovery/queue/${companyId}`);
    return response.data;
};

// --- Message Methods ---

export const getMessages = async (leadId) => {
    const response = await client.get('/messages', {
        params: { lead_id: leadId }
    });
    return response.data;
};

export const createMessage = async (data) => {
    const response = await client.post('/messages', data);
    return response.data;
};

// --- Reply & Sequence Methods ---

export const getReplies = async (companyId) => {
    const response = await client.get('/replies', { params: { company_id: companyId } });
    return response.data;
};

export const getSequenceSteps = async (campaignId) => {
    const response = await client.get(`/campaigns/${campaignId}/steps`);
    return response.data;
};

export const createSequenceStep = async (campaignId, data) => {
    const response = await client.post(`/campaigns/${campaignId}/steps`, data);
    return response.data;
};

// --- Export Methods ---

export const getPendingReplies = async (companyId) => {
    const response = await client.get('/replies', { params: { status: 'pending', company_id: companyId } });
    return response.data;
};

export const getLeadThread = async (leadId) => {
    const response = await client.get(`/replies/thread/${leadId}`);
    return response.data;
};

export const suggestReply = async (leadId, replyText) => {
    const response = await client.post(`/leads/${leadId}/suggest-reply`, { replyText });
    return response.data;
};

export const generateMockup = async (leadId) => {
    const response = await client.post(`/leads/${leadId}/generate-mockup`);
    return response.data;
};

export const draftEmail = async (leadId) => {
    const response = await client.post(`/leads/${leadId}/draft-email`);
    return response.data;
};

export const sendManualReply = async (leadId, message, channel = 'whatsapp', subject = null, mediaUrl = null) => {
    const response = await client.post(`/replies/manual-reply/${leadId}`, { message, channel, subject, mediaUrl });
    return response.data;
};

export const syncCampaignToSheets = async (companyId, campaignId) => {
    const response = await client.post('/leads/sync-campaign', { companyId, campaignId });
    return response.data;
};

export const syncWorkspaceToSheets = async (companyId) => {
    const response = await client.post(`/companies/${companyId}/sync`);
    return response.data;
};

export const generateProposal = async (data) => {
    const response = await client.post('/proposals/generate', data);
    return response.data;
};

export const getProposalAutofill = async (leadId) => {
    const response = await client.get(`/proposals/autofill/${leadId}`);
    return response.data;
};

export default client;
