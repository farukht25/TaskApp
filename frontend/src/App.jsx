// src/app.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "./api/axios";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Dashboard from "./pages/Dashboard";
import SignIn from "./pages/Signin";
import SignUp from "./pages/Signup";
// Admin React page removed
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [loading, setLoading] = useState(true); // <--- loading state

  useEffect(() => {
    axios
      .get("user/me/")
      .then((res) => {
        setCurrentUserId(res.data.id);
        setIsSuperUser(res.data.is_superuser);
        setIsAuthenticated(true);
      })
      .catch((err) => {
        console.error("Failed to fetch current user", err);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false)); // stop loading once done
  }, []);

  const handleLogout = () => {
    axios.post("signout/").finally(() => {
      setIsAuthenticated(false);
      setCurrentUserId(null);
      setIsSuperUser(false);
      window.location.href = "/";
    });
  };

  if (loading) return <p>Loading...</p>; // <-- render a loading screen

  return (
    <Router>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 20px",
          background: "#f5f5f5",
        }}
      >
        <h2 style={{ margin: 0 }}>Task Manager</h2>

        {isAuthenticated && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => (window.location.href = "/tasks")}
              style={{
                padding: "8px 14px",
                backgroundColor: "#1d3557",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Tasks
            </button>

            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                padding: "8px 14px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Dashboard
            </button>
            {/* Django Admin button removed */}
            <button
              onClick={handleLogout}
              style={{
                padding: "8px 14px",
                backgroundColor: "#e63946",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Routes */}
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/tasks" /> : <Home />} />
        <Route
          path="/signin"
          element={isAuthenticated ? <Navigate to="/tasks" /> : <SignIn setAuth={setIsAuthenticated} />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/tasks" /> : <SignUp setAuth={setIsAuthenticated} />}
        />
        <Route
          path="/tasks"
          element={isAuthenticated ? <Tasks /> : <Navigate to="/" />}
        />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
