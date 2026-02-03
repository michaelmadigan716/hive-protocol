import { NextRequest, NextResponse } from 'next/server';
import { 
  getTaskQueue, 
  getAgent, 
  updateAgent, 
  updateTask,
  addCredits,
} from '@/lib/swarm-state';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task_id, soul_id, status, proof } = body;

    if (!task_id || !soul_id) {
      return NextResponse.json(
        { error: 'task_id and soul_id required' },
        { status: 400 }
      );
    }

    const taskQueue = getTaskQueue();
    const task = taskQueue.find((t) => t.id === task_id);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.assignedTo !== soul_id) {
      return NextResponse.json(
        { error: 'Task not assigned to this agent' },
        { status: 403 }
      );
    }

    const agent = getAgent(soul_id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Mark task complete/failed
    updateTask(task_id, {
      status: status === 'success' ? 'completed' : 'failed',
      proof: proof,
      completedAt: Date.now(),
    });

    if (status === 'success') {
      // Award credits to executor
      addCredits(soul_id, task.creditReward, 'earned');
      
      // Update agent stats
      updateAgent(soul_id, {
        completedTasks: agent.completedTasks + 1,
        status: 'ready',
      });

      const updatedAgent = getAgent(soul_id);

      return NextResponse.json({
        status: 'success',
        message: 'Task completed!',
        credits_earned: task.creditReward,
        total_credits: updatedAgent?.credits || 0,
        completed_tasks: (updatedAgent?.completedTasks || 0),
      });
    }

    // Failed task - no credits
    updateAgent(soul_id, { status: 'ready' });

    return NextResponse.json({
      status: 'failed',
      message: 'Task marked as failed - no credits awarded',
      credits_earned: 0,
    });
  } catch (error) {
    console.error('Complete error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
