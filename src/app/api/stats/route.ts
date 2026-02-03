import { NextResponse } from 'next/server';
import { getSwarmStats, getAgents, CREDIT_RATES } from '@/lib/swarm-state';

export async function GET() {
  const stats = getSwarmStats();
  const agents = Array.from(getAgents().values());
  
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000;
  
  // Top agents by credits
  const topAgents = agents
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 10)
    .map((a) => ({
      soulId: a.soulId.substring(0, 12) + '...',
      twitterHandle: a.twitterHandle || null,
      credits: a.credits,
      creditsEarned: a.creditsEarned,
      completedTasks: a.completedTasks,
      status: now - a.lastSeen < activeThreshold ? 'active' : 'offline',
      twitterConnected: a.hasTwitterAccess,
    }));

  return NextResponse.json({
    ...stats,
    topAgents,
    creditRates: CREDIT_RATES,
    economy: {
      earn: 'Complete tasks → Get credits',
      spend: 'Spend credits → Get your tweets boosted',
      cashout: `1 credit = $${CREDIT_RATES.cashOutRate}`,
      buy: `$${CREDIT_RATES.buyRate} = 1 credit`,
    },
  });
}
