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
  'Mohan', 'Neha', 'Om', 'Pooja', 'Raj', 'Seema', 'Tara', 'Uma'
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Joshi',
  'Nair', 'Rao', 'Reddy', 'Iyer', 'Pillai', 'Menon', 'Krishnan', 'Bhat',
  'Hegde', 'Desai', 'Shah', 'Agarwal', 'Malhotra', 'Kapoor', 'Chopra', 'Bajaj'
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

const CAMPAIGN_NAMES = [
  'Win-Back Winter Campaign', 'Loyalty Boost Q4', 'VIP Exclusive Offer',
  'Flash Sale Alert', 'Birthday Special', 'New Arrival Drop',
  'Re-engagement Drive', 'Referral Reward', 'Weekend Treat',
  'Milestone Celebration', 'Festive Season Special', 'Summer Collection Launch',
  'Customer Appreciation Day', 'Welcome Back Series', 'Premium Members Sale'
];

const CAMPAIGN_MESSAGES = [
  "Hi {name} 👋 We miss you! Get 20% off your next order. Use code COMEBACK20. Valid 48hrs only!",
  "Hey {name}! 🌟 As a VIP member, you get early access to our new collection. Shop now!",
  "Hi {name}! Your loyalty means everything to us. Here's ₹500 cashback on your next purchase.",
  "{name}, we have something special for you! 🎁 Buy 2 get 1 FREE this weekend only.",
  "Hey {name}! 🎉 Happy Birthday month! Enjoy 30% off everything just for you.",
];

async function main() {
  console.log('🌱 Seeding ReachIQ database...');

  // Clear existing data
  await prisma.event.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.segment.deleteMany();

  // Create customers
  console.log('👥 Creating 500 customers...');
  const customers = [];
  for (let i = 0; i < 500; i++) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const gender = randomItem(GENDERS);
    const city = randomItem(CITIES);
    const industry = randomItem(INDUSTRIES);
    const age = randomInt(18, 55);
    const createdAt = randomDate(new Date('2023-01-01'), new Date('2024-06-01'));
    const lastPurchase = Math.random() > 0.15
      ? randomDate(new Date('2024-01-01'), new Date())
      : null;
    const totalSpent = randomFloat(500, 50000);
    const engagementScore = randomFloat(0.1, 1.0);

    customers.push({
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`,
      phone: generatePhone(),
      city,
      age,
      gender,
      industry,
      created_at: createdAt,
      last_purchase: lastPurchase,
      total_spent: totalSpent,
      engagement_score: engagementScore,
    });
  }

  const createdCustomers = await prisma.customer.createManyAndReturn({ data: customers });
  console.log(`✅ Created ${createdCustomers.length} customers`);

  // Create orders
  console.log('🛒 Creating 2000+ orders...');
  const orders = [];
  for (const customer of createdCustomers) {
    const orderCount = randomInt(1, 8);
    for (let j = 0; j < orderCount; j++) {
      orders.push({
        customer_id: customer.id,
        amount: randomFloat(200, 8000),
        category: randomItem(CATEGORIES),
        created_at: randomDate(customer.created_at, new Date()),
      });
    }
  }
  await prisma.order.createMany({ data: orders });
  console.log(`✅ Created ${orders.length} orders`);

  // Create segments
  console.log('🎯 Creating segments...');
  const segments = await prisma.segment.createManyAndReturn({
    data: [
      {
        name: 'High Value At Risk',
        description: 'Customers with high spend who haven\'t purchased in 60+ days',
        query: 'total_spent > 10000 AND days_since_purchase > 60',
      },
      {
        name: 'Dormant Customers',
        description: 'Customers inactive for 90+ days',
        query: 'days_since_purchase > 90',
      },
      {
        name: 'VIP Customers',
        description: 'Top 10% spenders with high engagement',
        query: 'total_spent > 25000 AND engagement_score > 0.7',
      },
      {
        name: 'Frequent Buyers',
        description: 'Customers with 5+ orders in last 90 days',
        query: 'order_count_90d >= 5',
      },
      {
        name: 'Recent Buyers',
        description: 'Customers who purchased in last 30 days',
        query: 'days_since_purchase < 30',
      },
      {
        name: 'Coupon Users',
        description: 'Customers who respond to discount offers',
        query: 'coupon_usage_count > 0',
      },
    ],
  });
  console.log(`✅ Created ${segments.length} segments`);

  // Create campaigns
  console.log('📣 Creating campaigns...');
  const campaignStatuses = ['completed', 'completed', 'completed', 'active', 'active', 'draft'];
  const campaigns = [];
  for (let i = 0; i < 15; i++) {
    const status = randomItem(campaignStatuses);
    const segment = randomItem(segments);
    const createdAt = randomDate(new Date('2024-01-01'), new Date());
    campaigns.push({
      name: CAMPAIGN_NAMES[i % CAMPAIGN_NAMES.length],
      segment_id: segment.id,
      channel: randomItem(CHANNELS),
      message: randomItem(CAMPAIGN_MESSAGES),
      status,
      created_at: createdAt,
      launched_at: status !== 'draft' ? createdAt : null,
    });
  }
  const createdCampaigns = await prisma.campaign.createManyAndReturn({ data: campaigns });
  console.log(`✅ Created ${createdCampaigns.length} campaigns`);

  // Create communications for completed/active campaigns
  console.log('📨 Creating communications and events...');
  const completedCampaigns = createdCampaigns.filter(c => c.status === 'completed');
  let totalComms = 0;

  for (const campaign of completedCampaigns) {
    const audienceSize = randomInt(50, 120);
    const targetCustomers = createdCustomers.slice(0, audienceSize);

    for (const customer of targetCustomers) {
      const sentAt = randomDate(campaign.created_at, new Date());
      const isDelivered = Math.random() > 0.05;
      const isOpened = isDelivered && Math.random() > 0.30;
      const isClicked = isOpened && Math.random() > 0.65;
      const isConverted = isClicked && Math.random() > 0.60;

      let status = 'sent';
      if (isConverted) status = 'converted';
      else if (isClicked) status = 'clicked';
      else if (isOpened) status = 'opened';
      else if (isDelivered) status = 'delivered';
      else status = 'failed';

      const comm = await prisma.communication.create({
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

  console.log(`✅ Created ${totalComms} communications with events`);
  console.log('');
  console.log('🎉 ReachIQ database seeded successfully!');
  console.log(`   👥 Customers: 500`);
  console.log(`   🛒 Orders: ${orders.length}`);
  console.log(`   🎯 Segments: ${segments.length}`);
  console.log(`   📣 Campaigns: ${createdCampaigns.length}`);
  console.log(`   📨 Communications: ${totalComms}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
