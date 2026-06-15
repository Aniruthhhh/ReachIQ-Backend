import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

interface SendPayload {
  communicationId: string;
  customerId: string;
  channel: string;
  message: string;
  callbackUrl: string;
}

// Simulated delivery outcomes with realistic probabilities
const DELIVERY_CHAIN: Record<string, Array<{ status: string; probability: number; delayMs: number }>> = {
  whatsapp: [
    { status: 'delivered', probability: 0.97, delayMs: 800 },
    { status: 'opened',    probability: 0.72, delayMs: 15000 },
    { status: 'clicked',   probability: 0.38, delayMs: 45000 },
    { status: 'converted', probability: 0.14, delayMs: 120000 },
  ],
  email: [
    { status: 'delivered', probability: 0.94, delayMs: 1200 },
    { status: 'opened',    probability: 0.52, delayMs: 120000 },
    { status: 'clicked',   probability: 0.22, delayMs: 240000 },
    { status: 'converted', probability: 0.08, delayMs: 480000 },
  ],
  sms: [
    { status: 'delivered', probability: 0.98, delayMs: 600 },
    { status: 'opened',    probability: 0.85, delayMs: 5000 },
    { status: 'clicked',   probability: 0.18, delayMs: 30000 },
    { status: 'converted', probability: 0.06, delayMs: 90000 },
  ],
};

async function sendCallback(callbackUrl: string, communicationId: string, status: string) {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communicationId, status }),
    });
    console.log(`✅ Callback sent: [${communicationId.slice(-8)}] → ${status.toUpperCase()}`);
  } catch (err) {
    console.error(`❌ Callback failed for ${communicationId}:`, err);
  }
}

function simulateDelivery(payload: SendPayload) {
  const channel = payload.channel.toLowerCase();
  const chain = DELIVERY_CHAIN[channel] || DELIVERY_CHAIN.email;

  // Use faster delays for demo (divide by 10 for responsive UI)
  const speedFactor = 0.1;

  let cumulativeDelay = 0;

  for (const step of chain) {
    if (Math.random() > step.probability) {
      // Failed at this step
      if (step.status === 'delivered') {
        cumulativeDelay += step.delayMs * speedFactor;
        setTimeout(() => sendCallback(payload.callbackUrl, payload.communicationId, 'failed'), cumulativeDelay);
      }
      break;
    }

    cumulativeDelay += step.delayMs * speedFactor;
    const status = step.status;
    const delay = cumulativeDelay;

    setTimeout(() => {
      sendCallback(payload.callbackUrl, payload.communicationId, status);
    }, delay);
  }
}

// POST /api/send - receive message send request
app.post('/api/send', (req, res) => {
  const payload: SendPayload = req.body;

  if (!payload.communicationId || !payload.channel) {
    return res.status(400).json({ error: 'communicationId and channel are required' });
  }

  console.log(`📤 Sending via ${payload.channel.toUpperCase()} to customer ${payload.customerId?.slice(-6)}`);

  // Immediately update to "sent"
  setTimeout(() => sendCallback(payload.callbackUrl, payload.communicationId, 'sent'), 100);

  // Then simulate the full delivery chain
  simulateDelivery(payload);

  res.json({ accepted: true, communicationId: payload.communicationId, channel: payload.channel });
});

// POST /api/receipt - internal webhook (pass-through)
app.post('/api/receipt', (req, res) => {
  console.log('Receipt received:', req.body);
  res.json({ ok: true });
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'reachiq-channel-service' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`📡 ReachIQ Channel Service running on http://localhost:${PORT}`);
  console.log(`   Simulating: WhatsApp | Email | SMS delivery chains`);
});
