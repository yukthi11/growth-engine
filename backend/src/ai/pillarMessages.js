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
            body: `Hi,

I came across {{business_name}} recently and it genuinely looks like you're building something great.

While going through your online presence, I had a few ideas that could help better showcase the quality of what you already offer and make it easier for potential customers to discover you online.

I actually put together a quick preview to illustrate what I mean:
{{mockup_url}}

Small improvements to the digital experience can quietly make a big difference in how confidently customers choose a business.

Thought it might be helpful to share.

Happy to walk you through a few ideas if you're interested.

Yukthi
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">Revive Technology</a>`
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
            body: `Hi,

I came across {{business_name}} recently and honestly, it looks like you're doing great work.

I had a thought while looking through your online presence. I feel like the experience customers probably have with your business could be showcased even more strongly online.

For many customers, reviews are the thing that gives them the confidence to reach out or visit in the first place. Businesses that consistently surface positive customer experiences tend to build trust much faster over time.

There are a few simple ways to encourage more of those happy customer experiences to naturally show up online without it feeling forced or awkward.

Thought it might be worth sharing a few ideas around this.

Yukthi
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">Revive Technology</a>`
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
            body: `Hi,

I came across {{business_name}} recently and it looks like you're doing some really good work.

One thing I noticed is that there may be an opportunity to make customer enquiries and bookings feel even smoother on the online side.

A lot of businesses are now putting simple systems in place that instantly handle common customer questions and enquiries, especially after business hours, so potential customers never feel left waiting.

The businesses doing this well tend to create a much smoother customer experience while also taking pressure off the team internally.

I think something like this could work really nicely for your business.

Happy to share a few ideas if you'd like.

Yukthi
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">Revive Technology</a>`
        }
    },

    /**
     * Pillar: ADS / SOCIAL
     * Triggered by: inactiveSocial
     */
    ads: {
        whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I had a quick look at your online presence, and I see a huge opportunity to bring in more local customers in {{location}} using consistent social media updates and targeted local ads. I help businesses handle their social content and run high-converting local ads end-to-end so you consistently show up in front of the right people. Could you point me to the right person for a quick chat?`,

        email: {
            subject: `Quick note about {{business_name}}`,
            body: `Hi there,

I'm Yukthi. I came across {{business_name}} on Google and it looks like you're doing some great work.

I was looking at your online presence and wanted to reach out. For many local businesses, having a highly active, fully optimized social media footprint and running targeted local ads is the single fastest way to attract new customers in {{location}} on autopilot. 

I help businesses handle their social media content, profile optimization, and local advertising end-to-end, so you consistently stay top-of-mind for customers in your area without it taking up your time.

Could you point me to the right person to have a quick, no-pressure chat about this?

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
    let template = PILLAR_MESSAGES[pillar] || PILLAR_MESSAGES.default;

    // Handle presence adaptive copy
    if (pillar === 'presence') {
        const noWebsite = extraData.noWebsite !== false; // Default to true (legacy/fallback if not provided)
        if (!noWebsite) {
            // Adaptive copy for when they HAVE a website but it has issues (broken, missing SSL, slow, etc.)
            template = {
                whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed your website has a few issues loading or displaying properly, so I went ahead and put together a quick preview of how a modern, high-performing version could look for you. You can check it out here {{mockup_url}} Having a strong, secure digital foundation built with solid SEO principles ensures your business stays at the top of local searches. Could you point me to the right person for this?`,
                email: {
                    subject: `Improving the digital experience for {{business_name}}`,
                    body: `Hi,

I came across {{business_name}} recently and it genuinely looks like you're building something great.

While going through your online presence, I noticed a few technical issues with your website (like security and page load speed) that might be making it harder for potential customers to confidently choose you.

I actually put together a quick, modern preview to show how a secure, high-performing version could look:
{{mockup_url}}

Small improvements to the digital experience can quietly make a big difference in how confidently customers choose a business.

Thought it might be helpful to share.

Happy to walk you through a few ideas if you're interested.

Yukthi
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">Revive Technology</a>`
                }
            };
        }
    }

    // Handle automation adaptive copy
    if (pillar === 'automation') {
        const noWhatsApp = extraData.noWhatsApp !== false; // Default to true (legacy/fallback if not provided)
        if (!noWhatsApp) {
            // Adaptive copy for when they ALREADY have WhatsApp, but lack lead/booking forms on website
            template = {
                whatsapp: `Hi, I'm Yukthi! I came across {{business_name}} on Google and it looks like you're doing some great work. I noticed you have WhatsApp setup, but you might be missing out on automated lead forms and booking capture on your website to automatically collect customer info 24/7. I can help set up an instant booking capture system that seamlessly connects with your existing setup. Could you point me to the right person for this?`,
                email: {
                    subject: `Smooth booking capture for {{business_name}}`,
                    body: `Hi,

I came across {{business_name}} recently and it looks like you're doing some really good work.

One thing I noticed is that while you have a WhatsApp contact link, there may be an opportunity to make customer lead capture and bookings feel even smoother on your website.

A lot of businesses are now putting simple automated capture systems in place that instantly save lead details and enquiries, especially after business hours, so potential customers never feel left waiting.

I think something like this could work really nicely alongside your existing WhatsApp setup.

Happy to share a few ideas if you'd like.

Yukthi
<a href="https://reviveyourbusiness.in/companies/revive-technology/" target="_blank" rel="noopener noreferrer">Revive Technology</a>`
                }
            };
        }
    }

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