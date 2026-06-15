import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/opportunities - Retrieve all opportunities
router.get('/', async (req, res) => {
  try {
    let opportunities = await prisma.opportunity.findMany({
      orderBy: { created_at: 'desc' }
    });

    // If empty, dynamically generate and seed default opportunities
    if (opportunities.length === 0) {
      const totalCustomers = await prisma.customer.count();
      
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

      const defaultOpps = [
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
          potentialRevenue: Math.round(totalCustomers * 0.1 * 6000),
          priority: 'Medium',
          channel: 'email',
          suggestedCampaign: 'Premium Members Sale',
        }
      ];

      await prisma.opportunity.createMany({
        data: defaultOpps
      });

      opportunities = await prisma.opportunity.findMany({
        orderBy: { created_at: 'desc' }
      });
    }

    res.json(opportunities);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch opportunities' });
  }
});

// GET /api/opportunities/:id - Get specific opportunity
router.get('/:id', async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.id }
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(opportunity);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch opportunity' });
  }
});

// POST /api/opportunities - Create new opportunity
router.post('/', async (req, res) => {
  try {
    const { type, audience, potentialRevenue, priority, channel, suggestedCampaign } = req.body;
    if (!type || !audience || potentialRevenue === undefined || !priority || !channel || !suggestedCampaign) {
      return res.status(400).json({ error: 'Missing required opportunity fields' });
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        type,
        audience,
        potentialRevenue: parseFloat(potentialRevenue),
        priority,
        channel,
        suggestedCampaign
      }
    });

    res.status(201).json(opportunity);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create opportunity' });
  }
});

// DELETE /api/opportunities/:id - Dismiss/Delete opportunity
router.delete('/:id', async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.id }
    });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });

    await prisma.opportunity.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'Opportunity deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete opportunity' });
  }
});

export default router;
