// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listTasks } from "../api/tasks";
import axios from "../api/axios";
import "./dashboard.css";
// Chart.js integration
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title as ChartTitle,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartTitle);

function ProgressBar({ label, value, max, color = "#457b9d" }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: 8, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listTasks();
      setTasks(data);
    } catch (e) {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Fetch current user for a friendly greeting
  useEffect(() => {
    axios
      .get("user/me/")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  // Subscribe to SSE and refresh metrics when tasks change
  useEffect(() => {
    const url = `http://localhost:8000/tasks/stream/`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = () => load();
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekFromNowStr = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const stats = useMemo(() => {
    const s = { pending: 0, "in-progress": 0, completed: 0 };
    let dueToday = 0;
    let dueThisWeek = 0;
    (tasks || []).forEach((t) => {
      s[t.status] = (s[t.status] || 0) + 1;
      if (t.due_date === todayStr) dueToday += 1;
      if (t.due_date && t.due_date >= todayStr && t.due_date <= weekFromNowStr) dueThisWeek += 1;
    });
    return { ...s, total: tasks.length, dueToday, dueThisWeek };
  }, [tasks, todayStr, weekFromNowStr]);

  const maxStatus = Math.max(stats.pending, stats["in-progress"], stats.completed, 1);

  // Weekly activity (based on updated_at) for the last 7 days
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayLabels = days.map((d) => d.toLocaleDateString(undefined, { weekday: "short" }));
  const dayKeys = days.map((d) => d.toISOString().slice(0, 10));
  const weeklyCounts = useMemo(() => {
    const map = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    (tasks || []).forEach((t) => {
      const d = new Date(t.updated_at).toISOString().slice(0, 10);
      if (map[d] !== undefined) map[d] += 1;
    });
    return dayKeys.map((k) => map[k]);
  }, [tasks]);

  // Chart datasets
  const statusBarData = {
    labels: ["Pending", "In Progress", "Completed"],
    datasets: [
      {
        label: "Tasks",
        data: [stats.pending, stats["in-progress"], stats.completed],
        backgroundColor: ["#e9c46a", "#2a9d8f", "#264653"],
        borderRadius: 6,
      },
    ],
  };
  const statusBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Tasks by Status" },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const dueDoughnutData = {
    labels: ["Today", "This Week", "Other"],
    datasets: [
      {
        label: "Due",
        data: [stats.dueToday, stats.dueThisWeek, Math.max(stats.total - stats.dueThisWeek, 0)],
        backgroundColor: ["#f94144", "#f8961e", "#90be6d"],
        borderWidth: 0,
      },
    ],
  };
  const dueDoughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" }, title: { display: true, text: "Due Overview" } },
  };

  const weeklyData = {
    labels: dayLabels,
    datasets: [
      {
        label: "Updates",
        data: weeklyCounts,
        backgroundColor: dayLabels.map((_, i) => (i === 4 ? "#2a9d8f" : "#d0d6dc")),
        borderRadius: 8,
      },
    ],
  };
  const weeklyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, title: { display: true, text: "Weekly Activity" } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  // Today tasks list (compact)
  const todayTasks = useMemo(
    () => (tasks || []).filter((t) => t.due_date === todayStr).slice(0, 6),
    [tasks, todayStr]
  );

  return (
    <div className="container-fluid p-3 p-md-4 dashboard">
      <div className="row g-3">
        {/* Main column */}
        <div className="col-lg-8">
          <div className="glass p-3 p-md-4 mb-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <div className="text-muted small">Welcome back</div>
                <h3 className="m-0">{user?.username || "Teammate"}</h3>
              </div>
              <div style={{ maxWidth: 260 }} className="w-100 w-sm-auto">
                <input className="form-control" placeholder="Search tasks" />
              </div>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="soft-card p-3">
                <div className="fw-semibold mb-1">Pending</div>
                <div className="display-6">{stats.pending}</div>
                <div className="progress" style={{ height: 6 }}>
                  <div className="progress-bar bg-warning" style={{ width: `${(stats.pending / Math.max(stats.total, 1)) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="soft-card p-3">
                <div className="fw-semibold mb-1">In Progress</div>
                <div className="display-6">{stats["in-progress"]}</div>
                <div className="progress" style={{ height: 6 }}>
                  <div className="progress-bar bg-info" style={{ width: `${(stats["in-progress"] / Math.max(stats.total, 1)) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="soft-card p-3">
                <div className="fw-semibold mb-1">Completed</div>
                <div className="display-6">{stats.completed}</div>
                <div className="progress" style={{ height: 6 }}>
                  <div className="progress-bar bg-success" style={{ width: `${(stats.completed / Math.max(stats.total, 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="soft-card p-3 p-md-4 mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="m-0">Today</h5>
              <span className="badge bg-secondary">{todayTasks.length}</span>
            </div>
            {todayTasks.length === 0 ? (
              <div className="text-muted">No tasks due today.</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {todayTasks.map((t) => (
                  <div key={t.id} className="pill d-flex align-items-center justify-content-between">
                    <div className="d-flex flex-column">
                      <span className="fw-semibold">{t.title}</span>
                      <span className="small text-muted">{t.priority} • {t.status}</span>
                    </div>
                    <span className="badge text-bg-light border">Due today</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side column */}
        <div className="col-lg-4">
          <div className="soft-card p-3 mb-3">
            <div className="d-flex align-items-center gap-3">
              <div className="avatar-circle">{(user?.username || "U").charAt(0).toUpperCase()}</div>
              <div>
                <div className="fw-semibold">{user?.username || "User"}</div>
                <div className="text-muted small">{user?.is_superuser ? "Administrator" : "Member"}</div>
              </div>
            </div>
          </div>

          <div className="soft-card p-3 mb-3" style={{ minHeight: 260 }}>
            <div style={{ height: 200 }}>
              <Bar data={weeklyData} options={weeklyOptions} />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="soft-card p-3 text-center">
                <div className="h3 m-0">{stats.total}</div>
                <div className="text-muted small">Total</div>
              </div>
            </div>
            <div className="col-6">
              <div className="soft-card p-3 text-center">
                <div className="h3 m-0">{stats.dueThisWeek}</div>
                <div className="text-muted small">Due this week</div>
              </div>
            </div>
          </div>

          <div className="soft-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="m-0">Recent activity</h6>
            </div>
            <div className="d-flex flex-column gap-2">
              {(tasks || [])
                .slice()
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className="recent-item">
                    <div className="small fw-semibold">{t.title}</div>
                    <div className="small text-muted">Updated {new Date(t.updated_at).toLocaleString()}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="text-muted mt-2">Loading…</div>}
      {error && <div className="text-danger mt-2">{error}</div>}
    </div>
  );
}

export default Dashboard;
