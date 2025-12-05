// js/dashboard.js

document.addEventListener("DOMContentLoaded", async () => {
  if (window.axios) {
    axios.defaults.baseURL = "http://localhost:5000";
    axios.defaults.headers["Content-Type"] = "application/json";
  }

  const alertBox = document.getElementById("dash-alert");
  const logoutBtn = document.getElementById("dash-logout-btn");

  const fieldName = document.getElementById("dash-field-name");
  const fieldEmail = document.getElementById("dash-field-email");
  const fieldRole = document.getElementById("dash-field-role");
  const fieldCity = document.getElementById("dash-field-city");
  const fieldLat = document.getElementById("dash-field-lat");
  const fieldLng = document.getElementById("dash-field-lng");

  const avatar = document.getElementById("dash-user-avatar");
  const nameSpan = document.getElementById("dash-user-name");
  const roleSpan = document.getElementById("dash-user-role");

  function showAlert(type, message) {
    if (!alertBox) return;
    alertBox.classList.remove("hidden");
    alertBox.textContent = message;

    if (type === "error") {
      alertBox.className =
        "mb-3 text-xs rounded-md px-3 py-2 bg-red-50 text-red-700 border border-red-100";
    } else if (type === "success") {
      alertBox.className =
        "mb-3 text-xs rounded-md px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100";
    }
  }

  function clearAlert() {
    if (!alertBox) return;
    alertBox.classList.add("hidden");
    alertBox.textContent = "";
  }

  // Protect route: if no token → redirect to auth
  const token = getToken?.() || localStorage.getItem("community_token");
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth?.();
      window.location.href = "index.html";
    });
  }

  try {
    clearAlert();

    const res = await axios.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const { user } = res.data || {};

    if (!user) {
      showAlert("error", "Could not load user profile.");
      return;
    }

    // Fill DB-backed profile
    if (fieldName) fieldName.textContent = user.name || "—";
    if (fieldEmail) fieldEmail.textContent = user.email || "—";
    if (fieldRole) fieldRole.textContent = user.role || "—";
    if (fieldCity) fieldCity.textContent = user.city || "—";
    if (fieldLat) fieldLat.textContent = user.lat ?? "—";
    if (fieldLng) fieldLng.textContent = user.lng ?? "—";

    // Top avatar + texts
    const displayName = user.name || user.email || "User";
    if (nameSpan) nameSpan.textContent = displayName;
    if (roleSpan) roleSpan.textContent = (user.role || "USER").toUpperCase();
    if (avatar) {
      const initial = displayName.trim().charAt(0).toUpperCase();
      avatar.textContent = initial || "U";
    }

    // Keep LS user in sync
    saveAuth?.(token, user);
  } catch (err) {
    console.error(err);
    const status = err?.response?.status;
    if (status === 401) {
      // Token invalid / expired
      clearAuth?.();
      window.location.href = "auth.html#login";
      return;
    }
    const msg =
      err?.response?.data?.message ||
      "Something went wrong while loading your profile.";
    showAlert("error", msg);
  }
});
