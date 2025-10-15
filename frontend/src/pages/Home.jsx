//src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
      <div className="text-center p-4 shadow-sm rounded bg-white" style={{ maxWidth: "500px", width: "100%" }}>
        <h1 className="mb-3">Welcome to My Blog</h1>
        <p className="mb-4 text-secondary">Please login or sign up to continue</p>
        <div className="d-flex justify-content-center gap-3">
          <Link to="/signin">
            <button className="btn btn-primary btn-lg">Login</button>
          </Link>
          <Link to="/signup">
            <button className="btn btn-success btn-lg">Sign Up</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
