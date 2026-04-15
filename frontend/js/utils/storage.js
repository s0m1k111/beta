export function saveToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
}

export function saveUserId(id) {
  localStorage.setItem("userId", id);
}

export function getUserId() {
  return localStorage.getItem("userId");
}
