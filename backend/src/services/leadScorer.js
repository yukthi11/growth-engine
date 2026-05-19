/**
 * Lead Intelligence Scorer
 * Implements logic to score leads and categorize them based on visibility, footfall, and partnership signals.
 */

function extractFeatures(lead) {
  if (!lead) return { hasWebsite: false, hasInstagram: false, lowReviews: false, lowRating: false };
  return {
    hasWebsite: !!(lead.website && lead.website !== 'N/A'),
    hasInstagram: !!(lead.instagram_username || lead.instagram_handle),
    lowReviews: (lead.review_count || 0) < 20,
    lowRating: (lead.google_rating || 0) < 3.5
  }
}

function scoreLeadIntent(lead) {
  const f = extractFeatures(lead)
  const FOOTFALL_TYPES = ['cafe','salon','gym','restaurant','bakery','boutique','spa','store']
  const PARTNERSHIP_TYPES = ['travel','hotel','resort','activity','hostel','tour','homestay']

  const visibility_score =
    (!f.hasWebsite ? 2 : 0) +
    (!f.hasInstagram ? 2 : 0) +
    (f.lowReviews ? 1 : 0)

  const footfall_score =
    (FOOTFALL_TYPES.includes(lead.business_type?.toLowerCase()) ? 2 : 0) +
    (lead.location_type === 'physical_store' ? 2 : 0)

  const partnership_score =
    (PARTNERSHIP_TYPES.includes(lead.business_type?.toLowerCase()) ? 3 : 0)

  let primary_intent = 'visibility'
  if (footfall_score > visibility_score && footfall_score >= partnership_score) primary_intent = 'footfall'
  else if (partnership_score > visibility_score && partnership_score > footfall_score) primary_intent = 'partnership'

  let gap_pillar = null;
  if (!f.hasWebsite) gap_pillar = 'presence';

  return { 
    visibility_score, 
    footfall_score, 
    partnership_score, 
    primary_intent,
    gap_pillar
  }
}

module.exports = {
  scoreLeadIntent,
  extractFeatures
};
