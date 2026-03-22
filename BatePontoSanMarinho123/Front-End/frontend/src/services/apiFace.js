import axios from "axios";

export const apiFace = axios.create({
  baseURL: import.meta.env.VITE_FACE_URL || "/apiFace",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});