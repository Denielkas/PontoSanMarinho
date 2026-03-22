import axios from "axios";

export const apiFace = axios.create({
  baseURL: "/apiFace",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});