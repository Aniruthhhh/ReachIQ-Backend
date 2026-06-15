import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

const CAMPAIGN_NAMES = [
  'Win-Back Winter Campaign', 'Loyalty Boost Q4', 'VIP Exclusive Offer',
  'Flash Sale Alert', 'Birthday Special', 'New Arrival Drop',
  'Re-engagement Drive', 'Referral Reward', 'Weekend Treat',
  'Milestone Celebration', 'Festive Season Special', 'Summer Collection Launch',
  'Customer Appreciation Day', 'Welcome Back Series', 'Premium Members Sale',
];

const CAMPAIGN_MESSAGES = [
  "Hi {name} 👋 We miss you! Get 20% off your next order. Use code COMEBACK20. Valid 48hrs only!",
  "Hey {name}! 🌟 As a VIP member, you get early access to our new collection. Shop now!",
  "Hi {name}! Your loyalty means everything to us. Here's ₹500 cashback on your next purchase.",
  "{name}, we have something special for you! 🎁 Buy 2 get 1 FREE this weekend only.",
  "Hey {name}! 🎉 Happy Birthday month! Enjoy 30% off everything just for you.",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function generatePhone(): string {
  return `+91${randomInt(7000000000, 9999999999)}`;
}

async function main() {
  console.log('🌱 Seeding ReachIQ database...\n');

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

  // Create 500 customers
  console.log('👥 Creating 500 customers...');
  const customerData = [];
  for (let i = 0; i < 500; i++) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const createdAt = randomDate(new Date('2023-01-01'), new Date('2024-06-01'));
    const lastPurchase = Math.random() > 0.15
      ? randomDate(new Date('2024-01-01'), new Date())
      : null;
    customerData.push({
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`,
      phone: generatePhone(),
      city: randomItem(CITIES),
      age: randomInt(18, 55),
      gender: randomItem(GENDERS),
      industry: randomItem(INDUSTRIES),
      created_at: createdAt,
      last_purchase: lastPurchase,
      total_spent: randomFloat(500, 50000),
      engagement_score: randomFloat(0.1, 1.0),
    });
  }
  await prisma.customer.createMany({ data: customerData });
  const customers = await prisma.customer.findMany();
  console.log(`✅ ${customers.length} customers created`);

  // Create orders
  console.log('🛒 Creating orders...');
  const orderData = [];
  for (const customer of customers) {
    const orderCount = randomInt(1, 8);
    for (let j = 0; j < orderCount; j++) {
      orderData.push({
        customer_id: customer.id,
        amount: randomFloat(200, 8000),
        category: randomItem(CATEGORIES),
        created_at: randomDate(customer.created_at, new Date()),
      });
    }
  }
  await prisma.order.createMany({ data: orderData });
  console.log(`✅ ${orderData.length} orders created`);

  // Segments
  console.log('🎯 Creating segments...');
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
  console.log(`✅ ${segments.length} segments created`);

  // Campaigns
  console.log('📣 Creating 15 campaigns...');
  const campaignStatuses = ['completed', 'completed', 'completed', 'completed', 'active', 'active', 'draft'];
  const campaigns = await prisma.campaign.createManyAndReturn({
    data: CAMPAIGN_NAMES.map((name, i) => {
      const status = randomItem(campaignStatuses);
      const createdAt = randomDate(new Date('2024-01-01'), new Date());
      return {
        name,
        segment_id: segments[i % segments.length].id,
        channel: randomItem(CHANNELS),
        message: randomItem(CAMPAIGN_MESSAGES),
        status,
        created_at: createdAt,
        launched_at: status !== 'draft' ? createdAt : null,
      };
    }),
  });
  console.log(`✅ ${campaigns.length} campaigns created`);

  // Communications & Events for completed campaigns
  console.log('📨 Creating communications & events...');
  let totalComms = 0;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed');

  for (const campaign of completedCampaigns) {
    const audienceSize = randomInt(40, 100);
    const targetCustomers = customers.slice(0, audienceSize);

    for (const customer of targetCustomers) {
      const sentAt = randomDate(campaign.created_at, new Date());
      const isDelivered = Math.random() > 0.05;
      const isOpened = isDelivered && Math.random() > 0.32;
      const isClicked = isOpened && Math.random() > 0.60;
      const isConverted = isClicked && Math.random() > 0.55;

      let status = 'sent';
      if (isConverted) status = 'converted';
      else if (isClicked) status = 'clicked';
      else if (isOpened) status = 'opened';
      else if (isDelivered) status = 'delivered';
      else status = 'failed';

      await prisma.communication.create({
        data: {
          campaign_id: campaign.id,
          customer_id: customer.id,
          status,
          channel: campaign.channel,
          sent_at: sentAt,
          events: {
            create: [
              { event_type: 'sent', timestamp: sentAt },
              ...(isDelivered ? [{ event_type: 'delivered', timestamp: new Date(sentAt.getTime() + randomInt(1000, 5000)) }] : []),
              ...(isOpened ? [{ event_type: 'opened', timestamp: new Date(sentAt.getTime() + randomInt(60000, 3600000)) }] : []),
              ...(isClicked ? [{ event_type: 'clicked', timestamp: new Date(sentAt.getTime() + randomInt(120000, 7200000)) }] : []),
              ...(isConverted ? [{ event_type: 'converted', timestamp: new Date(sentAt.getTime() + randomInt(300000, 86400000)) }] : []),
            ],
          },
        },
      });
      totalComms++;
    }
  }

  const totalOrders = orderData.length;
  console.log(`✅ ${totalComms} communications with events`);

  // 7. Seeding customer health and predictions
  console.log('🏥 Seeding customer health and predictions...');
  const healthData = [];
  const predictionData = [];
  const now = new Date();

  for (const customer of customers) {
    const daysSinceLastPurchase = customer.last_purchase
      ? Math.floor((now.getTime() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Health calculation
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

    // Prediction calculation
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
  console.log(`✅ Health and predictions seeded for ${customers.length} customers`);

  // 8. Seeding opportunities
  console.log('💡 Seeding opportunities...');
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
  console.log('✅ Opportunities seeded');

  // 9. Seeding weekly reports
  console.log('📊 Seeding weekly reports...');
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
  console.log('✅ Weekly reports seeded');

  console.log('\n🎉 ReachIQ database seeded successfully!');
  console.log(`   👥 Customers: 500`);
  console.log(`   🛒 Orders: ${totalOrders}`);
  console.log(`   🎯 Segments: ${segments.length}`);
  console.log(`   📣 Campaigns: ${campaigns.length}`);
  console.log(`   📨 Communications: ${totalComms}`);
  console.log(`   🏥 Health Scores: ${healthData.length}`);
  console.log(`   🔮 Predictions: ${predictionData.length}`);
  console.log(`   💡 Opportunities: 3`);
  console.log(`   📊 Weekly Reports: 2`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
