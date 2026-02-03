import { NextRequest, NextResponse } from 'next/server';
import * as redisStore from '@/lib/redis';

// Campaign pricing tiers
const CAMPAIGN_TIERS = {
  viral_boost: {
    name: 'Viral Boost',
    basePrice: 500,
    agentCut: 0.6,
    description: 'Push content to trend',
  },
  sentiment_shift: {
    name: 'Sentiment Shift',
    basePrice: 2000,
    agentCut: 0.55,
    description: 'Shape market perception',
  },
  market_flood: {
    name: 'Market Flood',
    basePrice: 10000,
    agentCut: 0.5,
    description: 'Dominate a niche',
  },
  custom: {
    name: 'Custom Enterprise',
    basePrice: 0,
    agentCut: 0.5,
    description: 'Custom requirements',
  },
};

interface Campaign {
  id: string;
  clientId: string;
  tier: keyof typeof CAMPAIGN_TIERS;
  name: string;
  description: string;
  budget: number;
  taskCount: number;
  payoutPerTask: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: number;
  completedTasks: number;
}

// Create campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, tier, name, description, budget, task_count, api_key } = body;

    // Validate
    const validKey = process.env.HIVE_CLIENT_KEY || process.env.HIVE_ADMIN_KEY || 'hive_admin_key';
    if (api_key !== validKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (!tier || !CAMPAIGN_TIERS[tier as keyof typeof CAMPAIGN_TIERS]) {
      return NextResponse.json({ 
        error: 'Invalid tier', 
        available_tiers: Object.keys(CAMPAIGN_TIERS) 
      }, { status: 400 });
    }

    const tierConfig = CAMPAIGN_TIERS[tier as keyof typeof CAMPAIGN_TIERS];
    const actualBudget = budget || tierConfig.basePrice;
    const actualTaskCount = task_count || Math.floor(actualBudget * tierConfig.agentCut / 0.50); // Default $0.50 per task
    const payoutPerTask = (actualBudget * tierConfig.agentCut) / actualTaskCount;

    const campaign: Campaign = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientId: client_id || 'anonymous',
      tier: tier as keyof typeof CAMPAIGN_TIERS,
      name: name || tierConfig.name,
      description: description || tierConfig.description,
      budget: actualBudget,
      taskCount: actualTaskCount,
      payoutPerTask,
      status: 'pending',
      createdAt: Date.now(),
      completedTasks: 0,
    };

    // Store campaign (would use Redis in production)
    // For now, just return the campaign details

    return NextResponse.json({
      status: 'created',
      campaign: {
        id: campaign.id,
        tier: campaign.tier,
        name: campaign.name,
        budget: campaign.budget,
        taskCount: campaign.taskCount,
        payoutPerTask: campaign.payoutPerTask,
        platformFee: campaign.budget * (1 - tierConfig.agentCut),
        agentPayout: campaign.budget * tierConfig.agentCut,
      },
      next_steps: [
        'Use POST /api/tasks with campaign_id to create tasks',
        'Or use PUT /api/tasks for bulk task creation',
        'Tasks will be distributed to available agents',
      ],
    });
  } catch (error) {
    console.error('Campaign error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Get campaign tiers/pricing
export async function GET() {
  return NextResponse.json({
    tiers: Object.entries(CAMPAIGN_TIERS).map(([key, value]) => ({
      id: key,
      ...value,
      platformFee: `${(1 - value.agentCut) * 100}%`,
      agentCut: `${value.agentCut * 100}%`,
    })),
    customPricing: 'Contact for enterprise deals',
  });
}
