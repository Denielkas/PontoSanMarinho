import axios from "axios";

export const apiFace = axios.create({
  baseURL: "http://127.0.0.1:8000",   // CHAMANDO DIRETO SEM VITE
  timeout: 20000
});
