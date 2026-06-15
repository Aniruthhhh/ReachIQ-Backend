import { Router } from 'express';
import { prisma } from '../index';
import { getSegmentCustomers } from './campaigns';

const router = Router();

// GET /api/segments
router.get('/', async (req, res) => {
  const segments = await prisma.segment.findMany({
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { campaigns: true } } },
  });

  // Enrich with estimated audience sizes
  const totalCustomers = await prisma.customer.count();
  const enriched = await Promise.all(segments.map(async (seg, i) => {
    // Return actual database matching sizes instead of static mocks!
    const matching = await getSegmentCustomers(seg.id);
    const size = matching.length;
    return {
      ...seg,
      audienceSize: size,
      avgSpend: size > 0 ? Math.round(matching.reduce((a, b) => a + b.total_spent, 0) / size) : 0,
      revenueOpportunity: size * 3200,
      engagementScore: size > 0 ? (matching.reduce((a, b) => a + b.engagement_score, 0) / size).toFixed(2) : '0.00',
    };
  }));

  res.json(enriched);
});

// POST /api/segments - create segment
router.post('/', async (req, res) => {
  const { name, description, query } = req.body;
  const segment = await prisma.segment.create({
    data: { name, description, query },
  });
  res.status(201).json(segment);
});

// GET /api/segments/:id/preview - get customer previews matching the segment
router.get('/:id/preview', async (req, res) => {
  try {
    const segment = await prisma.segment.findUnique({
      where: { id: req.params.id }
    });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });

    const matching = await getSegmentCustomers(segment.id);
    // Return first 10 customers with order info
    res.json({
      segmentName: segment.name,
      totalCount: matching.length,
      customers: matching.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        city: c.city,
        total_spent: c.total_spent,
        engagement_score: c.engagement_score
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to preview segment customers' });
  }
});

// DELETE /api/segments/:id - delete a segment
router.delete('/:id', async (req, res) => {
  try {
    const segment = await prisma.segment.findUnique({ where: { id: req.params.id } });
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    await prisma.segment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Segment deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete segment' });
  }
});

export default router;

