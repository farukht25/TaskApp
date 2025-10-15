// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listTasks } from "../api/tasks";
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

  return (
    <div className="container py-4">
      <h2 className="mb-3">Dashboard</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card p-3 h-100">
            <h5>Overview</h5>
            <div className="display-6">{stats.total}</div>
            <div className="text-muted">Total Tasks</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card p-3 h-100">
            <h5>Due</h5>
            <div className="d-flex gap-4">
              <div>
                <div className="h3">{stats.dueToday}</div>
                <div className="text-muted">Today</div>
              </div>
              <div>
                <div className="h3">{stats.dueThisWeek}</div>
                <div className="text-muted">This Week</div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card p-3 h-100" style={{ minHeight: 280 }}>
            <div style={{ height: 220 }}>
              <Bar data={statusBarData} options={statusBarOptions} />
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card p-3 h-100" style={{ minHeight: 280 }}>
            <div style={{ height: 220 }}>
              <Doughnut data={dueDoughnutData} options={dueDoughnutOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
