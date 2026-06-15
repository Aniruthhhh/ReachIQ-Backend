import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { extendPrisma } from './lib/insforge';
import customersRouter from './routes/customers';
import campaignsRouter from './routes/campaigns';
import segmentsRouter from './routes/segments';
import analyticsRouter from './routes/analytics';
import aiRouter from './routes/ai';
import opportunitiesRouter from './routes/opportunities';
import insightsRouter from './routes/insights';
import recommendationsRouter from './routes/recommendations';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const basePrisma = new PrismaClient();
export const prisma = extendPrisma(basePrisma);
export { io };

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/customers', customersRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/recommendations', recommendationsRouter);

// Receipt callback from Channel Service
app.post('/api/receipt', async (req, res) => {
  const { communicationId, status } = req.body;
  try {
    const comm = await prisma.communication.update({
      where: { id: communicationId },
      data: { status, updated_at: new Date() },
    });

    await prisma.event.create({
      data: {
        communication_id: communicationId,
        event_type: status.toLowerCase(),
        timestamp: new Date(),
        metadata: JSON.stringify({ source: 'channel-service' }),
      },
    });

    // Emit real-time update
    io.emit('communication:update', { communicationId, status, campaignId: comm.campaign_id });
    io.emit('analytics:update', { campaignId: comm.campaign_id });

    res.json({ success: true });
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(500).json({ error: 'Failed to update communication' });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'reachiq-api' }));

// Root info route
app.get('/', (_, res) => {
  res.json({
    message: 'ReachIQ API Server is running',
    health: 'http://localhost:3001/health',
    frontend: 'http://localhost:3000'
  });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 ReachIQ API running on http://localhost:${PORT}`);
});
