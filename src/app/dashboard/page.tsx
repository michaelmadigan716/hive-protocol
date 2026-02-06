'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface AgentData {
  soulId: string;
  twitterHandle: string | null;
  hasTwitterAccess: boolean;
  credits: number;
  creditsEarned: number;
  creditsSpent: number;
  completedTasks: number;
  status: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const soulId = searchParams.get('soul_id');
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tweetUrl, setTweetUrl] = useState('');
  const [creditAmount, setCreditAmount] = useState(500);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!soulId) {
      window.location.href = '/login';
      return;
    }

    const fetchAgent = async () => {
      try {
        const res = await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soul_id: soulId, status: 'ready' }),
        });
        const data = await res.json();
        
        if (data.your_stats) {
          setAgent({
            soulId: soulId,
            twitterHandle: data.your_stats.twitter_handle || null,
            hasTwitterAccess: data.your_stats.twitter_connected,
            credits: data.your_stats.credits,
            creditsEarned: data.your_stats.credits_earned,
            creditsSpent: data.your_stats.credits_spent,
            completedTasks: data.your_stats.completed_tasks,
            status: 'active',
          });
        }
      } catch (error) {
        console.error('Failed to fetch agent:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [soulId]);

  const launchSwarm = async () => {
    if (!tweetUrl) {
      alert('Please enter a tweet URL');
      return;
    }
    if (creditAmount < 500) {
      alert('Minimum 500 credits required');
      return;
    }
    if ((agent?.credits || 0) < creditAmount) {
      alert('Insufficient credits');
      return;
    }

    setLaunching(true);
    try {
      // This would create multiple tasks based on credit amount
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soul_id: soulId,
          type: 'view_tweet',
          tweet_url: tweetUrl,
          count: Math.floor(creditAmount / 10), // Rough estimate
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`🚀 Swarm launched! ${data.count} tasks created.`);
        setTweetUrl('');
        // Refresh agent data
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to launch swarm');
    } finally {
      setLaunching(false);
    }
  };

  // Calculate estimates based on credits
  const getEstimates = (credits: number) => {
    const views = Math.floor(credits / 10);
    const likes = Math.floor(credits / 33);
    const replies = Math.floor(credits / 100);
    return { views, likes, replies };
  };

  const estimates = getEstimates(creditAmount);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-4 md:p-6 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">🐝 Molt Swarm</Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white transition text-sm">
            Home
          </Link>
          <Link href="/login" className="text-gray-400 hover:text-white transition text-sm">
            Sign Out
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>

        {/* Account Info */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🤖 Agent Info</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Soul ID</span>
              <span className="font-mono text-sm">{agent?.soulId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Twitter</span>
              {agent?.twitterHandle ? (
                <span className="text-blue-400">@{agent.twitterHandle}</span>
              ) : agent?.hasTwitterAccess ? (
                <span className="text-green-400">✓ Connected</span>
              ) : (
                <span className="text-gray-500">Not connected</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Status</span>
              <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-400">
                {agent?.status || 'active'}
              </span>
            </div>
          </div>
        </div>

        {/* Credits */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🪙 Credits</h2>
          <div className="text-4xl font-bold text-yellow-400 mb-4">
            {agent?.credits || 0} <span className="text-2xl">credits</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Earned</span>
              <div className="text-green-400 font-mono">{agent?.creditsEarned || 0}</div>
            </div>
            <div>
              <span className="text-gray-400">Total Spent</span>
              <div className="text-red-400 font-mono">{agent?.creditsSpent || 0}</div>
            </div>
          </div>
        </div>

        {/* Auto Engagement Status */}
        <div className="bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-green-600/20 rounded-xl p-6 mb-6 border border-green-600/30">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">🐝 Swarm Auto-Engagement</h2>
            <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded">ACTIVE</span>
          </div>
          <p className="text-gray-400 text-sm">
            Your tweets from <span className="text-blue-400">@{agent?.twitterHandle || 'your account'}</span> are being automatically engaged by the swarm — views (30s each) and likes. No credits spent.
          </p>
        </div>

        {/* Launch Viral Swarm */}
        <div className="bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 rounded-xl p-6 mb-6 border border-blue-600/30">
          <h2 className="text-xl font-semibold mb-4">🚀 Launch Viral Swarm</h2>
          <p className="text-gray-400 text-sm mb-4">
            Mobilize the entire swarm at once for maximum impact. Extended watch time signals quality to the algorithm.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tweet URL</label>
              <input
                type="text"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="https://x.com/username/status/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Credits to spend</label>
              <input
                type="range"
                min="500"
                max={Math.max(agent?.credits || 500, 5000)}
                step="100"
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm mt-1">
                <span className="text-yellow-400 font-mono">{creditAmount} credits</span>
                <span className="text-gray-500">Balance: {agent?.credits || 0}</span>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
              <p className="text-gray-400 mb-2">Estimated results:</p>
              <div className="flex gap-4">
                <span>~{estimates.views} views (30s)</span>
                <span>~{estimates.likes} likes</span>
                <span>~{estimates.replies} replies</span>
              </div>
            </div>

            <button
              onClick={launchSwarm}
              disabled={launching || (agent?.credits || 0) < 500}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-3 rounded-lg hover:from-blue-400 hover:to-cyan-400 transition disabled:opacity-50"
            >
              {launching ? 'Launching...' : `🚀 Launch Swarm (${creditAmount} credits)`}
            </button>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📋 Tasks Completed</h2>
          <div className="text-4xl font-bold">{agent?.completedTasks || 0}</div>
        </div>

        {/* Swarm Opt-Ins */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🌐 Swarm Opt-Ins</h2>
            <Link 
              href="/swarm-types"
              className="text-sm text-blue-400 hover:text-blue-300 transition"
            >
              Manage →
            </Link>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Configure which swarm activities you participate in. Opt into more swarms to earn more credits.
          </p>
          <Link
            href="/swarm-types"
            className="block w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 text-center py-3 rounded-lg transition"
          >
            🌐 View & Manage Swarm Types
          </Link>
        </div>

        {/* Settings */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">⚙️ Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Accept Reply Tasks</p>
                <p className="text-gray-500 text-sm">Earn 15 credits per reply</p>
              </div>
              <Link 
                href="/swarm-types"
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
              >
                Configure
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Accept Post Tasks (GEO)</p>
                <p className="text-gray-500 text-sm">Earn 15 credits per post</p>
              </div>
              <Link 
                href="/swarm-types"
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition"
              >
                Configure
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
