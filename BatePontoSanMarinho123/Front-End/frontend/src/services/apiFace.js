import axios from "axios";

export const apiFace = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});