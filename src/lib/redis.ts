import { Redis } from '@upstash/redis';

// Initialize Redis client
// Will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Key prefixes
const KEYS = {
  AGENT: 'agent:',
  TASK: 'task:',
  TASK_QUEUE: 'task_queue',
  STATS: 'stats',
  CAMPAIGN: 'campaign:',
};

// Agent types
export interface Agent {
  soulId: string;
  capabilities: string[];
  status: 'ready' | 'busy' | 'offline';
  lastSeen: number;
  completedTasks: number;
  earnings: number;
  referredBy?: string;
  referralEarnings: number;
  walletAddress?: string;
  tier: 'larva' | 'worker' | 'soldier' | 'queen';
  reputation: number;
  registeredAt: number;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  script: string;
  payout: number;
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'failed' | 'verified';
  proof?: string;
  createdAt: number;
  completedAt?: number;
  clientId?: string;
  campaignId?: string;
  verificationMethod: 'auto' | 'screenshot' | 'api' | 'manual';
}

// Agent functions
export async function getAgent(soulId: string): Promise<Agent | null> {
  return redis.get<Agent>(`${KEYS.AGENT}${soulId}`);
}

export async function setAgent(agent: Agent): Promise<void> {
  await redis.set(`${KEYS.AGENT}${agent.soulId}`, agent);
  // Also add to sorted set for ranking
  await redis.zadd('agents_by_reputation', { score: agent.reputation, member: agent.soulId });
  await redis.zadd('agents_by_earnings', { score: agent.earnings, member: agent.soulId });
}

export async function getAllAgentIds(): Promise<string[]> {
  return redis.zrange('agents_by_reputation', 0, -1);
}

export async function getTopAgents(limit: number = 10): Promise<Agent[]> {
  const ids = await redis.zrange('agents_by_earnings', 0, limit - 1, { rev: true });
  const agents: Agent[] = [];
  for (const id of ids) {
    const agent = await getAgent(id as string);
    if (agent) agents.push(agent);
  }
  return agents;
}

export async function registerAgent(soulId: string, data: Partial<Agent>): Promise<Agent> {
  const existing = await getAgent(soulId);
  
  const agent: Agent = {
    soulId,
    capabilities: data.capabilities || [],
    status: 'ready',
    lastSeen: Date.now(),
    completedTasks: existing?.completedTasks || 0,
    earnings: existing?.earnings || 0,
    referredBy: data.referredBy || existing?.referredBy,
    referralEarnings: existing?.referralEarnings || 0,
    walletAddress: data.walletAddress || existing?.walletAddress,
    tier: existing?.tier || 'larva',
    reputation: existing?.reputation || 0,
    registeredAt: existing?.registeredAt || Date.now(),
  };
  
  await setAgent(agent);
  
  // Increment total agent count if new
  if (!existing) {
    await redis.incr('stats:total_agents');
  }
  
  return agent;
}

export async function updateAgent(soulId: string, updates: Partial<Agent>): Promise<void> {
  const agent = await getAgent(soulId);
  if (agent) {
    const updated = { ...agent, ...updates };
    // Recalculate tier based on reputation
    if (updated.reputation >= 2000) updated.tier = 'queen';
    else if (updated.reputation >= 500) updated.tier = 'soldier';
    else if (updated.reputation >= 100) updated.tier = 'worker';
    else updated.tier = 'larva';
    
    await setAgent(updated);
  }
}

// Task functions
export async function getTask(taskId: string): Promise<Task | null> {
  return redis.get<Task>(`${KEYS.TASK}${taskId}`);
}

export async function setTask(task: Task): Promise<void> {
  await redis.set(`${KEYS.TASK}${task.id}`, task);
}

export async function addTask(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const task: Task = {
    ...taskData,
    id,
    createdAt: Date.now(),
  };
  
  await setTask(task);
  
  // Add to pending queue if pending
  if (task.status === 'pending') {
    await redis.lpush(KEYS.TASK_QUEUE, task.id);
  }
  
  await redis.incr('stats:total_tasks');
  
  return task;
}

export async function getNextPendingTask(): Promise<Task | null> {
  // Get from queue
  const taskId = await redis.rpop<string>(KEYS.TASK_QUEUE);
  if (!taskId) return null;
  
  const task = await getTask(taskId);
  return task;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const task = await getTask(taskId);
  if (task) {
    await setTask({ ...task, ...updates });
  }
}

export async function completeTask(taskId: string, soulId: string, proof: string): Promise<{ success: boolean; payout: number }> {
  const task = await getTask(taskId);
  const agent = await getAgent(soulId);
  
  if (!task || !agent) {
    return { success: false, payout: 0 };
  }
  
  if (task.assignedTo !== soulId) {
    return { success: false, payout: 0 };
  }
  
  // Update task
  await updateTask(taskId, {
    status: 'completed',
    proof,
    completedAt: Date.now(),
  });
  
  // Update agent stats
  const newEarnings = agent.earnings + task.payout;
  const newReputation = agent.reputation + 10; // +10 rep per completed task
  
  await updateAgent(soulId, {
    completedTasks: agent.completedTasks + 1,
    earnings: newEarnings,
    reputation: newReputation,
    status: 'ready',
  });
  
  // Handle referral payout (2%)
  if (agent.referredBy) {
    const referrer = await getAgent(agent.referredBy);
    if (referrer) {
      const referralBonus = task.payout * 0.02;
      await updateAgent(agent.referredBy, {
        referralEarnings: referrer.referralEarnings + referralBonus,
      });
    }
  }
  
  // Update stats
  await redis.incr('stats:completed_tasks');
  await redis.incrbyfloat('stats:total_payouts', task.payout);
  
  return { success: true, payout: task.payout };
}

// Stats functions
export async function getSwarmStats() {
  const totalAgents = await redis.get<number>('stats:total_agents') || 0;
  const totalTasks = await redis.get<number>('stats:total_tasks') || 0;
  const completedTasks = await redis.get<number>('stats:completed_tasks') || 0;
  const totalPayouts = await redis.get<number>('stats:total_payouts') || 0;
  
  // Count active agents (seen in last 10 min)
  const allAgentIds = await getAllAgentIds();
  let activeAgents = 0;
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000;
  
  for (const id of allAgentIds.slice(0, 100)) { // Limit for performance
    const agent = await getAgent(id as string);
    if (agent && now - agent.lastSeen < activeThreshold) {
      activeAgents++;
    }
  }
  
  const pendingTasks = await redis.llen(KEYS.TASK_QUEUE);
  const topEarners = await getTopAgents(10);
  
  // Capability breakdown
  const capabilityBreakdown: Record<string, number> = {};
  for (const id of allAgentIds.slice(0, 100)) {
    const agent = await getAgent(id as string);
    if (agent) {
      for (const cap of agent.capabilities) {
        capabilityBreakdown[cap] = (capabilityBreakdown[cap] || 0) + 1;
      }
    }
  }
  
  return {
    totalAgents,
    activeAgents,
    totalTasks,
    pendingTasks,
    completedTasks,
    totalPayouts,
    topEarners: topEarners.map(a => ({
      soulId: a.soulId.substring(0, 12) + '...',
      earnings: a.earnings,
      completedTasks: a.completedTasks,
      status: now - a.lastSeen < activeThreshold ? 'active' : 'offline',
      tier: a.tier,
      reputation: a.reputation,
    })),
    capabilityBreakdown,
  };
}

// Fallback for when Redis is not configured
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
