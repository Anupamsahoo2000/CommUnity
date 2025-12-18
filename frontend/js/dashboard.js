// frontend/js/dashboard.js

// ---------- Axios defaults ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.headers["Content-Type"] = "application/json";
}

// ---------- Utility / DOM helpers ----------
function getTokenFromLS() {
  return getToken?.() || localStorage.getItem("community_token");
}

// ---------- Booking cards renderer ----------
function renderBookingCard(b) {
  // b: { id, event: { id, title, bannerUrl, startTime }, ticketType, quantity, status, qrUrl }
  const wrapper = document.createElement("div");
  wrapper.className =
    "bg-white rounded-2xl p-3 border border-slate-100 flex items-center gap-3";
  wrapper.innerHTML = `
    <img src="${
      b.event?.bannerUrl || "https://via.placeholder.com/96"
    }" alt="" class="h-16 w-24 object-cover rounded-md" />
    <div class="flex-1">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">${b.event?.title || "Event"}</div>
          <div class="text-xs text-slate-500">
            ${b.ticketType || ""} · ${new Date(
    b.event?.startTime || Date.now()
  ).toLocaleString()}
          </div>
        </div>
        <div class="text-right text-sm">
          <div class="${
            b.status === "CONFIRMED" ? "text-emerald-600" : "text-slate-600"
          } font-medium">${b.status}</div>
          <div class="text-xs text-slate-500">${b.quantity} tickets</div>
        </div>
      </div>
      <div class="mt-2 flex gap-2">
        <a href="event.html?id=${
          b.event?.id
        }" class="px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 text-xs">View Event</a>
        ${
          b.qrUrl
            ? `<a href="${b.qrUrl}" target="_blank" class="px-3 py-1.5 rounded-full border text-xs">Download QR</a>`
            : ""
        }
        ${
          b.status === "CONFIRMED"
            ? `<button data-id="${b.id}" class="btn-cancel px-3 py-1.5 rounded-full border text-xs text-red-600">Cancel</button>`
            : ""
        }
      </div>
    </div>
  `;
  return wrapper;
}

async function loadMyBookings() {
  const token = getTokenFromLS();
  const list = document.getElementById("bookings-list");
  const empty = document.getElementById("bookings-empty");

  if (!list || !empty) return;

  if (!token) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  try {
    const r = await axios.get("/bookings/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bookings = r?.data?.data || r?.data || [];
    list.innerHTML = "";

    if (!bookings.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    bookings.forEach((b) => {
      const card = renderBookingCard(b);
      list.appendChild(card);
    });

    // attach cancel handlers
    document.querySelectorAll(".btn-cancel").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Cancel this booking?")) return;
        try {
          await axios.post(
            `/bookings/${id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          alert("Booking cancellation requested.");
          // reload bookings
          loadMyBookings();
        } catch (err) {
          alert(err?.response?.data?.message || "Failed to cancel booking.");
        }
      });
    });
  } catch (err) {
    console.error("Failed to load bookings", err);
    list.innerHTML = "";
    empty.classList.remove("hidden");
  }
}

function setupAvatarUpload() {
  const trigger = document.getElementById("avatar-upload-trigger");
  const input = document.getElementById("avatar-file");
  const msg = document.getElementById("avatar-upload-msg");
  const avatar = document.getElementById("dash-user-avatar");

  if (!trigger || !input) return;

  trigger.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const token = getTokenFromLS();
    if (!token) {
      window.location.href = "auth.html#login";
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    msg.textContent = "Uploading...";

    try {
      const resp = await axios.post("/auth/me/avatar", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const url = resp?.data?.avatarUrl;
      msg.textContent = "Photo updated.";

      if (url && avatar) {
        avatar.style.backgroundImage = `url(${url})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.textContent = ""; // hide initial letter
      }
    } catch (err) {
      console.error("Avatar upload failed", err);
      msg.textContent =
        err?.response?.data?.message || "Failed to upload photo.";
    }
  });
}

// ---------- Main DOMContentLoaded flow ----------
document.addEventListener("DOMContentLoaded", async () => {
  const alertBox = document.getElementById("dash-alert");
  const logoutBtn = document.getElementById("dash-logout-btn");

  const fieldName = document.getElementById("dash-field-name");
  const fieldEmail = document.getElementById("dash-field-email");
  const fieldRole = document.getElementById("dash-field-role");
  const fieldCity = document.getElementById("dash-field-city");

  const avatar = document.getElementById("dash-user-avatar");
  const nameSpan = document.getElementById("dash-user-name");
  const roleSpan = document.getElementById("dash-user-role");
  const hostBtn = document.getElementById("host-dashboard-btn");

  const createEventSection = document.getElementById("create-event-section");

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
  const token = getTokenFromLS();
  if (!token) {
    window.location.href = "auth.html#login";
    return;
  }

  // Attach token to axios headers for this page
  axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth?.();
      delete axios.defaults.headers.common["Authorization"];
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

    // Top avatar + texts
    const displayName = user.name || user.email || "User";
    if (nameSpan) nameSpan.textContent = displayName;
    if (roleSpan) roleSpan.textContent = (user.role || "USER").toUpperCase();
    if (avatar) {
      const initial = displayName.trim().charAt(0).toUpperCase();
      avatar.textContent = initial || "U";
    }

    // 🔐 Role-based UI: show Create Event only for HOST or ADMIN
    if (createEventSection) {
      if (user.role === "HOST" || user.role === "ADMIN") {
        createEventSection.classList.remove("hidden");
      } else {
        createEventSection.classList.add("hidden");
      }
    }

    if (!hostBtn) return;

    if (user.role === "HOST") {
      hostBtn.classList.remove("hidden");
    } else {
      hostBtn.classList.add("hidden");
    }

    // Keep LS user in sync
    saveAuth?.(token, user);

    setupAvatarUpload();

    // Load bookings after profile is loaded
    if (document.getElementById("my-bookings-section")) {
      loadMyBookings();
    }
  } catch (err) {
    console.error(err);
    const status = err?.response?.status;
    if (status === 401) {
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
