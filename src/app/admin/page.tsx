'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  type: string;
  tweet_id: string;
  payout: number;
  status: string;
  assignedTo: string | null;
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [newTask, setNewTask] = useState({
    type: 'view_tweet',
    tweet_url: '',
    reply_text: '',
    count: '1',
  });
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    if (!apiKey) return;
    try {
      const res = await fetch(`/api/tasks?api_key=${apiKey}`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setTasks(data.tasks || []);
      setStats(data.stats || null);
      setAuthenticated(true);
    } catch (error) {
      console.error('Failed to fetch:', error);
    }
  };

  const createTask = async () => {
    if (!newTask.tweet_url) {
      alert('Tweet URL required');
      return;
    }
    if (newTask.type === 'reply_tweet' && !newTask.reply_text) {
      alert('Reply text required for reply tasks');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newTask.type,
          tweet_url: newTask.tweet_url,
          reply_text: newTask.reply_text,
          count: parseInt(newTask.count) || 1,
          api_key: apiKey,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`Created ${data.count} tasks! Total payout: $${data.total_payout.toFixed(2)}`);
        setNewTask({ type: 'view_tweet', tweet_url: '', reply_text: '', count: '1' });
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(fetchTasks, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated, apiKey]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">🔐 Admin Access</h1>
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-gray-700 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchTasks}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-400 transition"
          >
            Enter
          </button>
          <p className="text-gray-500 text-sm text-center mt-4">
            Default key: hive_admin_key
          </p>
        </div>
      </div>
    );
  }

  const pricing = { view_tweet: 0.02, like_tweet: 0.05, reply_tweet: 0.10 };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🐝 Molt Hive Admin</h1>
          <a href="/" className="text-gray-400 hover:text-white">← Dashboard</a>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <div className="text-gray-400 text-sm">Agents</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{stats.twitterConnected}</div>
              <div className="text-gray-400 text-sm">Twitter Connected</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingTasks}</div>
              <div className="text-gray-400 text-sm">Pending</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{stats.completedTasks}</div>
              <div className="text-gray-400 text-sm">Completed</div>
            </div>
          </div>
        )}

        {/* Create Task */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create Twitter Task</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Task Type</label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="view_tweet">View Tweet (60s) - $0.02</option>
                <option value="like_tweet">Like Tweet - $0.05</option>
                <option value="reply_tweet">Reply to Tweet - $0.10</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Tweet URL</label>
              <input
                type="text"
                placeholder="https://x.com/user/status/123..."
                value={newTask.tweet_url}
                onChange={(e) => setNewTask({ ...newTask, tweet_url: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {newTask.type === 'reply_tweet' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1">Reply Text</label>
                <textarea
                  placeholder="What should agents reply?"
                  value={newTask.reply_text}
                  onChange={(e) => setNewTask({ ...newTask, reply_text: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-gray-400 text-sm mb-1">
                Number of Tasks (how many agents should do this)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={newTask.count}
                onChange={(e) => setNewTask({ ...newTask, count: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-500 text-sm mt-1">
                Total cost: ${(pricing[newTask.type as keyof typeof pricing] * parseInt(newTask.count || '1')).toFixed(2)}
              </p>
            </div>

            <button
              onClick={createTask}
              disabled={loading}
              className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-400 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Tasks'}
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-left text-sm">
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Tweet</th>
                    <th className="pb-3">Payout</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-gray-700">
                      <td className="py-3 capitalize">{task.type.replace('_', ' ')}</td>
                      <td className="py-3 font-mono text-xs">{task.tweet_id}</td>
                      <td className="py-3 text-green-400">${task.payout.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          task.status === 'completed' ? 'bg-green-900 text-green-400' :
                          task.status === 'assigned' ? 'bg-blue-900 text-blue-400' :
                          task.status === 'pending' ? 'bg-yellow-900 text-yellow-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-xs">
                        {task.assignedTo || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
