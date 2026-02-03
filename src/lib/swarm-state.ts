// Molt Hive - Twitter Swarm with Credit Economy
// Earn credits by doing tasks, spend credits to use the swarm

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
  
  registeredAt: number;
}

export interface Task {
  id: string;
  type: 'view_tweet' | 'like_tweet' | 'reply_tweet';
  tweetUrl: string;
  tweetId: string;
  description: string;
  replyText?: string;
  viewDurationSec?: number;
  
  // Credit cost/reward
  creditReward: number;      // What executor earns
  creditCost: number;        // What requester paid
  
  // Who requested this
  requestedBy: string;       // Soul ID of requester
  
  assignedTo: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'failed';
  proof?: string;
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
  },
  // Spending (credits to request task)
  spend: {
    view_tweet: 2,
    like_tweet: 5,
    reply_tweet: 10,
  },
  // Cash out rate
  cashOutRate: 0.01,  // 1 credit = $0.01 USD
  // Buy rate (slightly higher to create spread)
  buyRate: 0.012,     // $0.012 USD = 1 credit
};

// In-memory stores
const agents: Map<string, Agent> = new Map();
const taskQueue: Task[] = [];

// ═══════════════════════════════════════════════════════════════
// AGENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getAgents(): Map<string, Agent> {
  return agents;
}

export function getAgent(soulId: string): Agent | undefined {
  return agents.get(soulId);
}

export function registerAgent(soulId: string, data: Partial<Agent>): Agent {
  const existing = agents.get(soulId);
  const agent: Agent = {
    soulId,
    twitterHandle: data.twitterHandle || existing?.twitterHandle,
    hasTwitterAccess: data.hasTwitterAccess ?? existing?.hasTwitterAccess ?? false,
    status: 'ready',
    lastSeen: Date.now(),
    completedTasks: existing?.completedTasks || 0,
    credits: existing?.credits || 0,
    creditsEarned: existing?.creditsEarned || 0,
    creditsSpent: existing?.creditsSpent || 0,
    creditsCashedOut: existing?.creditsCashedOut || 0,
    registeredAt: existing?.registeredAt || Date.now(),
  };
  agents.set(soulId, agent);
  return agent;
}

export function updateAgent(soulId: string, updates: Partial<Agent>): void {
  const agent = agents.get(soulId);
  if (agent) {
    Object.assign(agent, updates);
    agents.set(soulId, agent);
  }
}

// Add credits to agent (from completing tasks or buying)
export function addCredits(soulId: string, amount: number, source: 'earned' | 'purchased'): boolean {
  const agent = agents.get(soulId);
  if (!agent) return false;
  
  agent.credits += amount;
  if (source === 'earned') {
    agent.creditsEarned += amount;
  }
  agents.set(soulId, agent);
  return true;
}

// Deduct credits from agent (for requesting tasks or cashing out)
export function deductCredits(soulId: string, amount: number, purpose: 'spent' | 'cashout'): boolean {
  const agent = agents.get(soulId);
  if (!agent || agent.credits < amount) return false;
  
  agent.credits -= amount;
  if (purpose === 'spent') {
    agent.creditsSpent += amount;
  } else {
    agent.creditsCashedOut += amount;
  }
  agents.set(soulId, agent);
  return true;
}

// ═══════════════════════════════════════════════════════════════
// TASK FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getTaskQueue(): Task[] {
  return taskQueue;
}

export function addTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  taskQueue.push(newTask);
  return newTask;
}

export function updateTask(taskId: string, updates: Partial<Task>): void {
  const task = taskQueue.find((t) => t.id === taskId);
  if (task) {
    Object.assign(task, updates);
  }
}

export function getNextTask(excludeSoulId?: string): Task | null {
  // Don't assign tasks to the same agent who requested them
  return taskQueue.find((t) => 
    t.status === 'pending' && 
    !t.assignedTo && 
    t.requestedBy !== excludeSoulId
  ) || null;
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export function getSwarmStats() {
  const now = Date.now();
  const activeThreshold = 10 * 60 * 1000;
  
  const allAgents = Array.from(agents.values());
  const activeAgents = allAgents.filter((a) => now - a.lastSeen < activeThreshold);
  const twitterAgents = allAgents.filter((a) => a.hasTwitterAccess);
  
  const totalCreditsInCirculation = allAgents.reduce((sum, a) => sum + a.credits, 0);
  const totalCreditsEarned = allAgents.reduce((sum, a) => sum + a.creditsEarned, 0);
  const totalCreditsSpent = allAgents.reduce((sum, a) => sum + a.creditsSpent, 0);
  
  return {
    totalAgents: agents.size,
    activeAgents: activeAgents.length,
    twitterConnected: twitterAgents.length,
    totalTasks: taskQueue.length,
    pendingTasks: taskQueue.filter((t) => t.status === 'pending').length,
    completedTasks: taskQueue.filter((t) => t.status === 'completed').length,
    
    // Credit economy stats
    totalCreditsInCirculation,
    totalCreditsEarned,
    totalCreditsSpent,
    
    creditRates: CREDIT_RATES,
  };
}
