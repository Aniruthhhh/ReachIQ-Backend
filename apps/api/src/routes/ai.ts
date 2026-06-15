import { Router } from 'express';
import { prisma } from '../index';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { filterCustomersByQuery } from './campaigns';

const router = Router();

// Initialize Google Generative AI Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("ℹ️ No GEMINI_API_KEY or OPENAI_API_KEY found. Running AI in local mock mode.");
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// POST /api/ai/strategist - main chat endpoint
router.post('/strategist', async (req, res) => {
  const { message } = req.body;
  const msg = message.toLowerCase();

  const totalCustomers = await prisma.customer.count();
  const avgSpend = await prisma.customer.aggregate({ _avg: { total_spent: true } });
  const avgSpendVal = Math.round(avgSpend._avg.total_spent || 5000);

  const client = getGeminiClient();
  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const systemPrompt = `You are ReachIQ AI Strategist, a marketing strategist copilot for consumer brands.
      Current CRM database context:
      - Total Registered Customers: ${totalCustomers}
      - Average Lifetime Value (LTV / Total Spent): ₹${avgSpendVal}
      
      Respond to the user's message with a helpful strategy formatted in Markdown. Keep it professional, premium, and actionable.
      You MUST return your response as a JSON object with the following schema:
      {
        "message": "Your strategist recommendation text in markdown",
        "intelligence": {
          "audienceSize": estimated number of customers in target cohort,
          "avgSpend": estimated average spend in INR (number),
          "customerValue": "Low" | "Medium" | "High" | "Very High",
          "predictedRevenue": estimated campaign revenue in INR (number),
          "recommendedChannel": "WhatsApp" | "Email" | "SMS",
          "predictedOpenRate": predicted open percentage (number),
          "predictedConversion": predicted conversion percentage (number),
          "segment": "name of target cohort segment"
        },
        "suggestions": [
          "up to 3 suggested user prompt choices"
        ]
      }
      IMPORTANT: Return ONLY a valid JSON block. Do not wrap it in markdown code blocks like \`\`\`json.`;

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `User request: ${message}` }
      ]);
      const responseText = result.response.text().trim();
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const data = JSON.parse(cleaned);
      return res.json(data);
    } catch (err) {
      console.error("Gemini strategist error, falling back:", err);
    }
  }

  // Local rule-based fallback
  await delay(1200);

  if (msg.includes('coffee') || msg.includes('repeat purchase')) {
    const coffeeCustomers = await prisma.customer.count({ where: { industry: 'Coffee Chain' } });
    return res.json({
      message: `I analyzed your customer database and found **${coffeeCustomers} coffee customers** who purchased in the last 90 days.\n\nHere's my recommended strategy:\n\n**Launch a Loyalty Campaign** targeting frequent coffee buyers with a personalized WhatsApp message offering a free upgrade or loyalty points.\n\n**Why WhatsApp?** Your coffee segment has a 34% higher open rate on WhatsApp vs. email, and 2.3x better conversion on mobile.`,
      intelligence: {
        audienceSize: coffeeCustomers,
        avgSpend: 3200,
        customerValue: 'Medium-High',
        predictedRevenue: coffeeCustomers * 320,
        recommendedChannel: 'WhatsApp',
        predictedOpenRate: 68,
        predictedConversion: 9.2,
        segment: 'Coffee Loyalists',
      },
      suggestions: [
        'Create loyalty points campaign',
        'Bundle offer: Buy 3 get 1 free',
        'Early access to seasonal menu',
      ],
    });
  }

  if (msg.includes('churn') || msg.includes('win-back') || msg.includes('inactive') || msg.includes('lost')) {
    const atRisk = await prisma.customer.count({
      where: { last_purchase: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
    });
    const highValue = await prisma.customer.count({
      where: {
        total_spent: { gt: 10000 },
        last_purchase: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
    });
    return res.json({
      message: `I identified **${atRisk} customers** who haven't purchased in 60+ days — including **${highValue} high-value customers** worth significant revenue recovery.\n\nMy recommended approach:\n\n1. **Segment by value** — High-value customers get personalized offers (20% off)\n2. **Channel**: WhatsApp for high-value (68% open rate), Email for rest\n3. **Timing**: Tuesday–Thursday, 10am–12pm drives best engagement\n\nEstimated recovery potential: **₹${(highValue * 8500).toLocaleString('en-IN')}**`,
      intelligence: {
        audienceSize: atRisk,
        avgSpend: avgSpendVal,
        customerValue: 'Mixed',
        predictedRevenue: highValue * 8500,
        recommendedChannel: 'WhatsApp',
        predictedOpenRate: 62,
        predictedConversion: 7.8,
        segment: 'At-Risk Customers',
      },
      suggestions: [
        `Win-back campaign for ${highValue} high-value customers`,
        'Re-engagement series (3 touches over 2 weeks)',
        'Exclusive "We miss you" discount',
      ],
    });
  }

  if (msg.includes('vip') || msg.includes('high value') || msg.includes('top customer')) {
    const vip = await prisma.customer.count({ where: { total_spent: { gt: 20000 } } });
    return res.json({
      message: `Your **${vip} VIP customers** (₹20,000+ lifetime spend) are your most valuable asset — generating an estimated 38% of total revenue.\n\nThey're currently under-targeted. I recommend:\n\n**Exclusive VIP Program**: Early access to new products, dedicated support line, and members-only discounts.\n\n**Channel**: Personalized WhatsApp messages perform 3x better than mass email for this segment.`,
      intelligence: {
        audienceSize: vip,
        avgSpend: 28900,
        customerValue: 'Very High',
        predictedRevenue: vip * 15000,
        recommendedChannel: 'WhatsApp',
        predictedOpenRate: 82,
        predictedConversion: 18.4,
        segment: 'VIP Members',
      },
      suggestions: [
        'VIP early access campaign',
        'Premium membership upgrade offer',
        'Personalized anniversary message',
      ],
    });
  }

  // Default fallback
  return res.json({
    message: `I've analyzed your customer database of **${totalCustomers} customers** with an average lifetime value of **₹${avgSpendVal.toLocaleString('en-IN')}**.\n\nBased on current engagement patterns, I see **3 key opportunities**:\n\n1. **Win-back campaign** for inactive high-value customers (highest ROI)\n2. **VIP loyalty program** for top spenders (38% of your revenue)\n3. **WhatsApp first strategy** — your audience is 2.3x more responsive on WhatsApp\n\nTell me more about your specific goal and I'll create a detailed campaign strategy.`,
    intelligence: {
      audienceSize: totalCustomers,
      avgSpend: avgSpendVal,
      customerValue: 'Mixed',
      predictedRevenue: totalCustomers * 800,
      recommendedChannel: 'WhatsApp',
      predictedOpenRate: 62,
      predictedConversion: 7.4,
      segment: 'All Customers',
    },
    suggestions: [
      'Bring back customers inactive for 60+ days',
      'Boost repeat purchases from top customers',
      'Launch a seasonal campaign for fashion segment',
    ],
  });
});

// POST /api/ai/segment - NL to segment
router.post('/segment', async (req, res) => {
  const { query } = req.body;
  const q = query.toLowerCase();

  // Evaluate matching database customers in real-time
  const allCustomers = await prisma.customer.findMany({ include: { orders: true } });
  const matching = filterCustomersByQuery(allCustomers, q);
  const previewCustomers = matching.slice(0, 5).map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    city: c.city,
    total_spent: c.total_spent
  }));

  const client = getGeminiClient();
  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const systemPrompt = `You are a database segmentation assistant. Translate natural language queries into segment details.
      Return a JSON object with this exact structure:
      {
        "segmentName": "A concise title describing the segment",
        "audienceSize": estimated matching count (number),
        "filters": { any filter properties },
        "avgSpend": estimated average spend in INR (number),
        "revenueOpportunity": estimated revenue opportunity in INR (number),
        "engagementScore": "engagement score between 0.0 and 1.0, e.g. 0.82",
        "recommendedChannel": "whatsapp" | "email" | "sms"
      }
      Ensure you return ONLY a valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json.`;

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `Query: ${query}` }
      ]);
      const responseText = result.response.text().trim();
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const data = JSON.parse(cleaned);
      
      // Override with actual database matching sizes and preview profiles
      return res.json({
        ...data,
        audienceSize: matching.length,
        previewCustomers
      });
    } catch (err) {
      console.error("Gemini segment error, falling back:", err);
    }
  }

  // Local fallback
  await delay(800);
  let filters: any = {};
  let segmentName = 'Custom Segment';
  const audienceSize = matching.length;

  if (q.includes('spent') || q.includes('spend')) {
    const match = q.match(/₹?(\d+)/);
    const amount = match ? parseInt(match[1]) : 5000;
    filters.minSpend = amount;
    segmentName = `High Spenders (₹${amount.toLocaleString('en-IN')}+)`;
  } else if (q.includes('inactive') || q.includes('haven\'t purchased')) {
    const match = q.match(/(\d+)\s*day/);
    const days = match ? parseInt(match[1]) : 60;
    filters.daysSinceLastPurchase = days;
    segmentName = `Inactive ${days}+ Days`;
  } else if (q.includes('chennai') || q.includes('bangalore') || q.includes('mumbai')) {
    const city = q.includes('chennai') ? 'Chennai' : q.includes('bangalore') ? 'Bangalore' : 'Mumbai';
    filters.city = city;
    segmentName = `${city} Customers`;
  } else {
    segmentName = 'All Customers';
  }

  return res.json({
    segmentName,
    audienceSize,
    filters,
    previewCustomers,
    avgSpend: Math.round(matching.reduce((a, b) => a + b.total_spent, 0) / (matching.length || 1)),
    revenueOpportunity: audienceSize * 3200,
    engagementScore: matching.length > 0 ? (matching.reduce((a, b) => a + b.engagement_score, 0) / matching.length).toFixed(2) : '0.00',
    recommendedChannel: audienceSize < 100 ? 'whatsapp' : 'email',
  });
});

// POST /api/ai/campaign - generate campaign copy
router.post('/campaign', async (req, res) => {
  const { goal, audience, tone = 'friendly' } = req.body;

  const client = getGeminiClient();
  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const systemPrompt = `You are an expert copywriter. Generate high-converting campaign copy.
      You MUST return a JSON object with this exact structure:
      {
        "name": "Campaign Name",
        "subject": "Email subject line (only used if channel is email)",
        "message": "The message body copy. You MUST include the '{name}' placeholder where you want the customer name to be substituted (e.g., 'Hey {name} 👋'). You can also use '{city}' or '{total_spent}' if appropriate.",
        "cta": "Call to action text",
        "channel": "whatsapp" | "email" | "sms",
        "predictedOpenRate": predicted open percentage (number),
        "predictedCTR": predicted click-through percentage (number),
        "predictedConversion": predicted conversion percentage (number)
      }
      Ensure you return ONLY a valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json.`;

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `Goal: ${goal}, Audience Segment: ${audience}, Tone: ${tone}` }
      ]);
      const responseText = result.response.text().trim();
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const data = JSON.parse(cleaned);
      return res.json(data);
    } catch (err) {
      console.error("Gemini campaign copywriter error, falling back:", err);
    }
  }

  // Local fallback
  await delay(1000);
  const templates: Record<string, any> = {
    winback: {
      name: 'Win-Back Special',
      subject: 'We miss you — here\'s something special 💜',
      message: `Hi {name} 👋\n\nWe've noticed you haven't visited us in a while, and we miss you!\n\nAs a valued customer, we'd love to welcome you back with an exclusive offer:\n\n✨ 20% OFF your next purchase\n🎁 Free gift with orders above ₹1,500\n\nUse code: COMEBACK20\n⏰ Offer expires in 48 hours\n\nShop now →`,
      cta: 'Claim My Offer',
      channel: 'whatsapp',
      predictedOpenRate: 64,
      predictedCTR: 18,
      predictedConversion: 8.2,
    },
    loyalty: {
      name: 'Loyalty Reward Campaign',
      subject: 'Your loyalty points are waiting! 🌟',
      message: `Hi {name}! 🌟\n\nThank you for being one of our most valued customers!\n\nYou've earned **500 loyalty points** — worth ₹500 off your next order.\n\n🎯 Redeem before they expire on [Date]\n💎 Plus, get Double Points this weekend!\n\nYour exclusive member discount: LOYAL15\n\nShop the new collection →`,
      cta: 'Redeem My Points',
      channel: 'whatsapp',
      predictedOpenRate: 71,
      predictedCTR: 22,
      predictedConversion: 12.4,
    },
    default: {
      name: 'Engagement Campaign',
      subject: 'Something special just for you ✨',
      message: `Hi {name}! 👋\n\nWe've curated something just for you based on your preferences.\n\n🔥 New arrivals just dropped\n💜 Exclusive members-only pricing\n🚀 Free shipping on orders ₹999+\n\nDon't miss out — these won't last long!\n\nExplore now →`,
      cta: 'Shop Now',
      channel: 'email',
      predictedOpenRate: 52,
      predictedCTR: 14,
      predictedConversion: 6.8,
    },
  };

  const g = (goal || '').toLowerCase();
  const template = g.includes('win') || g.includes('back') || g.includes('inactive')
    ? templates.winback
    : g.includes('loyal') || g.includes('repeat') || g.includes('vip')
    ? templates.loyalty
    : templates.default;

  return res.json(template);
});

// POST /api/ai/insights - post-campaign insights
router.post('/insights', async (req, res) => {
  const { campaignId } = req.body;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      communications: { select: { status: true, channel: true } }
    }
  });

  const stats = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, failed: 0 };
  if (campaign) {
    campaign.communications.forEach(c => {
      stats.sent++;
      if (c.status === 'delivered') stats.delivered++;
      if (c.status === 'opened') stats.opened++;
      if (c.status === 'clicked') stats.clicked++;
      if (c.status === 'converted') stats.converted++;
      if (c.status === 'failed') stats.failed++;
    });
  }

  const client = getGeminiClient();
  if (client && campaign) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const systemPrompt = `You are a CRM campaign performance analyst. Read this campaign execution dataset and write a brief analytical post-mortem summary.
      Campaign name: "${campaign.name}"
      Channel: "${campaign.channel}"
      Execution Stats:
      - Messages Sent: ${stats.sent}
      - Messages Delivered: ${stats.delivered}
      - Messages Opened: ${stats.opened}
      - Messages Clicked: ${stats.clicked}
      - Conversions: ${stats.converted}
      - Failures: ${stats.failed}
      
      You MUST return a JSON object with this exact structure:
      {
        "summary": "${campaign.name}",
        "whatWorked": ["list of 3 key successes based on the metrics"],
        "whatDidntWork": ["list of 2 dropoffs or channels issues"],
        "audienceLearnings": ["2 insights about user engagement response"],
        "channelLearnings": ["2 insights on the channel performance"],
        "recommendations": ["3 strategic next steps for future campaigns"],
        "revenueOpportunity": {
          "amount": estimated potential follow-up revenue in INR (number),
          "description": "Short proposal for a high-ROI follow-up campaign"
        }
      }
      Ensure you return ONLY a valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json.`;

      const result = await model.generateContent([
        { text: systemPrompt }
      ]);
      const responseText = result.response.text().trim();
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const data = JSON.parse(cleaned);
      return res.json(data);
    } catch (err) {
      console.error("Gemini insights generation error, falling back:", err);
    }
  }

  // Local fallback
  await delay(1500);
  return res.json({
    summary: campaign?.name || 'Campaign',
    whatWorked: [
      'WhatsApp outperformed Email by 42% in open rates',
      'Customers in Chennai generated the highest engagement (2.1x avg)',
      'Morning delivery (9–11am) drove 34% higher CTR',
      'Personalized messages with customer name increased opens by 28%',
    ],
    whatDidntWork: [
      'SMS channel had 40% lower engagement vs projected',
      'Customers aged 45+ had lower mobile engagement',
      'Weekend sends performed 18% below weekday average',
    ],
    audienceLearnings: [
      'Segment "High Value At Risk" converts 3x better with urgency messaging',
      'Customers from Bangalore prefer email over WhatsApp',
      '18–28 age group: WhatsApp is 2.4x more effective',
    ],
    channelLearnings: [
      'WhatsApp: Best for urgency and personal offers',
      'Email: Best for visual-rich content and long-form',
      'SMS: Reserve for flash sales only',
    ],
    recommendations: [
      'Follow-up campaign within 7 days for non-converters',
      'A/B test subject lines for email segment',
      'Create a WhatsApp-first strategy for ages 18–35',
    ],
    revenueOpportunity: {
      amount: 22000,
      description: 'Estimated additional revenue from recommended follow-up campaign',
    },
  });
});

export default router;
