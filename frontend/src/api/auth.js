// src/api/auth.js
import axios from "./axios";

export const signup = async (data) => {
  const res = await axios.post("auth/register/", data);
  if (res.data.tokens) {
    localStorage.setItem("accessToken", res.data.tokens.access);
    localStorage.setItem("refreshToken", res.data.tokens.refresh);
  }
  return res;
};

export const signin = async (data) => {
  const res = await axios.post("auth/login/", data);
  if (res.data.tokens) {
    localStorage.setItem("accessToken", res.data.tokens.access);
    localStorage.setItem("refreshToken", res.data.tokens.refresh);
  }
  return res;
};

export const signout = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  // Optional: call backend signout if you implement JWT blacklist
};
