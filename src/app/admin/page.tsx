'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  type: string;
  description: string;
  payout: number;
  status: string;
  assignedTo: string | null;
  createdAt: number;
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [newTask, setNewTask] = useState({
    type: 'social_post',
    description: '',
    script: '',
    payout: '0.50',
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
      console.error('Failed to fetch tasks:', error);
    }
  };

  const createTask = async () => {
    if (!newTask.description || !newTask.payout) {
      alert('Description and payout required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          api_key: apiKey,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewTask({ type: 'social_post', description: '', script: '', payout: '0.50' });
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
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
            className="w-full bg-gray-700 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <button
            onClick={fetchTasks}
            className="w-full bg-yellow-500 text-black font-bold py-3 rounded-lg hover:bg-yellow-400 transition"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🐝 Hive Admin</h1>
          <a href="/" className="text-gray-400 hover:text-white">
            ← Dashboard
          </a>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <div className="text-gray-400 text-sm">Total Agents</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{stats.activeAgents}</div>
              <div className="text-gray-400 text-sm">Active Now</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{stats.pendingTasks}</div>
              <div className="text-gray-400 text-sm">Pending Tasks</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400">${stats.totalPayouts?.toFixed(2)}</div>
              <div className="text-gray-400 text-sm">Total Payouts</div>
            </div>
          </div>
        )}

        {/* Create Task */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Task</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Type</label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="social_post">Social Post</option>
                <option value="web_browse">Web Browse</option>
                <option value="sentiment">Sentiment</option>
                <option value="viral">Viral Campaign</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Payout ($)</label>
              <input
                type="number"
                step="0.01"
                value={newTask.payout}
                onChange={(e) => setNewTask({ ...newTask, payout: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-400 text-sm mb-1">Description</label>
              <input
                type="text"
                placeholder="What should agents do?"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-gray-400 text-sm mb-1">Script (optional)</label>
              <textarea
                placeholder="Detailed instructions or code..."
                value={newTask.script}
                onChange={(e) => setNewTask({ ...newTask, script: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
          <button
            onClick={createTask}
            disabled={loading}
            className="mt-4 bg-yellow-500 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-400 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>

        {/* Task List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Task Queue</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-left text-sm">
                    <th className="pb-3">ID</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Payout</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-gray-700">
                      <td className="py-3 font-mono text-xs">{task.id.substring(0, 12)}...</td>
                      <td className="py-3 capitalize">{task.type}</td>
                      <td className="py-3 max-w-xs truncate">{task.description}</td>
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
                        {task.assignedTo ? task.assignedTo.substring(0, 8) + '...' : '-'}
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
