import { NextRequest, NextResponse } from 'next/server';
import { getTaskQueue, getAgent, updateAgent, updateTask } from '@/lib/swarm-state';

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

    // Mark task
    updateTask(task_id, {
      status: status === 'success' ? 'completed' : 'failed',
      proof: proof,
      completedAt: Date.now(),
    });

    const agent = getAgent(soul_id);
    
    if (agent && status === 'success') {
      const newEarnings = agent.earnings + task.payout;
      updateAgent(soul_id, {
        completedTasks: agent.completedTasks + 1,
        earnings: newEarnings,
        status: 'ready',
      });

      return NextResponse.json({
        status: 'success',
        message: 'Task completed',
        payout: task.payout,
        total_earnings: newEarnings,
        completed_tasks: agent.completedTasks + 1,
      });
    }

    // Failed task
    if (agent) {
      updateAgent(soul_id, { status: 'ready' });
    }

    return NextResponse.json({
      status: 'failed',
      message: 'Task marked as failed',
    });
  } catch (error) {
    console.error('Complete error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
