import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

const CITIES = ['Chennai', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'];
const INDUSTRIES = ['Coffee Chain', 'Fashion Brand', 'Beauty Brand', 'D2C Brand'];
const GENDERS = ['Male', 'Female'];
const CHANNELS = ['whatsapp', 'email', 'sms'];
const CATEGORIES = ['Coffee', 'Fashion', 'Beauty', 'Accessories', 'Skincare', 'Lifestyle'];

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Aisha', 'Akash', 'Ananya', 'Arjun', 'Divya', 'Ishaan',
  'Kavya', 'Kiran', 'Meera', 'Nisha', 'Priya', 'Rahul', 'Riya', 'Rohan',
  'Sakshi', 'Sanjay', 'Sara', 'Shiva', 'Sneha', 'Suresh', 'Tanvi', 'Vikram',
  'Vishal', 'Yasmin', 'Zara', 'Arun', 'Deepa', 'Harish', 'Jaya', 'Layla',
  'Mohan', 'Neha', 'Om', 'Pooja', 'Raj', 'Seema', 'Tara', 'Uma',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Joshi',
  'Nair', 'Rao', 'Reddy', 'Iyer', 'Pillai', 'Menon', 'Krishnan', 'Bhat',
  'Hegde', 'Desai', 'Shah', 'Agarwal', 'Malhotra', 'Kapoor', 'Chopra', 'Bajaj',
];

router.post('/reset-db', async (req, res) => {
  try {
    // 1. Delete all existing data
    await prisma.event.deleteMany();
    await prisma.communication.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customerHealth.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.segment.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.weeklyReport.deleteMany();

    // 2. Create 100 new customers
    const customerData = [];
    for (let i = 0; i < 100; i++) {
      const first = FIRST_NAMES[i % FIRST_NAMES.length];
      const last = LAST_NAMES[i % LAST_NAMES.length];
      const city = CITIES[i % CITIES.length];
      const industry = INDUSTRIES[i % INDUSTRIES.length];
      const gender = GENDERS[i % GENDERS.length];
      
      customerData.push({
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@gmail.com`,
        phone: `+9198765${i.toString().padStart(5, '0')}`,
        city,
        age: 20 + (i % 35),
        gender,
        industry,
        total_spent: 1000 + (i * 450),
        engagement_score: parseFloat((0.1 + (i * 0.009)).toFixed(2)),
        last_purchase: new Date(Date.now() - (i % 10) * 10 * 24 * 60 * 60 * 1000)
      });
    }
    await prisma.customer.createMany({ data: customerData });
    const customers = await prisma.customer.findMany();

    // 3. Create orders
    const orderData = [];
    for (const c of customers) {
      const orderCount = 1 + (c.name.charCodeAt(0) % 4);
      for (let j = 0; j < orderCount; j++) {
        orderData.push({
          customer_id: c.id,
          amount: parseFloat((500 + (j * 350)).toFixed(2)),
          category: CATEGORIES[j % CATEGORIES.length],
          created_at: new Date(Date.now() - j * 5 * 24 * 60 * 60 * 1000),
        });
      }
    }
    await prisma.order.createMany({ data: orderData });

    // 4. Create default segments
    const segments = await prisma.segment.createManyAndReturn({
      data: [
        { name: 'High Value At Risk', description: "Customers with high spend who haven't purchased in 60+ days", query: 'total_spent > 10000 AND days_since_purchase > 60' },
        { name: 'Dormant Customers', description: 'Customers inactive for 90+ days', query: 'days_since_purchase > 90' },
        { name: 'VIP Customers', description: 'Top 10% spenders with high engagement', query: 'total_spent > 25000 AND engagement_score > 0.7' },
        { name: 'Frequent Buyers', description: 'Customers with 5+ orders in last 90 days', query: 'order_count_90d >= 5' },
        { name: 'Recent Buyers', description: 'Customers who purchased in last 30 days', query: 'days_since_purchase < 30' },
        { name: 'Coupon Users', description: 'Customers who respond to discount offers', query: 'coupon_usage_count > 0' },
      ],
    });

    // 5. Create completed campaigns
    await prisma.campaign.createMany({
      data: [
        { name: 'Win-Back Winter Campaign', segment_id: segments[0].id, channel: 'whatsapp', message: 'Hi {name}! We miss you. Get 20% off with code COMEBACK20.', status: 'completed', launched_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { name: 'VIP Exclusive Offer', segment_id: segments[2].id, channel: 'email', message: 'Dear {name}, enjoy early access to our seasonal collection.', status: 'completed', launched_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { name: 'Loyalty Boost Q4', segment_id: segments[1].id, channel: 'sms', message: 'Hi {name}, you have loyalty points waiting. Redeem now!', status: 'completed', launched_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      ]
    });

    // 6. Create communications and event logs for completed campaigns
    const completedCampaigns = await prisma.campaign.findMany({ where: { status: 'completed' } });
    for (const camp of completedCampaigns) {
      const slice = customers.slice(0, 25);
      for (const c of slice) {
        const isConverted = c.name.charCodeAt(0) % 4 === 0;
        const isClicked = isConverted || c.name.charCodeAt(0) % 2 === 0;
        let status = 'delivered';
        if (isConverted) status = 'converted';
        else if (isClicked) status = 'clicked';
        
        await prisma.communication.create({
          data: {
            campaign_id: camp.id,
            customer_id: c.id,
            status,
            channel: camp.channel,
            sent_at: camp.launched_at,
            events: {
              create: [
                { event_type: 'sent', timestamp: camp.launched_at || new Date() },
                { event_type: 'delivered', timestamp: camp.launched_at || new Date() },
                ...(isClicked ? [{ event_type: 'opened', timestamp: camp.launched_at || new Date() }, { event_type: 'clicked', timestamp: camp.launched_at || new Date() }] : []),
                ...(isConverted ? [{ event_type: 'converted', timestamp: camp.launched_at || new Date() }] : []),
              ]
            }
          }
        });
      }
    }

    // 7. Seed CustomerHealth and Predictions
    const healthData = [];
    const predictionData = [];
    const now = new Date();

    for (const customer of customers) {
      const daysSinceLastPurchase = customer.last_purchase
        ? Math.floor((now.getTime() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let healthScore = Math.round(customer.engagement_score * 100);
      if (daysSinceLastPurchase > 90) healthScore = Math.max(10, healthScore - 30);
      else if (daysSinceLastPurchase > 60) healthScore = Math.max(20, healthScore - 15);
      else healthScore = Math.min(100, healthScore + 10);

      let healthStatus = 'Healthy';
      if (healthScore < 30) healthStatus = 'Critical';
      else if (healthScore < 50) healthStatus = 'At Risk';
      else if (healthScore < 75) healthStatus = 'Moderate';

      healthData.push({
        customer_id: customer.id,
        score: healthScore,
        status: healthStatus,
      });

      const churnRisk = Math.min(
        0.95,
        (daysSinceLastPurchase / 180) * 0.6 + (1 - customer.engagement_score) * 0.4
      );
      const expectedRev = customer.total_spent > 0
        ? parseFloat((customer.total_spent * (1 - churnRisk)).toFixed(2))
        : 1500;

      predictionData.push({
        customer_id: customer.id,
        churn_risk: churnRisk,
        expected_rev: expectedRev,
      });
    }

    await prisma.customerHealth.createMany({ data: healthData });
    await prisma.prediction.createMany({ data: predictionData });

    // 8. Seed Opportunities
    const highValueAtRiskCount = customers.filter(c => c.total_spent > 10000 && c.last_purchase && (now.getTime() - new Date(c.last_purchase).getTime()) / (1000 * 60 * 60 * 24) > 60).length;
    const dormantCount = customers.filter(c => c.last_purchase && (now.getTime() - new Date(c.last_purchase).getTime()) / (1000 * 60 * 60 * 24) > 90).length;

    await prisma.opportunity.createMany({
      data: [
        {
          type: 'VIP Churn Prevention',
          audience: `${highValueAtRiskCount} VIP customers at risk of churning`,
          potentialRevenue: highValueAtRiskCount * 8500,
          priority: 'High',
          channel: 'whatsapp',
          suggestedCampaign: 'Win-Back Special',
        },
        {
          type: 'Dormant Re-engagement',
          audience: `${dormantCount} dormant customers ready to re-engage`,
          potentialRevenue: dormantCount * 3200,
          priority: 'Medium',
          channel: 'whatsapp',
          suggestedCampaign: 'Loyalty Reward Campaign',
        },
        {
          type: 'VIP Under-Targeted Alert',
          audience: 'Top 10% spenders under-targeted this month',
          potentialRevenue: Math.round(customers.length * 0.1 * 6000),
          priority: 'Medium',
          channel: 'email',
          suggestedCampaign: 'Premium Members Sale',
        }
      ]
    });

    // 9. Seed Weekly Reports
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.weeklyReport.createMany({
      data: [
        {
          week_start: lastWeek,
          summary: 'High re-engagement via Winter campaign drove a substantial conversion boost. Chennai customer segments outperformed.',
          revenue: 125000
        },
        {
          week_start: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
          summary: 'VIP loyalty campaign launched over WhatsApp. VIP response rate exceeded standard average by 35%.',
          revenue: 187000
        }
      ]
    });

    res.json({ success: true, message: 'Database reset and re-seeded successfully' });
  } catch (error: any) {
    console.error('Reset db error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset database' });
  }
});

// GET /api/analytics/overview - KPI cards
router.get('/overview', async (req, res) => {
  const [totalCustomers, totalCampaigns, activeCampaigns, recentEvents] = await Promise.all([
    prisma.customer.count(),
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: 'active' } }),
    prisma.event.count({ where: { event_type: 'converted' } }),
  ]);

  // Revenue influenced = converted * avg order value
  const avgOrder = await prisma.order.aggregate({ _avg: { amount: true } });
  const revenueInfluenced = recentEvents * (avgOrder._avg.amount || 2500);

  // Conversion rate
  const totalComms = await prisma.communication.count();
  const converted = await prisma.communication.count({ where: { status: 'converted' } });
  const conversionRate = totalComms > 0 ? ((converted / totalComms) * 100).toFixed(1) : '0';

  // Calculate counts for dynamic seeding
  const highValueAtRisk = await prisma.customer.count({
    where: {
      total_spent: { gt: 10000 },
      last_purchase: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
  });

  const dormant = await prisma.customer.count({
    where: {
      last_purchase: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  // Fetch opportunities dynamically
  let dbOpps = await prisma.opportunity.findMany({
    orderBy: { created_at: 'desc' }
  });

  if (dbOpps.length === 0) {
    await prisma.opportunity.createMany({
      data: [
        {
          type: 'VIP Churn Prevention',
          audience: `${highValueAtRisk} VIP customers at risk of churning`,
          potentialRevenue: highValueAtRisk * 8500,
          priority: 'High',
          channel: 'whatsapp',
          suggestedCampaign: 'Win-Back Special',
        },
        {
          type: 'Dormant Re-engagement',
          audience: `${dormant} dormant customers ready to re-engage`,
          potentialRevenue: dormant * 3200,
          priority: 'Medium',
          channel: 'whatsapp',
          suggestedCampaign: 'Loyalty Reward Campaign',
        },
        {
          type: 'VIP Under-Targeted Alert',
          audience: 'Top 10% spenders under-targeted this month',
          potentialRevenue: 312000,
          priority: 'Medium',
          channel: 'email',
          suggestedCampaign: 'Premium Members Sale',
        }
      ]
    });
    dbOpps = await prisma.opportunity.findMany({
      orderBy: { created_at: 'desc' }
    });
  }

  const opportunities = dbOpps.map(opp => {
    let icon = 'alert';
    if (opp.type.toLowerCase().includes('dormant') || opp.type.toLowerCase().includes('re-engagement') || opp.type.toLowerCase().includes('users')) icon = 'users';
    else if (opp.type.toLowerCase().includes('vip') || opp.type.toLowerCase().includes('star')) icon = 'star';

    return {
      id: opp.id,
      title: opp.audience,
      description: `${opp.type} via ${opp.channel.toUpperCase() === 'WHATSAPP' ? 'WhatsApp' : opp.channel.toUpperCase()}`,
      potentialRevenue: opp.potentialRevenue,
      action: opp.suggestedCampaign,
      urgency: opp.priority.toLowerCase(),
      icon
    };
  });

  res.json({
    kpis: {
      totalCustomers,
      activeCampaigns,
      revenueInfluenced: Math.round(revenueInfluenced),
      conversionRate: parseFloat(conversionRate),
    },
    opportunities,
    insights: [
      { text: 'WhatsApp engagement increased 18% this month', trend: 'up' },
      { text: 'Email open rates dropped 11% vs last month', trend: 'down' },
      { text: 'VIP customers generated 38% of total revenue', trend: 'up' },
      { text: 'Customers aged 18–25 engage most on WhatsApp', trend: 'neutral' },
      { text: 'Chennai & Bangalore drive 52% of conversions', trend: 'up' },
    ],
  });
});

// GET /api/analytics/campaigns - all campaign analytics
router.get('/campaigns', async (req, res) => {
  const { days = '30' } = req.query;
  const since = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

  const campaigns = await prisma.campaign.findMany({
    where: { created_at: { gte: since } },
    include: {
      _count: { select: { communications: true } },
    },
  });

  const enriched = await Promise.all(campaigns.map(async (campaign) => {
    const stats = await prisma.communication.groupBy({
      by: ['status'],
      where: { campaign_id: campaign.id },
      _count: { status: true },
    });
    const statMap: Record<string, number> = {};
    stats.forEach(s => { statMap[s.status] = s._count.status; });
    const total = campaign._count.communications || 1;

    const delivered = (statMap['delivered'] || 0) + (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0);
    const opened = (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0);
    const clicked = (statMap['clicked'] || 0) + (statMap['converted'] || 0);
    const converted = statMap['converted'] || 0;

    return {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      sent: total,
      delivered,
      opened,
      clicked,
      converted,
      openRate: parseFloat(((opened / total) * 100).toFixed(1)),
      clickRate: parseFloat(((clicked / total) * 100).toFixed(1)),
      conversionRate: parseFloat(((converted / total) * 100).toFixed(1)),
      revenueInfluenced: converted * 2800,
    };
  }));

  res.json(enriched);
});

// GET /api/analytics/channel-comparison
router.get('/channel-comparison', async (req, res) => {
  const channelStats = await prisma.communication.groupBy({
    by: ['channel', 'status'],
    _count: { status: true },
  });

  const channels: Record<string, any> = {};
  channelStats.forEach(({ channel, status, _count }) => {
    if (!channels[channel]) channels[channel] = { channel, sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
    channels[channel].sent += _count.status;
    if (['delivered', 'opened', 'clicked', 'converted'].includes(status)) channels[channel].delivered += _count.status;
    if (['opened', 'clicked', 'converted'].includes(status)) channels[channel].opened += _count.status;
    if (['clicked', 'converted'].includes(status)) channels[channel].clicked += _count.status;
    if (status === 'converted') channels[channel].converted += _count.status;
  });

  res.json(Object.values(channels).map((c: any) => ({
    ...c,
    openRate: c.sent > 0 ? parseFloat(((c.opened / c.sent) * 100).toFixed(1)) : 0,
    clickRate: c.sent > 0 ? parseFloat(((c.clicked / c.sent) * 100).toFixed(1)) : 0,
    conversionRate: c.sent > 0 ? parseFloat(((c.converted / c.sent) * 100).toFixed(1)) : 0,
  })));
});

// GET /api/analytics/trends - engagement trends over time
router.get('/trends', async (req, res) => {
  const { days = '30' } = req.query;
  const numDays = parseInt(days as string);

  const trends = [];
  for (let i = numDays; i >= 0; i -= Math.max(1, Math.floor(numDays / 10))) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));

    const [sent, opened, converted] = await Promise.all([
      prisma.event.count({ where: { event_type: 'sent', timestamp: { gte: dayStart, lte: dayEnd } } }),
      prisma.event.count({ where: { event_type: 'opened', timestamp: { gte: dayStart, lte: dayEnd } } }),
      prisma.event.count({ where: { event_type: 'converted', timestamp: { gte: dayStart, lte: dayEnd } } }),
    ]);

    trends.push({
      date: dayStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      sent,
      opened,
      converted,
      revenue: converted * 2800,
    });
  }

  res.json(trends);
});

export default router;
