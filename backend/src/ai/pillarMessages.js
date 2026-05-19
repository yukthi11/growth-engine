/**
 * PILLAR MESSAGES — Structured Outreach Library
 * -----------------------------------------------
 * Single source of truth for all outreach copy.
 * Every message is tied to a dominant gap "pillar" identified by the AI.
 *
 * Voice rules (non-negotiable):
 *   - Always opens with: "Hi, I'm Yukthi! I came across {{business_name}} on Google."
 *   - Line 2: One specific problem. No fluff, no exaggeration.
 *   - Line 3: One line on what we do.
 *   - Line 4: Soft CTA — redirect to right person or short call.
 *   - WhatsApp: 4 lines max, conversational, no bullet points.
 *   - Email: Same voice, slightly more context, still short.
 *   - Never sound like a bot. Never oversell.
 *
 * Supported Pillars: presence | reputation | automation | ads | chatbot | ota
 *
 * Placeholders:
 *   {{business_name}} — replaced at dispatch time
 *   {{location}}      — replaced at dispatch time (optional, safe to omit)
 *
 * Rules:
 *   - WhatsApp messages must be < 300 characters (conversational, casual)
 *   - Email subjects must be < 60 characters
 *   - Email bodies should be plain-text friendly, under 150 words
 *   - Never change keys — they map directly to gapMapper PILLAR_MAPPING
 */

const PILLAR_MESSAGES = {

    /**
     * Pillar: PRESENCE
     * Triggered by: noWebsite, brokenWebsite, slowWebsite, noSSL, noSchema, missingGBPFields
     */
    presence: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed you don't have a website yet, which means a lot of people searching for a similar category online are ending up at your competitors instead. Can you please redirect me towards the right person for this. I went ahead and built a quick preview for you: {{mockup_url}}. It's a basic structure that we can work on based on your requirements.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `
            
            Greetings!

            I came across {{business_name}} on Google and wanted to reach out.

            I noticed you don't have a website yet. Most customers in {{location}} search online before deciding where to go. Without one, they're finding your competitors instead of you.

            I help local businesses get online quickly with a clean, professional website that brings in enquiries. I went ahead and built a quick preview of what a modern site for your business could look like:
            {{mockup_url}}

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Pillar: REPUTATION
     * Triggered by: fewReviews, lowRating
     */
    reputation: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed your reviews don't fully reflect the quality of your work. Most customers check ratings before visiting, so this could be quietly costing you new customers. I help businesses fix this automatically. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed your reviews don't fully reflect the quality of your work. Most people check Google ratings before visiting a local business. A low review count can cost you customers every week without you realising it.

I help businesses automatically collect more reviews from happy customers without any awkward follow-ups.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Pillar: AUTOMATION
     * Triggered by: noWhatsApp, noBookingSystem, noEmailCapture, noLeadForm
     */
    automation: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed there's no easy or instant way for customers to book or enquire online, which means you're likely missing leads outside business hours. I help businesses set up simple automations that capture enquiries 24/7. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed there's no easy or quick way for customers to book or enquire online. A lot of people search after hours and expect an immediate response for customer conversion. Without an automated system, those enquiries go unanswered and they move on to the next option.

I help businesses set up WhatsApp automations and booking flows that work around the clock.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Pillar: ADS / SOCIAL
     * Triggered by: inactiveSocial
     */
    ads: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed your social media hasn't been active recently. Consistent posting and local ads can make a big difference in getting found by new customers in {{location}}. I help businesses handle this end to end. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed your social media hasn't been active recently. In {{location}}, consistent posting and targeted local ads is one of the most effective ways to keep new customers discovering your business however it takes time and the right strategy to work.

I help businesses manage their social content and local ad campaigns so they can focus on running their business.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Pillar: CHATBOT
     * Triggered by: noChat
     */
    chatbot: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed there's no chat or automated response set up. Customers asking questions outside hours likely aren't getting replies, which can cost you bookings. I help businesses set up WhatsApp bots that handle this automatically. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed there's no chat or automated response set up on your end. Customers who ask questions and don't hear back quickly usually move on — especially for bookings and pricing queries.

I help businesses set up simple WhatsApp chatbots that answer FAQs and take bookings automatically, 24/7.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Pillar: OTA / PLATFORM PRESENCE
     * Triggered by: notOnAirbnb, notOnBookingCom, notOnMakeMyTrip
     */
    ota: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed you're not listed on platforms like Airbnb or Booking.com — a lot of travellers searching for stays in {{location}} won't find you through those channels. I help properties get listed and optimised on these platforms. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed you're not listed on platforms like Airbnb or Booking.com. A large number of travellers looking for stays in {{location}} search exclusively on these platforms — not being listed means they won't find you at all.

I help properties get set up and optimised on these platforms to increase occupancy.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    },

    /**
     * Fallback — used when no dominant pillar is identified
     */
    default: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google. I noticed a few things that could help you reach more customers online in {{location}}. I work with local businesses on their digital presence. Can you please redirect me towards the right person for this.`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `I came across {{business_name}} on Google and wanted to reach out.

I noticed a few areas where a small improvement could help you reach more customers in {{location}}, things most business owners don't get visibility on unless someone points it out.

I work with local businesses on their digital presence and growth.

Could you point me to the right person to have a quick conversation about this?

Thanks & Regards,
Yukthi
+91 9108641490`
        }
    }
};

/**
 * Resolves the correct structured outreach messages for a given pillar.
 * Injects business_name and optional location into all placeholders.
 *
 * @param {string} pillar - The dominant gap pillar (from gapMapper)
 * @param {string} businessName - The lead's business name
 * @param {string} [location] - Optional city/area for context
 * @returns {{ whatsapp: string, email: { subject: string, body: string } }}
 */
function resolveOutreachByPillar(pillar, businessName, location = '') {
    const template = PILLAR_MESSAGES[pillar] || PILLAR_MESSAGES.default;

    const inject = (str) =>
        str
            .replace(/{{business_name}}/g, businessName || 'your business')
            .replace(/{{location}}/g, location || 'your area');

    return {
        whatsapp: inject(template.whatsapp),
        email: {
            subject: inject(template.email.subject),
            body: inject(template.email.body)
        }
    };
}

module.exports = {
    PILLAR_MESSAGES,
    resolveOutreachByPillar
};