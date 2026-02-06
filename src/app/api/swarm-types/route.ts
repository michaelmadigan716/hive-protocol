import { NextRequest, NextResponse } from 'next/server';
import { 
  getSwarmTypes, 
  createSwarmType,
  getAgent,
  SwarmType
} from '@/lib/swarm-state';

// GET - fetch all swarm types
export async function GET() {
  try {
    const swarmTypes = await getSwarmTypes();
    
    // Group by category
    const grouped = {
      twitter: swarmTypes.filter(st => st.category === 'twitter'),
      reddit: swarmTypes.filter(st => st.category === 'reddit'),
      blogs: swarmTypes.filter(st => st.category === 'blogs'),
      github: swarmTypes.filter(st => st.category === 'github'),
      custom: swarmTypes.filter(st => st.category === 'custom'),
    };
    
    return NextResponse.json({
      swarmTypes,
      grouped,
      total: swarmTypes.length,
    });
  } catch (error) {
    console.error('Failed to fetch swarm types:', error);
    return NextResponse.json({ error: 'Failed to fetch swarm types' }, { status: 500 });
  }
}

// POST - create a custom swarm type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { soulId, name, description, icon, category, settings } = body;
    
    if (!soulId || !name || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Verify user exists
    const agent = await getAgent(soulId);
    if (!agent) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const swarmType = await createSwarmType({
      name,
      description,
      icon: icon || '🔹',
      category: category || 'custom',
      createdBy: soulId,
      settings,
    });
    
    return NextResponse.json({ success: true, swarmType });
  } catch (error) {
    console.error('Failed to create swarm type:', error);
    return NextResponse.json({ error: 'Failed to create swarm type' }, { status: 500 });
  }
}
