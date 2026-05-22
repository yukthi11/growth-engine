/**
 * PILLAR MESSAGES — Structured Outreach Library
 * -----------------------------------------------
 * Single source of truth for all outreach copy.
 * Every message is tied to a dominant gap "pillar" identified by the AI.
 *
 * Voice rules (non-negotiable):
 *   - Warm, friendly, like a salesman who genuinely cares
 *   - I saw you → you're doing well → I noticed one thing → here's what I do → payoff → who do I talk to?
 *   - No stats. No "research shows." No "however."
 *   - WhatsApp: conversational, short, like a real message
 *   - Email: same voice, just a little more room to breathe
 *   - Never sound like a bot. Never oversell.
 *
 * Supported Pillars: presence | reputation | automation | ads | chatbot | ota
 *
 * Placeholders:
 *   {{business_name}} — replaced at dispatch time
 *   {{location}}      — replaced at dispatch time (optional, safe to omit)
 *   {{mockup_url}}    — replaced at dispatch time (presence pillar only)
 */

const PILLAR_MESSAGES = {

    /**
     * Pillar: PRESENCE
     * Triggered by: noWebsite, brokenWebsite, slowWebsite, noSSL, noSchema, missingGBPFields
     */
    presence: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed you don't have a website yet, so I went ahead and put together a quick preview of what one could look like for you. You can check it out here {{mockup_url}} Having a strong digital foundation built with solid SEO principles positions you at the top when people are searching for your services. It’s the easiest way to turn online searches into paying customers on autopilot. Could you point me to the right person for this?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and I have to say, it looks like you're doing some genuinely great work.

I noticed you don't have a website up yet, so I went ahead and put together a quick preview of what one could look like for your business. You can view it here {{mockup_url}}

It's just a starting point, but having a proper digital foundation built with strong SEO principles positions you as the clear choice in your area. Long term, this means you start ranking at the top of local searches and capturing leads naturally, creating a steady, predictable flow of new business that works for you in the background.

I'd love to build this out properly for you if it feels right.

Could you point me to the right person to have a quick chat?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Pillar: REPUTATION
     * Triggered by: fewReviews, lowRating
     */
    reputation: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed your reviews don't quite reflect that yet, and I can help set up a simple system that automatically collects feedback from your happy customers. That way, new people finding you online get the full picture. Could you point me to the right person for this?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and genuinely, it looks like you're doing some great work.

One thing I noticed is that your reviews don't quite reflect the quality you're putting out. Most people check Google before deciding where to go, so when the review count is low it can make them hesitant, even when the actual experience is great.

I help businesses set up a simple automated system that collects reviews from happy customers after every visit or job. No chasing, no awkward asks. It just runs quietly and builds up over time.

Could you point me to the right person to have a quick chat about this?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Pillar: AUTOMATION
     * Triggered by: noWhatsApp, noBookingSystem, noEmailCapture, noLeadForm
     */
    automation: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed it takes a little while to get back to customers, and I can help set up a WhatsApp automation that responds instantly, 24/7. That way your enquiries have a much better chance of converting into actual clients. Could you point me to the right person for this?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and it looks like you're doing some great work.

I noticed it takes a little while to get back to customers on enquiries. Totally understandable when you're running a busy operation. The tricky part is that people searching online tend to reach out to a few places at once, and usually go with whoever gets back to them first.

I help businesses set up WhatsApp automations that respond to enquiries instantly, around the clock. Your customers get an answer right away, and you're not glued to your phone. The leads that were quietly slipping through start converting instead.

Could you point me to the right person to have a quick chat about this?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Pillar: ADS / SOCIAL
     * Triggered by: inactiveSocial
     */
    ads: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed your social media has been a little quiet lately, and I can help get that going again with consistent content and local ads targeted at people in {{location}}. More people seeing what you do means more people walking through the door. Could you point me to the right person for this?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and it looks like you're doing some great work.

I noticed your social media has been a little quiet lately. It's one of those things that's easy to let slide when you're busy running the actual business. It does mean you're missing out on people in {{location}} who would genuinely love what you offer, they just haven't come across you yet.

I help businesses handle their social content and local ads end to end, so you're consistently showing up in front of the right people without it taking up your time.

Could you point me to the right person to have a quick chat about this?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Pillar: CHATBOT
     * Triggered by: noChat
     */
    chatbot: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I know how busy things get running the day-to-day, so I wanted to reach out. I help businesses set up a simple WhatsApp assistant to handle common customer questions and bookings automatically. It takes the pressure off your phone and makes sure your customers always feel taken care of instantly. Could you point me to the right person to see if this might be a helpful fit?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and I have to say, it looks like you're doing some genuinely great work.

I know how incredibly busy it gets running the day-to-day operations. Answering the same routine customer questions about pricing or availability can sometimes pull you away from the actual work you're trying to do. 

I help businesses set up simple, friendly WhatsApp chatbots that handle those routine questions and bookings automatically. It’s essentially like having an extra team member working 24/7. Your customers always get looked after instantly, and you get to focus entirely on running the business without constantly checking your phone.

I really love helping local brands grow, and I think this could take a lot of pressure off your team. 

Could you point me to the right person to have a quick, no-pressure chat about this?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Pillar: OTA / PLATFORM PRESENCE
     * Triggered by: notOnAirbnb, notOnBookingCom, notOnMakeMyTrip
     */
    ota: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like a wonderful place. I noticed you're not listed on platforms like Airbnb or Booking.com yet. There's a whole set of travellers searching for stays in {{location}} on those apps who simply won't find you right now. I help properties get listed and set up properly on these platforms. Could you point me to the right person for this?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and it looks like a wonderful place.

I noticed you're not listed on platforms like Airbnb or Booking.com yet. The thing is, a lot of travellers planning trips to {{location}} search exclusively on those apps and never even get to Google. So right now, that's an entire group of potential guests who have no way of finding you.

I help properties get listed and set up properly on these platforms with the right photos, pricing structure, and listing copy, so you start showing up where those travellers are actually looking.

Could you point me to the right person to have a quick chat about this?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
        }
    },

    /**
     * Fallback — used when no dominant pillar is identified
     */
    default: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I help local businesses in {{location}} grow their digital presence in ways that quietly work for them in the background, bringing in more visibility and enquiries without adding to your plate. Could you point me to the right person for a quick chat?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and it looks like you're doing some great work.

I help local businesses in {{location}} strengthen their digital presence with websites, automations, reviews, social media, and more. Nothing overwhelming, just the right things set up properly so your business keeps growing without you having to constantly push it.

Could you point me to the right person to have a quick chat?

Thanks,
Yukthi
+91 9108641490
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">reviveyourbusiness.in</a>`
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
 * @param {object} [extraData] - Additional placeholder values (e.g. mockup_url)
 * @returns {{ whatsapp: string, email: { subject: string, body: string } }}
 */
function resolveOutreachByPillar(pillar, businessName, location = '', extraData = {}) {
    const template = PILLAR_MESSAGES[pillar] || PILLAR_MESSAGES.default;

    const replacements = {
        business_name: businessName || 'your business',
        location: location || 'your area',
        ...extraData
    };

    const inject = (str) => str.replace(/{{(\w+)}}/g, (_, key) => replacements[key] || `{{${key}}}`);

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