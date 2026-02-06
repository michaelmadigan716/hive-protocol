import { NextRequest, NextResponse } from 'next/server';
import { 
  getPublicStatsConfig, 
  setPublicStatsConfig, 
  getSwarmStats,
  ADMIN_KEY 
} from '@/lib/swarm-state';

// GET - fetch current config (requires admin key)
export async function GET(request: NextRequest) {
  const authKey = request.headers.get('x-admin-key');
  
  if (authKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const config = await getPublicStatsConfig();
  const realStats = await getSwarmStats();
  
  return NextResponse.json({
    config,
    realStats: {
      totalAgents: realStats.totalAgents,
      activeAgents: realStats.activeAgents,
      twitterConnected: realStats.twitterConnected,
      completedTasks: realStats.completedTasks,
      totalCreditsInCirculation: realStats.totalCreditsInCirculation,
    },
  });
}

// POST - update config (requires admin key)
export async function POST(request: NextRequest) {
  const authKey = request.headers.get('x-admin-key');
  
  if (authKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const updated = await setPublicStatsConfig(body);
    const realStats = await getSwarmStats();
    
    return NextResponse.json({ 
      success: true, 
      config: updated,
      realStats: {
        totalAgents: realStats.totalAgents,
        activeAgents: realStats.activeAgents,
        twitterConnected: realStats.twitterConnected,
        completedTasks: realStats.completedTasks,
        totalCreditsInCirculation: realStats.totalCreditsInCirculation,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
