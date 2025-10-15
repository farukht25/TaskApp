// src/pages/Tasks.jsx
import React, { useEffect, useMemo, useState } from "react";
import { listTasks, createTask, updateTask, deleteTask } from "../api/tasks";

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

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listTasks(filters);
      setTasks(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.priority, filters.search, filters.due_after, filters.due_before]);

  // Subscribe to SSE for live updates; on event, re-load with current filters
  useEffect(() => {
    const url = `http://localhost:8000/tasks/stream/`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = () => {
      // simple approach: re-fetch using current filters
      load();
    };
    es.onerror = () => {
      // auto-close on error; browser will retry due to retry directive
    };
    return () => es.close();
  }, [filters.status, filters.priority, filters.search, filters.due_after, filters.due_before]);

  const handleCreate = async (e) => {
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
      await load();
    } catch (e) {
      alert("Failed to create task");
    }
  };

  const handleEdit = (task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateTask(editingId, {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      alert("Failed to update task");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await deleteTask(id);
      await load();
    } catch (e) {
      alert("Failed to delete task");
    }
  };

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
  };

  const onDragOver = (e) => {
    e.preventDefault(); // allow drop
  };

  const onDropTo = (status) => async (e) => {
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
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to move task");
    } finally {
      setDraggingId(null);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Tasks</h2>

      {/* Filters */}
      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-2">
            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              placeholder="Due after"
              value={filters.due_after}
              onChange={(e) => setFilters({ ...filters, due_after: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              placeholder="Due before"
              value={filters.due_before}
              onChange={(e) => setFilters({ ...filters, due_before: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search title/description"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <div className="col-md-1 d-grid">
            <button className="btn btn-secondary" onClick={() => setFilters({ status: "", priority: "", search: "", due_after: "", due_before: "" })}>
              Reset
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

      {/* List */}
      <div className="card p-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="m-0">My Tasks</h5>
          {loading && <span>Loading...</span>}
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
              {tasks.length === 0 && (
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
    </div>
  );
}

export default Tasks;
