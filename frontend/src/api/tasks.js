// src/api/tasks.js
import axios from "./axios";

export const listTasks = async (filters = {}) => {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.priority) params.priority = filters.priority;
  if (filters.due_before) params.due_before = filters.due_before;
  if (filters.due_after) params.due_after = filters.due_after;
  if (filters.search) params.search = filters.search;
  const res = await axios.get("tasks/", { params });
  return res.data;
};

export const createTask = async (data) => {
  const res = await axios.post("tasks/", data);
  return res.data;
};

export const updateTask = async (id, data) => {
  const res = await axios.put(`tasks/${id}/`, data);
  return res.data;
};

export const deleteTask = async (id) => {
  const res = await axios.delete(`tasks/${id}/`);
  return res.data;
};

