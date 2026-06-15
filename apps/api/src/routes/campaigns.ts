import { Router } from 'express';
import { prisma, io } from '../index';

const router = Router();

// GET /api/campaigns - list all
router.get('/', async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      segment: true,
      _count: { select: { communications: true } },
    },
  });

  // Add stats to each campaign
  const enriched = await Promise.all(campaigns.map(async (campaign) => {
    const stats = await prisma.communication.groupBy({
      by: ['status'],
      where: { campaign_id: campaign.id },
      _count: { status: true },
    });
    const statMap: Record<string, number> = {};
    stats.forEach(s => { statMap[s.status] = s._count.status; });
    const total = campaign._count.communications;
    return {
      ...campaign,
      stats: {
        sent: total,
        delivered: (statMap['delivered'] || 0) + (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0),
        opened: (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0),
        clicked: (statMap['clicked'] || 0) + (statMap['converted'] || 0),
        converted: statMap['converted'] || 0,
        failed: statMap['failed'] || 0,
      },
    };
  }));

  res.json(enriched);
});

// GET /api/campaigns/:id - single campaign
router.get('/:id', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      segment: true,
      communications: {
        include: { customer: true, events: true },
        take: 100,
      },
    },
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign);
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', async (req, res) => {
  const stats = await prisma.communication.groupBy({
    by: ['status'],
    where: { campaign_id: req.params.id },
    _count: { status: true },
  });

  const statMap: Record<string, number> = {};
  stats.forEach(s => { statMap[s.status] = s._count.status; });
  const total = Object.values(statMap).reduce((a, b) => a + b, 0);

  const delivered = (statMap['delivered'] || 0) + (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0);
  const opened = (statMap['opened'] || 0) + (statMap['clicked'] || 0) + (statMap['converted'] || 0);
  const clicked = (statMap['clicked'] || 0) + (statMap['converted'] || 0);
  const converted = statMap['converted'] || 0;

  res.json({
    sent: total,
    delivered,
    opened,
    clicked,
    converted,
    failed: statMap['failed'] || 0,
    openRate: total > 0 ? ((opened / total) * 100).toFixed(1) : '0',
    clickRate: total > 0 ? ((clicked / total) * 100).toFixed(1) : '0',
    conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : '0',
  });
});

// POST /api/campaigns - create
router.post('/', async (req, res) => {
  const { name, segment_id, channel, message, status = 'draft' } = req.body;
  const campaign = await prisma.campaign.create({
    data: { name, segment_id, channel, message, status },
    include: { segment: true },
  });
  res.status(201).json(campaign);
});

// DELETE /api/campaigns/:id - cancel or delete a campaign
router.delete('/:id', async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    if (campaign.status === 'active') {
      // Cancel active campaign — update status to cancelled
      const updated = await prisma.campaign.update({
        where: { id: req.params.id },
        data: { status: 'cancelled' },
      });
      io.emit('campaign:cancelled', { campaignId: req.params.id });
      return res.json({ success: true, message: 'Campaign cancelled', campaign: updated });
    } else {
      // Delete draft/completed campaign
      await prisma.event.deleteMany({ where: { communication: { campaign_id: req.params.id } } });
      await prisma.communication.deleteMany({ where: { campaign_id: req.params.id } });
      await prisma.campaign.delete({ where: { id: req.params.id } });
      return res.json({ success: true, message: 'Campaign deleted' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete/cancel campaign' });
  }
});

// Helper to parse and filter customers by query string
export function filterCustomersByQuery(allCustomers: any[], queryStr: string): any[] {
  const q = queryStr.toLowerCase();
  return allCustomers.filter(customer => {
    // 1. Check total spent
    if (q.includes('total_spent > 10000') || q.includes('total_spent > 25000') || q.includes('spent > 10000') || q.includes('spent > 25000')) {
      const min = q.includes('25000') ? 25000 : 10000;
      if (customer.total_spent <= min) return false;
    } else if (q.includes('spent') || q.includes('spend')) {
      const match = q.match(/(?:spent|spend|gt|above|>\s*)\s*₹?\s*(\d+)/) || q.match(/₹?(\d+)/);
      if (match) {
        const amt = parseInt(match[1]);
        if (customer.total_spent <= amt) return false;
      }
    }

    // 2. Check last purchase / inactivity days
    if (q.includes('days_since_purchase > 60') || q.includes('inactive 60') || q.includes('purchased in 60') || q.includes('60 days')) {
      if (!customer.last_purchase) return false;
      const diffDays = (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 60) return false;
    } else if (q.includes('days_since_purchase > 90') || q.includes('inactive 90') || q.includes('90 days')) {
      if (!customer.last_purchase) return false;
      const diffDays = (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 90) return false;
    } else if (q.includes('days_since_purchase < 30') || q.includes('recent') || q.includes('30 days')) {
      if (!customer.last_purchase) return false;
      const diffDays = (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 30) return false;
    } else if (q.includes('day')) {
      const match = q.match(/(\d+)\s*day/);
      if (match) {
        const days = parseInt(match[1]);
        if (!customer.last_purchase) return false;
        const diffDays = (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24);
        if (q.includes('<') || q.includes('within') || q.includes('less than')) {
          if (diffDays >= days) return false;
        } else {
          if (diffDays <= days) return false;
        }
      }
    }

    // 3. Check engagement score
    if (q.includes('engagement_score > 0.7') || q.includes('engagement > 0.7')) {
      if (customer.engagement_score <= 0.7) return false;
    }

    // 4. Check order count
    if (q.includes('order_count_90d') || q.includes('frequent')) {
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const orderCount = customer.orders.filter((o: any) => new Date(o.created_at).getTime() >= ninetyDaysAgo).length;
      const required = q.includes('order_count_90d >= 5') ? 5 : 3;
      if (orderCount < required) return false;
    }

    // 5. Check city
    const cities = ['chennai', 'bangalore', 'mumbai', 'delhi', 'hyderabad', 'pune'];
    for (const city of cities) {
      if (q.includes(city)) {
        if (customer.city.toLowerCase() !== city) return false;
      }
    }

    return true;
  });
}

// Helper to parse and filter customers by segment rules
export async function getSegmentCustomers(segmentId: string | null): Promise<any[]> {
  const allCustomers = await prisma.customer.findMany({
    include: { orders: true }
  });

  if (!segmentId) {
    return allCustomers.slice(0, 80);
  }

  const segment = await prisma.segment.findUnique({
    where: { id: segmentId }
  });

  if (!segment) {
    return allCustomers.slice(0, 80);
  }

  return filterCustomersByQuery(allCustomers, segment.query);
}

// Helper to compile personalization variables
function personalizeMessage(template: string, customer: any): string {
  if (!template) return '';
  return template
    .replace(/{name}/gi, customer.name || '')
    .replace(/{city}/gi, customer.city || '')
    .replace(/{total_spent}/gi, customer.total_spent !== undefined ? customer.total_spent.toString() : '0')
    .replace(/{email}/gi, customer.email || '')
    .replace(/{phone}/gi, customer.phone || '');
}

// POST /api/campaigns/:id/launch - launch campaign
router.post('/:id/launch', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: { segment: true },
  });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Update status
  await prisma.campaign.update({
    where: { id: req.params.id },
    data: { status: 'active', launched_at: new Date() },
  });

  // Get matching customers
  const customers = await getSegmentCustomers(campaign.segment_id);
  const targetCustomers = customers.slice(0, 100); // Cap at 100 for responsive UI/demo safety

  // Create communications
  const communications = await Promise.all(
    targetCustomers.map(customer =>
      prisma.communication.create({
        data: {
          campaign_id: campaign.id,
          customer_id: customer.id,
          status: 'pending',
          channel: campaign.channel,
        },
        include: { customer: true }
      })
    )
  );

  // Fire off to channel service (async)
  fireToChannelService(campaign, communications);

  io.emit('campaign:launched', { campaignId: campaign.id });

  // Auto-complete campaign status after simulation delays finish (scaled by 0.1 speedFactor)
  const duration = campaign.channel === 'email' ? 55000 : 15000;
  setTimeout(async () => {
    try {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'completed' }
      });
      io.emit('campaign:completed', { campaignId: campaign.id });
      io.emit('analytics:update', { campaignId: campaign.id });
      console.log(`Campaign ${campaign.id} completed.`);
    } catch (e) {
      console.error('Failed to complete campaign:', e);
    }
  }, duration);

  res.json({ success: true, communicationsCreated: communications.length });
});

async function fireToChannelService(campaign: any, communications: any[]) {
  // Simulate channel service calls with delays
  for (const comm of communications) {
    setTimeout(async () => {
      try {
        const personalized = personalizeMessage(campaign.message, comm.customer);
        const response = await fetch('http://localhost:3002/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communicationId: comm.id,
            customerId: comm.customer_id,
            channel: comm.channel,
            message: personalized,
            callbackUrl: 'http://localhost:3001/api/receipt',
          }),
        });
        if (!response.ok) console.error('Channel service error:', await response.text());
      } catch (e) {
        console.error('Failed to reach channel service:', e);
      }
    }, Math.random() * 2000);
  }
}

export default router;
