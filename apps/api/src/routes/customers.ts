import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/customers - list with pagination, search, filter
router.get('/', async (req, res) => {
  const { page = '1', limit = '20', search, city, minSpend, maxSpend } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string } },
      { email: { contains: search as string } },
      { phone: { contains: search as string } },
    ];
  }
  if (city) where.city = city as string;
  if (minSpend) where.total_spent = { ...where.total_spent, gte: parseFloat(minSpend as string) };
  if (maxSpend) where.total_spent = { ...where.total_spent, lte: parseFloat(maxSpend as string) };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: parseInt(limit as string),
      orderBy: { total_spent: 'desc' },
      include: { _count: { select: { orders: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({ customers, total, page: parseInt(page as string), totalPages: Math.ceil(total / parseInt(limit as string)) });
});

// GET /api/customers/:id - individual profile
router.get('/:id', async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      orders: { orderBy: { created_at: 'desc' }, take: 10 },
      communications: {
        orderBy: { sent_at: 'desc' },
        take: 20,
        include: {
          campaign: true,
          events: { orderBy: { timestamp: 'asc' } },
        },
      },
    },
  });

  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // AI summary
  const daysSinceLastPurchase = customer.last_purchase
    ? Math.floor((Date.now() - customer.last_purchase.getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const churnProbability = Math.min(
    0.95,
    (daysSinceLastPurchase / 180) * 0.6 + (1 - customer.engagement_score) * 0.4
  );

  const aiSummary = {
    churnProbability: Math.round(churnProbability * 100),
    insight: churnProbability > 0.6
      ? `${customer.name.split(' ')[0]} is a ${customer.total_spent > 10000 ? 'high-value' : 'regular'} customer showing signs of declining engagement. Immediate re-engagement recommended.`
      : `${customer.name.split(' ')[0]} is an active customer with strong purchase history. Focus on upsell and loyalty programs.`,
    suggestedAction: churnProbability > 0.6
      ? 'Send personalized win-back offer with 20% discount'
      : 'Enroll in loyalty program and send early access to new collection',
  };

  res.json({ ...customer, aiSummary });
});

// POST /api/customers - Ingest a single customer record
router.post('/', async (req, res) => {
  const { name, email, phone, city, age, gender, industry, total_spent = 0, engagement_score = 0.5 } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        city: city || 'Unspecified',
        age: age ? parseInt(age) : 30,
        gender: gender || 'Unspecified',
        industry: industry || 'D2C Brand',
        total_spent: parseFloat(total_spent),
        engagement_score: parseFloat(engagement_score),
      },
    });
    res.status(201).json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to ingest customer record' });
  }
});

// POST /api/customers/bulk - Bulk ingest customer records
router.post('/bulk', async (req, res) => {
  const { customers } = req.body;

  if (!customers || !Array.isArray(customers)) {
    return res.status(400).json({ error: 'An array of customers is required' });
  }

  try {
    const results = [];
    for (const cust of customers) {
      if (!cust.name || !cust.email || !cust.phone) continue;
      
      const created = await prisma.customer.upsert({
        where: { email: cust.email },
        update: {
          name: cust.name,
          phone: cust.phone,
          city: cust.city || 'Unspecified',
          age: cust.age ? parseInt(cust.age) : 30,
          gender: cust.gender || 'Unspecified',
          industry: cust.industry || 'D2C Brand',
          total_spent: cust.total_spent ? parseFloat(cust.total_spent) : 0,
          engagement_score: cust.engagement_score ? parseFloat(cust.engagement_score) : 0.5,
        },
        create: {
          name: cust.name,
          email: cust.email,
          phone: cust.phone,
          city: cust.city || 'Unspecified',
          age: cust.age ? parseInt(cust.age) : 30,
          gender: cust.gender || 'Unspecified',
          industry: cust.industry || 'D2C Brand',
          total_spent: cust.total_spent ? parseFloat(cust.total_spent) : 0,
          engagement_score: cust.engagement_score ? parseFloat(cust.engagement_score) : 0.5,
        },
      });
      results.push(created);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed bulk ingestion' });
  }
});

// POST /api/customers/:id/orders - Ingest an order for a customer
router.post('/:id/orders', async (req, res) => {
  const { amount, category } = req.body;
  const customerId = req.params.id;

  if (amount === undefined || !category) {
    return res.status(400).json({ error: 'Amount and category are required' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const order = await prisma.order.create({
      data: {
        customer_id: customerId,
        amount: parseFloat(amount),
        category,
      },
    });

    // Update customer's total spent and engagement score
    const totalOrders = await prisma.order.count({ where: { customer_id: customerId } });
    const updatedSpent = customer.total_spent + parseFloat(amount);
    const updatedScore = Math.min(1.0, 0.3 + (totalOrders * 0.1) + (updatedSpent / 20000));

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        total_spent: updatedSpent,
        engagement_score: updatedScore,
        last_purchase: new Date(),
      },
    });

    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to ingest order' });
  }
});

export default router;

