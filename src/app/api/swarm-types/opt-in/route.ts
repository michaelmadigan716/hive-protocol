import { NextRequest, NextResponse } from 'next/server';
import { 
  optInToSwarm,
  optOutOfSwarm,
  getUserOptIns,
  isUserOptedIn,
  updateUserSwarmSettings,
  getAgent,
} from '@/lib/swarm-state';

// GET - get user's opt-ins
export async function GET(request: NextRequest) {
  try {
    const soulId = request.nextUrl.searchParams.get('soulId');
    const swarmTypeId = request.nextUrl.searchParams.get('swarmTypeId');
    
    if (!soulId) {
      return NextResponse.json({ error: 'soulId required' }, { status: 400 });
    }
    
    // Check specific swarm type opt-in status
    if (swarmTypeId) {
      const isOptedIn = await isUserOptedIn(soulId, swarmTypeId);
      return NextResponse.json({ isOptedIn });
    }
    
    // Get all user opt-ins
    const optIns = await getUserOptIns(soulId);
    return NextResponse.json({ optIns });
  } catch (error) {
    console.error('Failed to get opt-ins:', error);
    return NextResponse.json({ error: 'Failed to get opt-ins' }, { status: 500 });
  }
}

// POST - opt in or out of a swarm type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soulId, swarmTypeId, action, settings } = body;
    
    if (!soulId || !swarmTypeId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Verify user exists
    const agent = await getAgent(soulId);
    if (!agent) {
      return NextResponse.json({ error: 'User not found. Please create an account first.' }, { status: 404 });
    }
    
    if (action === 'opt-in') {
      const optIn = await optInToSwarm(soulId, swarmTypeId, settings);
      if (!optIn) {
        return NextResponse.json({ error: 'Swarm type not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, optIn });
    }
    
    if (action === 'opt-out') {
      const success = await optOutOfSwarm(soulId, swarmTypeId);
      return NextResponse.json({ success });
    }
    
    if (action === 'update-settings') {
      const optIn = await updateUserSwarmSettings(soulId, swarmTypeId, settings);
      if (!optIn) {
        return NextResponse.json({ error: 'Not opted in to this swarm' }, { status: 400 });
      }
      return NextResponse.json({ success: true, optIn });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to process opt-in:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
