import axios from "axios";

export const apiFace = axios.create({
  baseURL: "/apiFace",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});