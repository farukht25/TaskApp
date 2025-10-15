//src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../api/auth";

const Signup = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
  });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await signup(form);
      console.log(res.data);
      alert("Signup successful! You are now logged in.");
      // Cookies are set by backend; go to tasks
      navigate("/tasks");
    } catch (err) {
      console.error(err.response?.data);
      alert(
        "Signup failed: " +
          (err.response?.data.error ||
            Object.values(err.response?.data).join(", "))
      );
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-sm p-4" style={{ maxWidth: "400px", width: "100%" }}>
        <h2 className="text-center mb-4">Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-control"
              placeholder="Enter username"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="Enter email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-control"
              placeholder="Enter password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password2" className="form-label">Confirm Password</label>
            <input
              id="password2"
              name="password2"
              type="password"
              className="form-control"
              placeholder="Confirm password"
              value={form.password2}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn btn-success w-100">Sign Up</button>
        </form>
      </div>
    </div>
  );
};

export default Signup;
