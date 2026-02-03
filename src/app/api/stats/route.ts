import { NextResponse } from 'next/server';
import { getSwarmStats, getAgents } from '@/lib/swarm-state';

export async function GET() {
  const stats = getSwarmStats();
  const agents = Array.from(getAgents().values());
  
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000;
  
  // Top earners
  const topAgents = agents
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10)
    .map((a) => ({
      soulId: a.soulId.substring(0, 12) + '...',
      twitterHandle: a.twitterHandle || null,
      earnings: a.earnings,
      completedTasks: a.completedTasks,
      status: now - a.lastSeen < activeThreshold ? 'active' : 'offline',
      twitterConnected: a.hasTwitterAccess,
    }));

  return NextResponse.json({
    ...stats,
    topAgents,
    taskTypes: {
      view_tweet: '$0.02 - View tweet for 60 seconds',
      like_tweet: '$0.05 - Like a tweet',
      reply_tweet: '$0.10 - Reply to a tweet',
    },
  });
}
