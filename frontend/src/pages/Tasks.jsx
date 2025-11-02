// src/pages/Tasks.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { FixedSizeList as VirtualList } from "react-window";
import { listTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE } from "../api/axios";
import { log } from "../utils/logger";
import { clientLog } from "../utils/clientLog";

const emptyForm = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: "",
};

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", priority: "", search: "", due_after: "", due_before: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const queryClient = useQueryClient();
  // Single source of truth: fetch all tasks for the user (bounded)
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["tasks_all"],
    queryFn: async ({ signal }) => {
      setError("");
      const data = await listTasks({ limit: 1000 }, { signal });
      return data;
    },
    placeholderData: (prev) => prev ?? [],
    keepPreviousData: true,
    initialData: [],
    staleTime: 30_000,
  });
  // Apply local filters
  const applyFilters = useCallback((all, f) => {
    let arr = Array.isArray(all) ? all : [];
    if (f.status) arr = arr.filter((t) => t.status === f.status);
    if (f.priority) arr = arr.filter((t) => t.priority === f.priority);
    if (f.due_after) {
      try { const d = new Date(f.due_after).toISOString().slice(0,10); arr = arr.filter((t) => t.due_date && t.due_date >= d); } catch {}
    }
    if (f.due_before) {
      try { const d = new Date(f.due_before).toISOString().slice(0,10); arr = arr.filter((t) => t.due_date && t.due_date <= d); } catch {}
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      arr = arr.filter((t) => (t.title||"").toLowerCase().includes(q) || (t.description||"").toLowerCase().includes(q));
    }
    return arr;
  }, []);
  useEffect(() => { setTasks(applyFilters(data, filters)); }, [data, filters, applyFilters]);

  // Component mount/unmount logging
  useEffect(() => {
    log("tasks_mount", {});
    return () => log("tasks_unmount", {});
  }, []);

  const lastFilterChangeRef = useRef(0);
  const lastFilterLogRef = useRef(0);
  useEffect(() => {
    lastFilterChangeRef.current = Date.now();
    // Throttle telemetry logs to once per ~800ms during active filtering
    const now = Date.now();
    if (now - lastFilterLogRef.current > 800) {
      lastFilterLogRef.current = now;
      clientLog("filter_change", { filters });
    }
    // purely local filter; no network invalidate required
  }, [filters.status, filters.priority, filters.search, filters.due_after, filters.due_before]);

  // Subscribe to SSE for live updates; seed cache and re-derive filtered list
  useEffect(() => {
    const url = `${API_BASE}tasks/stream/`;
    const es = new EventSource(url, { withCredentials: true });
    let last = 0;
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && Array.isArray(payload.tasks)) {
          // Seed the all-tasks cache and update local filtered view
          queryClient.setQueryData(["tasks_all"], payload.tasks);
          setTasks(applyFilters(payload.tasks, filters));
          clientLog("sse_snapshot", { count: payload.tasks.length });
        }
      } catch (_) {}
      const now = Date.now();
      if (now - lastFilterChangeRef.current < 600) return;
      if (now - last < 800) return;
      last = now;
      // No invalidate: SSE already updated cache; avoid redundant GETs
    };
    es.onerror = () => {};
    return () => es.close();
    // Intentionally not depending on filters so SSE doesn't restart on each change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, applyFilters, filters]);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    try {
      await createTask({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
    } catch (e) {
      alert("Failed to create task");
    }
  }, [form, queryClient]);

  const handleEdit = (task) => {
    log("task_edit_click", { id: task.id });
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
    });
  };

  const handleUpdate = useCallback(async (e) => {
    e.preventDefault();
    try {
      log("task_update_submit", { id: editingId });
      await updateTask(editingId, {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setEditingId(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
      log("task_update_ok", { id: editingId });
    } catch (e) {
      alert("Failed to update task");
      log("task_update_fail", { id: editingId, error: String(e) });
    }
  }, [editingId, form, queryClient]);

  const handleDelete = useCallback(async (id) => {
    log("task_delete_click", { id });
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteTask(id);
      await queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
      log("task_delete_ok", { id });
    } catch (e) {
      alert("Failed to delete task");
      log("task_delete_fail", { id, error: String(e) });
    }
  }, [queryClient]);

  const overdueIds = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Set(
      (tasks || [])
        .filter((t) => t.due_date && t.due_date < today && t.status !== "completed")
        .map((t) => t.id)
    );
  }, [tasks]);

  const byStatus = useMemo(() => ({
    pending: tasks.filter((t) => t.status === "pending"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  }), [tasks]);

  const onDragStart = (id) => (e) => {
    setDraggingId(id);
    try { e.dataTransfer.setData("text/plain", String(id)); } catch (_) {}
    e.dataTransfer.effectAllowed = "move";
    log("drag_start", { id });
  };

  const onDragOver = useCallback((e) => {
    e.preventDefault(); // allow drop
    try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
  }, []);

  const onDropTo = useCallback(
    (status) => async (e) => {
      e.preventDefault();
      const idStr = (() => {
        try { return e.dataTransfer.getData("text/plain"); } catch (_) { return null; }
      })();
      const id = parseInt(idStr || draggingId, 10);
      if (!id) return;
      const task = tasks.find((t) => t.id === id);
      if (!task || task.status === status) return;
      try {
        await updateTask(id, { status });
      await queryClient.invalidateQueries({ queryKey: ["tasks_all"] });
        log("drag_drop_ok", { id, to: status });
      } catch (err) {
        console.error(err);
        alert("Failed to move task");
        log("drag_drop_fail", { id, to: status, error: String(err) });
      } finally {
        setDraggingId(null);
      }
    },
    [draggingId, tasks, queryClient]
  );

  return (
    <div className="container py-4">
      <h2 className="mb-3">Tasks</h2>

      {/* Filters */}
      <div className="card p-3 mb-3">
        <h5 className="mb-3">Filters</h5>
        <div className="row g-3 align-items-end">
          <div className="col-md-2">
            <label htmlFor="filter-status" className="form-label">Status</label>
            <select
              id="filter-status"
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="col-md-2">
            <label htmlFor="filter-priority" className="form-label">Priority</label>
            <select
              id="filter-priority"
              className="form-select"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="col-md-2">
            <label htmlFor="filter-due-after" className="form-label">Due After</label>
            <input
              id="filter-due-after"
              type="date"
              className="form-control"
              value={filters.due_after}
              onChange={(e) => setFilters({ ...filters, due_after: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <label htmlFor="filter-due-before" className="form-label">Due Before</label>
            <input
              id="filter-due-before"
              type="date"
              className="form-control"
              value={filters.due_before}
              onChange={(e) => setFilters({ ...filters, due_before: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="filter-search" className="form-label">Search (title/description)</label>
            <input
              id="filter-search"
              type="text"
              className="form-control"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="col-md-1 d-grid">
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Clear all filters"
              onClick={() => setFilters({ status: "", priority: "", search: "", due_after: "", due_before: "" })}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit */}
      <div className="card p-3 mb-4">
        <h5 className="mb-3">{editingId ? "Edit Task" : "Create Task"}</h5>
        <form onSubmit={editingId ? handleUpdate : handleCreate} className="row g-2">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div className="col-md-2 d-grid">
            <button type="submit" className="btn btn-primary">
              {editingId ? "Update" : "Create"}
            </button>
          </div>
          {editingId && (
            <div className="col-md-2 d-grid">
              <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Kanban Board */}
      <div className="mb-4">
        <h5 className="mb-2">Kanban</h5>
        <div className="row g-3">
          {[
            { key: "pending", title: "Pending", bg: "#fff7e6", border: "#e9c46a" },
            { key: "in-progress", title: "In Progress", bg: "#e8f7f4", border: "#2a9d8f" },
            { key: "completed", title: "Completed", bg: "#eef2f4", border: "#264653" },
          ].map((col) => (
            <div key={col.key} className="col-md-4">
              <div
                className="p-2"
                style={{ background: "#fff", borderRadius: 8, border: `2px solid ${col.border}` }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <strong>{col.title}</strong>
                  <span className="badge bg-secondary">{byStatus[col.key].length}</span>
                </div>
                <div
                  onDragOver={onDragOver}
                  onDrop={onDropTo(col.key)}
                  style={{
                    minHeight: 120,
                    background: col.bg,
                    borderRadius: 6,
                    padding: 8,
                  }}
                >
                  {byStatus[col.key].map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={onDragStart(t.id)}
                      className="mb-2"
                      style={{
                        background: "#fff",
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        padding: 8,
                        boxShadow: draggingId === t.id ? "0 0 0 2px #0d6efd inset" : "none",
                        cursor: "grab",
                      }}
                      title="Drag to change status"
                    >
                      <div className="d-flex justify-content-between">
                        <div className="fw-semibold" style={{ maxWidth: "70%" }}>{t.title}</div>
                        <span className="badge bg-light text-dark border">{t.priority}</span>
                      </div>
                      <div className="small text-muted">{t.due_date || "No due date"}</div>
                    </div>
                  ))}
                  {byStatus[col.key].length === 0 && (
                    <div className="text-center text-muted small" style={{ padding: 8 }}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized list when many rows; fallback to table otherwise */}
      {tasks.length > 200 ? (
        <div className="card p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">My Tasks</h5>
            {(loading || isFetching) && <span>Loading...</span>}
            {error && <span className="text-danger">{error}</span>}
          </div>
          <div style={{ height: 480 }}>
            <VirtualList height={480} itemCount={tasks.length} itemSize={56} width={"100%"}>
              {({ index, style }) => {
                const t = tasks[index];
                return (
                  <div style={{ ...style, display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #eee' }} key={t.id}>
                    <div style={{ flex: 2 }}>{t.title}</div>
                    <div style={{ flex: 1 }}>{t.owner?.username || '-'}</div>
                    <div style={{ flex: 1 }}>{t.status}</div>
                    <div style={{ flex: 1 }}>{t.priority}</div>
                    <div style={{ flex: 1 }}>{t.due_date || '-'}</div>
                    <div style={{ flex: 1 }}>{new Date(t.updated_at).toLocaleString()}</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(t)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(t.id)}>Delete</button>
                    </div>
                  </div>
                );
              }}
            </VirtualList>
          </div>
        </div>
      ) : (
        <div className="card p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">My Tasks</h5>
            {(loading || isFetching) && <span>Loading...</span>}
            {error && <span className="text-danger">{error}</span>}
          </div>
          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className={overdueIds.has(t.id) ? "table-danger" : ""}>
                    <td>{t.title}</td>
                    <td>{t.owner?.username || "-"}</td>
                    <td>{t.status}</td>
                    <td>{t.priority}</td>
                    <td>{t.due_date || "-"}</td>
                    <td>{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(t)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(t.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && !isFetching && (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-3">
                      No tasks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;
