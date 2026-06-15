import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/recommendations - general list of intelligent recommendation cards
router.get('/', async (req, res) => {
  try {
    const topSegments = await prisma.segment.findMany({
      take: 3
    });

    const recommendations = [
      {
        id: 'rec_1',
        title: 'Prioritize WhatsApp for Loyalty Boosts',
        description: 'Analysis shows WhatsApp CTR is 2.3x higher than Email for campaigns under 5,000 audience size.',
        metric: '+130% Click-Through',
        impact: 'High',
        category: 'Channel Optimization'
      },
      {
        id: 'rec_2',
        title: 'Launch a Win-Back Campaign on Dormant Customers',
        description: `Dormant customer cohort is growing. Target segment "${topSegments[1]?.name || 'Dormant Customers'}" with a customized comeback offer.`,
        metric: '₹2.8L Potential Recovery',
        impact: 'Medium',
        category: 'Retention'
      },
      {
        id: 'rec_3',
        title: 'A/B Test Email Subject Lines for Fashion Segment',
        description: 'Fashion brand campaigns are seeing higher open rates but lower click rates. Refine CTAs and subject lines.',
        metric: '+15% Conversion Boost',
        impact: 'Low',
        category: 'A/B Testing'
      }
    ];

    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch recommendations' });
  }
});

// GET /api/recommendations/customer/:customerId - specific predictive health and actions for a single customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // 1. Calculate or retrieve CustomerHealth
    let health = await prisma.customerHealth.findUnique({
      where: { customer_id: customerId }
    });

    if (!health) {
      const daysSinceLastPurchase = customer.last_purchase
        ? Math.floor((Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      
      let score = Math.round(customer.engagement_score * 100);
      if (daysSinceLastPurchase > 90) score = Math.max(10, score - 30);
      else if (daysSinceLastPurchase > 60) score = Math.max(20, score - 15);
      else score = Math.min(100, score + 10);

      let status = 'Healthy';
      if (score < 30) status = 'Critical';
      else if (score < 50) status = 'At Risk';
      else if (score < 75) status = 'Moderate';

      health = await prisma.customerHealth.create({
        data: {
          customer_id: customerId,
          score,
          status
        }
      });
    }

    // 2. Calculate or retrieve Churn Prediction
    let prediction = await prisma.prediction.findFirst({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' }
    });

    if (!prediction) {
      const daysSinceLastPurchase = customer.last_purchase
        ? Math.floor((Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      
      const churnRisk = Math.min(
        0.95,
        (daysSinceLastPurchase / 180) * 0.6 + (1 - customer.engagement_score) * 0.4
      );

      const expectedRev = customer.total_spent > 0 
        ? parseFloat((customer.total_spent * (1 - churnRisk)).toFixed(2))
        : 1500;

      prediction = await prisma.prediction.create({
        data: {
          customer_id: customerId,
          churn_risk: churnRisk,
          expected_rev: expectedRev
        }
      });
    }

    // 3. Recommended Action
    let recommendedAction = 'Enroll in VIP Loyalty Program';
    if (prediction.churn_risk > 0.6) {
      recommendedAction = 'Send personalized win-back discount (20% off)';
    } else if (customer.total_spent < 5000) {
      recommendedAction = 'Send cross-sell bundle offer with free shipping';
    }

    res.json({
      customer_id: customerId,
      customerName: customer.name,
      healthScore: health.score,
      healthStatus: health.status,
      churnRisk: prediction.churn_risk,
      expectedRevenue: prediction.expected_rev,
      recommendedAction,
      lastCalculated: health.last_calculated
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch customer recommendation' });
  }
});

export default router;
