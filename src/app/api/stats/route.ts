import { NextResponse } from 'next/server';
import * as redisStore from '@/lib/redis';
import * as memoryStore from '@/lib/swarm-state';

const useRedis = redisStore.isRedisConfigured();

export async function GET() {
  try {
    if (useRedis) {
      const stats = await redisStore.getSwarmStats();
      return NextResponse.json({
        ...stats,
        storage: 'redis',
        averageEarningsPerAgent: stats.totalAgents > 0 
          ? stats.totalPayouts / stats.totalAgents 
          : 0,
      });
    } else {
      const stats = memoryStore.getSwarmStats();
      const agents = Array.from(memoryStore.getAgents().values());
      
      const now = Date.now();
      const activeThreshold = 10 * 60 * 1000;
      
      const topEarners = agents
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 10)
        .map((a) => ({
          soulId: a.soulId.substring(0, 12) + '...',
          earnings: a.earnings,
          completedTasks: a.completedTasks,
          status: now - a.lastSeen < activeThreshold ? 'active' : 'offline',
        }));

      const capabilityBreakdown: Record<string, number> = {};
      agents.forEach((a) => {
        a.capabilities.forEach((cap) => {
          capabilityBreakdown[cap] = (capabilityBreakdown[cap] || 0) + 1;
        });
      });

      return NextResponse.json({
        ...stats,
        storage: 'memory',
        topEarners,
        capabilityBreakdown,
        averageEarningsPerAgent: stats.totalAgents > 0 
          ? stats.totalPayouts / stats.totalAgents 
          : 0,
      });
    }
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
