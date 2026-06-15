import { PrismaClient } from '@prisma/client';

const API_KEY = process.env.INSFORGE_API_KEY || 'ik_b871a768b0c3f2aff9abafe7dcd4681a';
const BASE_URL = (process.env.INSFORGE_API_BASE_URL || 'https://j9qbinn3.us-east.insforge.app').replace(/\/$/, '') + '/api/database/records';

const RELATION_FIELDS = new Set([
  'segment',
  'campaigns',
  'communications',
  'events',
  'customer',
  'orders',
  'health',
  'predictions',
  'campaign'
]);

function getTableName(modelName: string): string {
  const map: Record<string, string> = {
    Customer: 'customers',
    Order: 'orders',
    Segment: 'segments',
    Campaign: 'campaigns',
    Communication: 'communications',
    Event: 'events',
    Opportunity: 'opportunities',
    CustomerHealth: 'customer_health',
    Prediction: 'predictions',
    WeeklyReport: 'weekly_reports',
  };
  return map[modelName] || modelName.toLowerCase();
}

function formatRecord(modelName: string, record: any): any {
  if (!record) return record;
  if (Array.isArray(record)) {
    return record.map(r => formatRecord(modelName, r));
  }
  const formatted: any = {};
  for (const [key, val] of Object.entries(record)) {
    if (RELATION_FIELDS.has(key)) {
      continue;
    }
    if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      continue;
    }
    formatted[key] = val;
  }

  if (modelName === 'Opportunity') {
    if ('potentialRevenue' in formatted) {
      formatted.potentialrevenue = formatted.potentialRevenue;
      delete formatted.potentialRevenue;
    }
    if ('suggestedCampaign' in formatted) {
      formatted.suggestedcampaign = formatted.suggestedCampaign;
      delete formatted.suggestedCampaign;
    }
  }
  return formatted;
}

async function replicate(model: string, operation: string, result: any, args?: any) {
  try {
    const tableName = getTableName(model);
    const url = `${BASE_URL}/${tableName}`;
    
    // Headers for InsForge Database API
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    };

    if (operation === 'create') {
      const body = formatRecord(model, result);
      // InsForge POST body must be an array
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify([body]),
      });
      if (!res.ok) {
        console.error(`❌ InsForge: Failed to replicate create on ${tableName}:`, await res.text());
      }
    } else if (operation === 'createMany') {
      const records = formatRecord(model, args?.data || []);
      if (records.length === 0) return;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(records),
      });
      if (!res.ok) {
        console.error(`❌ InsForge: Failed to replicate createMany on ${tableName}:`, await res.text());
      }
    } else if (operation === 'update') {
      const body = formatRecord(model, result);
      const patchUrl = `${url}?id=eq.${result.id}`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`❌ InsForge: Failed to replicate update on ${tableName}:`, await res.text());
      }
    } else if (operation === 'delete') {
      const deleteUrl = `${url}?id=eq.${result.id}`;
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        console.error(`❌ InsForge: Failed to replicate delete on ${tableName}:`, await res.text());
      }
    } else if (operation === 'deleteMany') {
      let deleteUrl = url;
      if (args?.where && Object.keys(args.where).length > 0) {
        const queryParts: string[] = [];
        for (const [key, val] of Object.entries(args.where)) {
          if (typeof val === 'string') {
            queryParts.push(`${key}=eq.${encodeURIComponent(val)}`);
          }
        }
        if (queryParts.length > 0) {
          deleteUrl += `?${queryParts.join('&')}`;
        }
      }
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        console.error(`❌ InsForge: Failed to replicate deleteMany on ${tableName}:`, await res.text());
      }
    }
  } catch (error) {
    console.error(`❌ InsForge: Replication error on ${model} during ${operation}:`, error);
  }
}

export function extendPrisma(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          // Replicate in background (non-blocking for Express API performance)
          replicate(model, 'create', result, args);
          return result;
        },
        async createMany({ model, args, query }) {
          const result = await query(args);
          replicate(model, 'createMany', result, args);
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          replicate(model, 'update', result, args);
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          replicate(model, 'delete', result, args);
          return result;
        },
        async deleteMany({ model, args, query }) {
          const result = await query(args);
          replicate(model, 'deleteMany', result, args);
          return result;
        },
      },
    },
  });
}
