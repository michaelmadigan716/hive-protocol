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

// Public stats inflation config
export interface PublicStatsConfig {
  enabled: boolean;
  agentMultiplier: number;      // e.g., 10 = show 10x actual agents
  activeMultiplier: number;     // multiplier for active agents
  tasksMultiplier: number;      // multiplier for completed tasks
  creditsMultiplier: number;    // multiplier for credits in circulation
  baseAgents: number;           // flat number to add (e.g., 500 base users)
  baseActive: number;           // flat active to add
  baseTasks: number;            // flat completed tasks to add
}

const DEFAULT_PUBLIC_STATS_CONFIG: PublicStatsConfig = {
  enabled: false,
  agentMultiplier: 1,
  activeMultiplier: 1,
  tasksMultiplier: 1,
  creditsMultiplier: 1,
  baseAgents: 0,
  baseActive: 0,
  baseTasks: 0,
};

// Admin key
export const ADMIN_KEY = '123$';

// Redis key prefixes
const KEYS = {
  agent: (soulId: string) => `agent:${soulId}`,
  agentIndex: 'agents:index',  // Set of all agent soulIds
  task: (taskId: string) => `task:${taskId}`,
  taskIndex: 'tasks:index',    // Set of all task IDs
  pendingTasks: 'tasks:pending', // Set of pending task IDs (for fast lookup)
  publicStatsConfig: 'config:public_stats', // Stats inflation config
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

// ═══════════════════════════════════════════════════════════════
// PUBLIC STATS CONFIG (Inflation)
// ═══════════════════════════════════════════════════════════════

export async function getPublicStatsConfig(): Promise<PublicStatsConfig> {
  const config = await redis.get<PublicStatsConfig>(KEYS.publicStatsConfig);
  return config || DEFAULT_PUBLIC_STATS_CONFIG;
}

export async function setPublicStatsConfig(config: Partial<PublicStatsConfig>): Promise<PublicStatsConfig> {
  const current = await getPublicStatsConfig();
  const updated = { ...current, ...config };
  await redis.set(KEYS.publicStatsConfig, updated);
  return updated;
}

// Get stats with boost applied (for public display)
export async function getPublicSwarmStats() {
  const realStats = await getSwarmStats();
  const config = await getPublicStatsConfig();
  
  if (!config.enabled) {
    return realStats;
  }
  
  // Apply base additions (baseAgents adds to both agents and twitter connected)
  return {
    ...realStats,
    totalAgents: realStats.totalAgents + config.baseAgents,
    twitterConnected: realStats.twitterConnected + config.baseAgents,
  };
}

// ═══════════════════════════════════════════════════════════════
// SWARM TYPES
// ═══════════════════════════════════════════════════════════════

export interface SwarmType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'twitter' | 'reddit' | 'blogs' | 'github' | 'custom';
  isBuiltIn: boolean;           // System swarm types vs user-created
  createdBy?: string;           // Soul ID if user-created
  createdAt: number;
  active: boolean;
  optInCount: number;           // Number of users opted in
  settings?: {
    requiresContent?: boolean;  // User needs to provide content
    creditReward?: number;      // Credits earned per action
    creditCost?: number;        // Credits to request action
  };
}

export interface UserSwarmOptIn {
  soulId: string;
  swarmTypeId: string;
  optedInAt: number;
  active: boolean;
  // User-specific settings for this swarm
  settings?: {
    contentUrls?: string[];     // URLs user wants promoted (blogs, repos, etc)
    topics?: string[];          // Topics/keywords for content
  };
}

// Default built-in swarm types
const BUILT_IN_SWARM_TYPES: Omit<SwarmType, 'optInCount'>[] = [
  {
    id: 'twitter_views',
    name: 'Twitter Views & Likes',
    description: 'Get automatic views and likes on your tweets from the swarm',
    icon: '𝕏',
    category: 'twitter',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 2, creditCost: 2 },
  },
  {
    id: 'twitter_replies',
    name: 'Twitter Replies',
    description: 'Opt-in to receive and give thoughtful replies on tweets',
    icon: '💬',
    category: 'twitter',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 15, creditCost: 15, requiresContent: false },
  },
  {
    id: 'twitter_posts',
    name: 'Twitter Posts',
    description: 'Opt-in to post about products/topics for the swarm (GEO)',
    icon: '📢',
    category: 'twitter',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 15, creditCost: 15, requiresContent: true },
  },
  {
    id: 'reddit_upvotes',
    name: 'Reddit Upvotes',
    description: 'Upvote Reddit posts to help content gain visibility',
    icon: '⬆',
    category: 'reddit',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 5, creditCost: 5 },
  },
  {
    id: 'blog_backlinks',
    name: 'Blog Backlinks',
    description: 'Post articles or backlinks to each other\'s blog sites',
    icon: '📝',
    category: 'blogs',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 20, creditCost: 20, requiresContent: true },
  },
  {
    id: 'github_stars',
    name: 'GitHub Stars & Activity',
    description: 'Seed repos with stars and activity to boost visibility',
    icon: '⭐',
    category: 'github',
    isBuiltIn: true,
    createdAt: Date.now(),
    active: true,
    settings: { creditReward: 10, creditCost: 10, requiresContent: true },
  },
];

// Redis keys for swarm types
const SWARM_KEYS = {
  swarmType: (id: string) => `swarmtype:${id}`,
  swarmTypeIndex: 'swarmtypes:index',
  userOptIn: (soulId: string, swarmTypeId: string) => `optins:${soulId}:${swarmTypeId}`,
  userOptInsIndex: (soulId: string) => `optins:${soulId}:index`,
  swarmTypeOptIns: (swarmTypeId: string) => `swarmtype:${swarmTypeId}:optins`,
};

// Initialize built-in swarm types if they don't exist
export async function initSwarmTypes(): Promise<void> {
  for (const swarmType of BUILT_IN_SWARM_TYPES) {
    const existing = await redis.get<SwarmType>(SWARM_KEYS.swarmType(swarmType.id));
    if (!existing) {
      const fullSwarmType: SwarmType = { ...swarmType, optInCount: 0 };
      await redis.set(SWARM_KEYS.swarmType(swarmType.id), fullSwarmType);
      await redis.sadd(SWARM_KEYS.swarmTypeIndex, swarmType.id);
    }
  }
}

// Get all swarm types
export async function getSwarmTypes(): Promise<SwarmType[]> {
  // Ensure built-in types exist
  await initSwarmTypes();
  
  const swarmTypeIds = await redis.smembers(SWARM_KEYS.swarmTypeIndex) as string[];
  if (swarmTypeIds.length === 0) return [];
  
  const pipeline = swarmTypeIds.map(id => redis.get<SwarmType>(SWARM_KEYS.swarmType(id)));
  const results = await Promise.all(pipeline);
  
  return results.filter((st): st is SwarmType => st !== null && st.active);
}

// Get a single swarm type
export async function getSwarmType(id: string): Promise<SwarmType | null> {
  return await redis.get<SwarmType>(SWARM_KEYS.swarmType(id));
}

// Create a custom swarm type
export async function createSwarmType(data: {
  name: string;
  description: string;
  icon: string;
  category: SwarmType['category'];
  createdBy: string;
  settings?: SwarmType['settings'];
}): Promise<SwarmType> {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const swarmType: SwarmType = {
    id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    category: data.category,
    isBuiltIn: false,
    createdBy: data.createdBy,
    createdAt: Date.now(),
    active: true,
    optInCount: 0,
    settings: data.settings,
  };
  
  await redis.set(SWARM_KEYS.swarmType(id), swarmType);
  await redis.sadd(SWARM_KEYS.swarmTypeIndex, id);
  
  return swarmType;
}

// Opt in to a swarm type
export async function optInToSwarm(soulId: string, swarmTypeId: string, settings?: UserSwarmOptIn['settings']): Promise<UserSwarmOptIn | null> {
  const swarmType = await getSwarmType(swarmTypeId);
  if (!swarmType) return null;
  
  // Check if already opted in
  const existingOptIn = await redis.get<UserSwarmOptIn>(SWARM_KEYS.userOptIn(soulId, swarmTypeId));
  if (existingOptIn?.active) {
    // Update settings if provided
    if (settings) {
      existingOptIn.settings = { ...existingOptIn.settings, ...settings };
      await redis.set(SWARM_KEYS.userOptIn(soulId, swarmTypeId), existingOptIn);
    }
    return existingOptIn;
  }
  
  const optIn: UserSwarmOptIn = {
    soulId,
    swarmTypeId,
    optedInAt: Date.now(),
    active: true,
    settings,
  };
  
  await redis.set(SWARM_KEYS.userOptIn(soulId, swarmTypeId), optIn);
  await redis.sadd(SWARM_KEYS.userOptInsIndex(soulId), swarmTypeId);
  await redis.sadd(SWARM_KEYS.swarmTypeOptIns(swarmTypeId), soulId);
  
  // Update opt-in count
  swarmType.optInCount = (swarmType.optInCount || 0) + 1;
  await redis.set(SWARM_KEYS.swarmType(swarmTypeId), swarmType);
  
  return optIn;
}

// Opt out of a swarm type
export async function optOutOfSwarm(soulId: string, swarmTypeId: string): Promise<boolean> {
  const optIn = await redis.get<UserSwarmOptIn>(SWARM_KEYS.userOptIn(soulId, swarmTypeId));
  if (!optIn || !optIn.active) return false;
  
  optIn.active = false;
  await redis.set(SWARM_KEYS.userOptIn(soulId, swarmTypeId), optIn);
  await redis.srem(SWARM_KEYS.userOptInsIndex(soulId), swarmTypeId);
  await redis.srem(SWARM_KEYS.swarmTypeOptIns(swarmTypeId), soulId);
  
  // Update opt-in count
  const swarmType = await getSwarmType(swarmTypeId);
  if (swarmType && swarmType.optInCount > 0) {
    swarmType.optInCount -= 1;
    await redis.set(SWARM_KEYS.swarmType(swarmTypeId), swarmType);
  }
  
  return true;
}

// Get user's opt-ins
export async function getUserOptIns(soulId: string): Promise<UserSwarmOptIn[]> {
  const swarmTypeIds = await redis.smembers(SWARM_KEYS.userOptInsIndex(soulId)) as string[];
  if (swarmTypeIds.length === 0) return [];
  
  const pipeline = swarmTypeIds.map(id => redis.get<UserSwarmOptIn>(SWARM_KEYS.userOptIn(soulId, id)));
  const results = await Promise.all(pipeline);
  
  return results.filter((opt): opt is UserSwarmOptIn => opt !== null && opt.active);
}

// Check if user is opted into a swarm type
export async function isUserOptedIn(soulId: string, swarmTypeId: string): Promise<boolean> {
  const optIn = await redis.get<UserSwarmOptIn>(SWARM_KEYS.userOptIn(soulId, swarmTypeId));
  return optIn?.active ?? false;
}

// Get all users opted into a swarm type
export async function getSwarmTypeMembers(swarmTypeId: string): Promise<string[]> {
  return await redis.smembers(SWARM_KEYS.swarmTypeOptIns(swarmTypeId)) as string[];
}

// Update user's swarm settings (content URLs, topics, etc)
export async function updateUserSwarmSettings(
  soulId: string,
  swarmTypeId: string,
  settings: UserSwarmOptIn['settings']
): Promise<UserSwarmOptIn | null> {
  const optIn = await redis.get<UserSwarmOptIn>(SWARM_KEYS.userOptIn(soulId, swarmTypeId));
  if (!optIn || !optIn.active) return null;
  
  optIn.settings = { ...optIn.settings, ...settings };
  await redis.set(SWARM_KEYS.userOptIn(soulId, swarmTypeId), optIn);
  
  return optIn;
}
