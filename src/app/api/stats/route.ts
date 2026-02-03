import { NextResponse } from 'next/server';
import { getSwarmStats, getAgents } from '@/lib/swarm-state';

export async function GET() {
  const stats = getSwarmStats();
  const agents = Array.from(getAgents().values());
  
  // Calculate additional metrics
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
    topEarners,
    capabilityBreakdown,
    averageEarningsPerAgent: stats.totalAgents > 0 
      ? stats.totalPayouts / stats.totalAgents 
      : 0,
    tasksPerHour: calculateTasksPerHour(),
  });
}

function calculateTasksPerHour(): number {
  // Placeholder - would calculate from actual task completion times
  return 0;
}
