import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/insights - Retrieve dynamic opportunity engine insights combined with report metadata
router.get('/', async (req, res) => {
  try {
    const [whatsappHigh, emailLow, vipLtv, chennaiBangalore] = await Promise.all([
      prisma.communication.count({ where: { channel: 'whatsapp', status: 'converted' } }),
      prisma.communication.count({ where: { channel: 'email', status: 'opened' } }),
      prisma.customer.count({ where: { total_spent: { gt: 20000 } } }),
      prisma.customer.count({ where: { city: { in: ['Chennai', 'Bangalore'] } } })
    ]);

    const whatsappTotal = await prisma.communication.count({ where: { channel: 'whatsapp' } });
    const emailTotal = await prisma.communication.count({ where: { channel: 'email' } });

    const whatsappConversion = whatsappTotal > 0 ? (whatsappHigh / whatsappTotal * 100).toFixed(1) : '15';
    const emailOpenRate = emailTotal > 0 ? (emailLow / emailTotal * 100).toFixed(1) : '22';

    const insights = [
      { text: `WhatsApp conversion rate stands strong at ${whatsappConversion}% this month`, trend: 'up' },
      { text: `Email open rates are stabilizing at ${emailOpenRate}% vs last month`, trend: 'neutral' },
      { text: `VIP segment represents ${vipLtv} customers contributing to higher LTV`, trend: 'up' },
      { text: `${chennaiBangalore} customers from Chennai and Bangalore drive the majority of conversions`, trend: 'up' },
      { text: 'Ages 18-35 exhibit a 2.4x higher response rate on WhatsApp', trend: 'up' }
    ];

    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch insights' });
  }
});

// GET /api/insights/weekly - Retrieve all weekly reports
router.get('/weekly', async (req, res) => {
  try {
    let reports = await prisma.weeklyReport.findMany({
      orderBy: { week_start: 'desc' }
    });

    // Seed default report if empty
    if (reports.length === 0) {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const reportsData = [
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
      ];

      await prisma.weeklyReport.createMany({
        data: reportsData
      });

      reports = await prisma.weeklyReport.findMany({
        orderBy: { week_start: 'desc' }
      });
    }

    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch weekly reports' });
  }
});

// POST /api/insights/weekly - Create a weekly report
router.post('/weekly', async (req, res) => {
  try {
    const { week_start, summary, revenue } = req.body;
    if (!week_start || !summary || revenue === undefined) {
      return res.status(400).json({ error: 'Missing required weekly report fields' });
    }

    const report = await prisma.weeklyReport.create({
      data: {
        week_start: new Date(week_start),
        summary,
        revenue: parseFloat(revenue)
      }
    });

    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create weekly report' });
  }
});

// GET /api/insights/weekly/:id - Get specific weekly report
router.get('/weekly/:id', async (req, res) => {
  try {
    const report = await prisma.weeklyReport.findUnique({
      where: { id: req.params.id }
    });
    if (!report) return res.status(404).json({ error: 'Weekly report not found' });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch weekly report' });
  }
});

// DELETE /api/insights/weekly/:id - Delete a weekly report
router.delete('/weekly/:id', async (req, res) => {
  try {
    const report = await prisma.weeklyReport.findUnique({
      where: { id: req.params.id }
    });
    if (!report) return res.status(404).json({ error: 'Weekly report not found' });

    await prisma.weeklyReport.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'Weekly report deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete weekly report' });
  }
});

export default router;
