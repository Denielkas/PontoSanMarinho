export const ADMIN_TOKEN_KEY = "token";
export const COLAB_TOKEN_KEY = "colab_token";

export const setAdminToken = (t) => localStorage.setItem(ADMIN_TOKEN_KEY, t);
export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

export const setColabToken = (t) => localStorage.setItem(COLAB_TOKEN_KEY, t);
export const getColabToken = () => localStorage.getItem(COLAB_TOKEN_KEY);
export const clearColabToken = () => localStorage.removeItem(COLAB_TOKEN_KEY);
