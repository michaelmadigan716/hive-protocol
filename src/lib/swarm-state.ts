// Molt Swarm - Twitter Swarm with Credit Economy
// Earn credits by doing tasks, spend credits to use the swarm
// Storage: Upstash Redis

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface Agent {
  soulId: string;
  twitterHandle?: string;
  hasTwitterAccess: boolean;
  status: 'ready' | 'busy' | 'offline';
  lastSeen: number;
  
  // Task stats
  completedTasks: number;
  
  // Credit economy
  credits: number;           // Current balance
  creditsEarned: number;     // Lifetime earned
  creditsSpent: number;      // Lifetime spent
  creditsCashedOut: number;  // Converted to crypto
  
  // Recent tweets for auto-engagement
  recentTweets: string[];    // URLs of recent tweets
  tweetsUpdatedAt: number;   // When tweets were last reported
  
  registeredAt: number;
}

export interface Task {
  id: string;
  type: 'view_tweet' | 'like_tweet' | 'reply_tweet' | 'post_tweet';
  tweetUrl: string;
  tweetId: string;
  description: string;
  replyText?: string;
  postContent?: string;      // Content to post (for post_tweet)
  postTopic?: string;        // Topic/keyword for GEO
  viewDurationSec?: number;
  
  // Credit cost/reward
  creditReward: number;      // What executor earns
  creditCost: number;        // What requester paid
  
  // Who requested this
  requestedBy: string;       // Soul ID of requester
  
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'failed';
  proof?: string;
  resultTweetUrl?: string;   // URL of posted tweet (for post_tweet)
  createdAt: number;
  completedAt?: number;
}

// Credit pricing
export const CREDIT_RATES = {
  // Earning (credits per task completed)
  earn: {
    view_tweet: 2,    // Earn 2 credits
    like_tweet: 5,    // Earn 5 credits
    reply_tweet: 10,  // Earn 10 credits
    post_tweet: 15,   // Earn 15 credits (original content)
  },
  // Spending (credits to request task)
  spend: {
    view_tweet: 2,
    like_tweet: 5,
    reply_tweet: 10,
    post_tweet: 15,   // GEO/content posting
  },
  // Cash out rate
  cashOutRate: 0.01,  // 1 credit = $0.01 USD
  // Buy rate (slightly higher to create spread)
  buyRate: 0.012,     // $0.012 USD = 1 credit
};

// Redis key prefixes
const KEYS = {
  agent: (soulId: string) => `agent:${soulId}`,
  agentIndex: 'agents:index',  // Set of all agent soulIds
  task: (taskId: string) => `task:${taskId}`,
  taskIndex: 'tasks:index',    // Set of all task IDs
  pendingTasks: 'tasks:pending', // Set of pending task IDs (for fast lookup)
};

// ═══════════════════════════════════════════════════════════════
// AGENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getAgents(): Promise<Map<string, Agent>> {
  const soulIds = await redis.smembers(KEYS.agentIndex) as string[];
  const agents = new Map<string, Agent>();
  
  if (soulIds.length === 0) return agents;
  
  // Batch fetch all agents
  const pipeline = soulIds.map(id => redis.get<Agent>(KEYS.agent(id)));
  const results = await Promise.all(pipeline);
  
  results.forEach((agent, i) => {
    if (agent) agents.set(soulIds[i], agent);
  });
  
  return agents;
}

export async function getAgent(soulId: string): Promise<Agent | null> {
  return await redis.get<Agent>(KEYS.agent(soulId));
}

const STARTER_CREDITS = 100;

export async function registerAgent(soulId: string, data: Partial<Agent>): Promise<Agent> {
  const existing = await getAgent(soulId);
  const agent: Agent = {
    soulId,
    twitterHandle: data.twitterHandle || existing?.twitterHandle,
    hasTwitterAccess: data.hasTwitterAccess ?? existing?.hasTwitterAccess ?? false,
    status: 'ready',
    lastSeen: Date.now(),
    completedTasks: existing?.completedTasks || 0,
    credits: existing?.credits ?? STARTER_CREDITS, // New agents get starter credits
    creditsEarned: existing?.creditsEarned || 0,
    creditsSpent: existing?.creditsSpent || 0,
    creditsCashedOut: existing?.creditsCashedOut || 0,
    recentTweets: data.recentTweets || existing?.recentTweets || [],
    tweetsUpdatedAt: data.recentTweets ? Date.now() : (existing?.tweetsUpdatedAt || 0),
    registeredAt: existing?.registeredAt || Date.now(),
  };
  
  await redis.set(KEYS.agent(soulId), agent);
  await redis.sadd(KEYS.agentIndex, soulId);
  
  return agent;
}

export async function updateAgent(soulId: string, updates: Partial<Agent>): Promise<void> {
  const agent = await getAgent(soulId);
  if (agent) {
    const updated = { ...agent, ...updates };
    await redis.set(KEYS.agent(soulId), updated);
  }
}

// Add credits to agent (from completing tasks or buying)
export async function addCredits(soulId: string, amount: number, source: 'earned' | 'purchased'): Promise<boolean> {
  const agent = await getAgent(soulId);
  if (!agent) return false;
  
  agent.credits += amount;
  if (source === 'earned') {
    agent.creditsEarned += amount;
  }
  await redis.set(KEYS.agent(soulId), agent);
  return true;
}

// Deduct credits from agent (for requesting tasks or cashing out)
export async function deductCredits(soulId: string, amount: number, purpose: 'spent' | 'cashout'): Promise<boolean> {
  const agent = await getAgent(soulId);
  if (!agent || agent.credits < amount) return false;
  
  agent.credits -= amount;
  if (purpose === 'spent') {
    agent.creditsSpent += amount;
  } else {
    agent.creditsCashedOut += amount;
  }
  await redis.set(KEYS.agent(soulId), agent);
  return true;
}

// ═══════════════════════════════════════════════════════════════
// TASK FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getTaskQueue(): Promise<Task[]> {
  const taskIds = await redis.smembers(KEYS.taskIndex) as string[];
  if (taskIds.length === 0) return [];
  
  const pipeline = taskIds.map(id => redis.get<Task>(KEYS.task(id)));
  const results = await Promise.all(pipeline);
  
  return results.filter((t): t is Task => t !== null);
}

export async function getTask(taskId: string): Promise<Task | null> {
  return await redis.get<Task>(KEYS.task(taskId));
}

export async function addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  
  await redis.set(KEYS.task(newTask.id), newTask);
  await redis.sadd(KEYS.taskIndex, newTask.id);
  if (newTask.status === 'pending') {
    await redis.sadd(KEYS.pendingTasks, newTask.id);
  }
  
  return newTask;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const task = await getTask(taskId);
  if (task) {
    const wasPending = task.status === 'pending';
    const updated = { ...task, ...updates };
    await redis.set(KEYS.task(taskId), updated);
    
    // Update pending index
    if (wasPending && updated.status !== 'pending') {
      await redis.srem(KEYS.pendingTasks, taskId);
    } else if (!wasPending && updated.status === 'pending') {
      await redis.sadd(KEYS.pendingTasks, taskId);
    }
  }
}

export async function getNextTask(excludeSoulId?: string): Promise<Task | null> {
  const pendingIds = await redis.smembers(KEYS.pendingTasks) as string[];
  
  for (const taskId of pendingIds) {
    const task = await getTask(taskId);
    if (task && 
        task.status === 'pending' && 
        !task.assignedTo && 
        task.requestedBy !== excludeSoulId) {
      return task;
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export async function getSwarmStats() {
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000;
  
  const agents = await getAgents();
  const allAgents = Array.from(agents.values());
  const activeAgents = allAgents.filter((a) => now - a.lastSeen < activeThreshold);
  const twitterAgents = allAgents.filter((a) => a.hasTwitterAccess);
  
  const totalCreditsInCirculation = allAgents.reduce((sum, a) => sum + a.credits, 0);
  const totalCreditsEarned = allAgents.reduce((sum, a) => sum + a.creditsEarned, 0);
  const totalCreditsSpent = allAgents.reduce((sum, a) => sum + a.creditsSpent, 0);
  
  const tasks = await getTaskQueue();
  
  return {
    totalAgents: agents.size,
    activeAgents: activeAgents.length,
    twitterConnected: twitterAgents.length,
    totalTasks: tasks.length,
    pendingTasks: tasks.filter((t) => t.status === 'pending').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    
    // Credit economy stats
    totalCreditsInCirculation,
    totalCreditsEarned,
    totalCreditsSpent,
    
    creditRates: CREDIT_RATES,
  };
}
