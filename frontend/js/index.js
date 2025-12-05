// js/index.js

// ---------- Axios base config ----------
if (window.axios) {
  axios.defaults.baseURL = "http://localhost:5000"; // same server as backend
  axios.defaults.headers["Content-Type"] = "application/json";
}

// ---------- Simple auth helpers ----------
const STORAGE_TOKEN_KEY = "community_token";
const STORAGE_USER_KEY = "community_user";

function saveAuth(token, user) {
  if (!token) return;
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }
}

function getToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearAuth() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

// Attach auth header helper
function authConfig(extra = {}) {
  const token = getToken();
  const headers = extra.headers || {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { ...extra, headers };
}

// ---------- Navbar setup ----------
function setupNavbar() {
  const loginBtn = document.getElementById("nav-login-btn");
  const registerBtn = document.getElementById("nav-register-btn");
  const userMenu = document.getElementById("nav-user-menu");
  const userButton = document.getElementById("nav-user-button");
  const userDropdown = document.getElementById("nav-user-dropdown");
  const userAvatar = document.getElementById("nav-user-avatar");
  const userNameSpan = document.getElementById("nav-user-name");
  const logoutBtn = document.getElementById("nav-logout-btn");

  const token = getToken && getToken();
  const user = getStoredUser && getStoredUser();

  // ✅ Hide login/register if logged in, even if userMenu is missing
  if (token && user) {
    if (loginBtn) {
      loginBtn.classList.add("hidden");
      // extra safety
      loginBtn.style.display = "none";
    }
    if (registerBtn) {
      registerBtn.classList.add("hidden");
      registerBtn.style.display = "none";
    }

    if (userMenu) {
      userMenu.classList.remove("hidden");

      const displayName = user.name || user.email || "User";
      if (userNameSpan) userNameSpan.textContent = displayName;
      if (userAvatar) {
        const initial = displayName.trim().charAt(0).toUpperCase();
        userAvatar.textContent = initial || "U";
      }
    }
  }

  // Dropdown toggle
  if (userButton && userDropdown && userMenu) {
    userButton.addEventListener("click", () => {
      userDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target)) {
        userDropdown.classList.add("hidden");
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuth && clearAuth();
      window.location.href = "index.html";
    });
  }
}

// ---------- Hero / location ----------
function setupLocationControls() {
  const locationInput = document.getElementById("location-input");
  const useLocationBtn = document.getElementById("use-location-btn");

  if (!locationInput || !useLocationBtn) return;

  useLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }

    useLocationBtn.disabled = true;
    useLocationBtn.textContent = "Detecting...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // For now, we just show lat/lng. Later you can call a reverse geocoding API.
        locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = "Use my location";
      },
      () => {
        alert("Unable to fetch location.");
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = "Use my location";
      }
    );
  });
}

// ---------- Dummy events (until backend events API exists) ----------
const dummyEvents = [
  {
    id: 1,
    title: "10K City Marathon",
    city: "Bhubaneswar",
    category: "Fitness",
    date: "2025-12-06",
    time: "6:00 AM",
    priceType: "PAID",
    price: 499,
    tag: "Trending",
    banner:
      "https://images.pexels.com/photos/2402777/pexels-photo-2402777.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 2,
    title: "Sunday Cycling Meetup",
    city: "Bangalore",
    category: "Cycling",
    date: "2025-12-07",
    time: "7:00 AM",
    priceType: "FREE",
    price: 0,
    tag: "Limited Seats",
    banner:
      "https://images.pexels.com/photos/276517/pexels-photo-276517.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 3,
    title: "Full-Stack JS Dev Meetup",
    city: "Hyderabad",
    category: "Tech",
    date: "2025-12-10",
    time: "4:00 PM",
    priceType: "FREE",
    price: 0,
    tag: "Community",
    banner:
      "https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 4,
    title: "UI/UX Design Workshop",
    city: "Mumbai",
    category: "Workshops",
    date: "2025-12-12",
    time: "11:00 AM",
    priceType: "PAID",
    price: 799,
    tag: "New",
    banner:
      "https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: 5,
    title: "Beach Cleanup Drive",
    city: "Mumbai",
    category: "Social",
    date: "2025-12-08",
    time: "8:00 AM",
    priceType: "FREE",
    price: 0,
    tag: "Volunteer",
    banner:
      "https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

// Render cards
function renderEvents(events) {
  const grid = document.getElementById("events-grid");
  const countSpan = document.getElementById("events-count");
  const emptyState = document.getElementById("events-empty");

  if (!grid || !countSpan || !emptyState) return;

  grid.innerHTML = "";

  if (!events.length) {
    emptyState.classList.remove("hidden");
    countSpan.textContent = "0";
    return;
  }

  emptyState.classList.add("hidden");
  countSpan.textContent = String(events.length);

  events.forEach((ev) => {
    const card = document.createElement("article");
    card.className =
      "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition";

    card.innerHTML = `
      <div class="h-36 w-full overflow-hidden">
        <img
          src="${ev.banner}"
          alt="${ev.title}"
          class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div class="flex-1 flex flex-col p-3.5">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <p class="text-[11px] font-medium text-primary-600">
            ${ev.date} · ${ev.time}
          </p>
          <span class="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            ${ev.tag}
          </span>
        </div>
        <h3 class="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
          ${ev.title}
        </h3>
        <p class="text-[11px] text-slate-500 mb-2">
          ${ev.city} · ${ev.category}
        </p>
        <div class="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
          <div class="flex flex-col">
            ${
              ev.priceType === "FREE"
                ? `<span class="text-xs font-semibold text-emerald-600">Free</span>`
                : `<span class="text-xs font-semibold text-slate-900">₹${ev.price}</span>`
            }
            <span class="text-[10px] text-slate-400">${
              ev.priceType === "FREE" ? "Limited spots" : "Per person"
            }</span>
          </div>
          <button
            class="text-[11px] font-medium px-3 py-1.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition"
          >
            View Details
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Filter logic
function setupFilters() {
  const searchInput = document.getElementById("nav-search-input");
  const searchForm = document.getElementById("nav-search-form");
  const citySelect = document.getElementById("filter-city");
  const categorySelect = document.getElementById("filter-category");
  const dateInput = document.getElementById("filter-date");
  const radiusInput = document.getElementById("filter-radius");
  const radiusLabel = document.getElementById("filter-radius-label");
  const priceAnyBtn = document.getElementById("filter-price-any");
  const priceFreeBtn = document.getElementById("filter-price-free");
  const pricePaidBtn = document.getElementById("filter-price-paid");
  const resetBtn = document.getElementById("filter-reset");
  const emptyResetBtn = document.getElementById("events-empty-reset");

  if (radiusInput && radiusLabel) {
    radiusInput.addEventListener("input", () => {
      radiusLabel.textContent = `${radiusInput.value} km`;
    });
  }

  let priceFilter = "ANY"; // ANY | FREE | PAID

  function applyFilters() {
    let filtered = [...dummyEvents];

    const q = (searchInput?.value || "").trim().toLowerCase();
    const city = citySelect?.value || "";
    const cat = categorySelect?.value || "";
    const date = dateInput?.value || "";

    if (q) {
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (city) {
      filtered = filtered.filter((e) => e.city === city);
    }
    if (cat) {
      filtered = filtered.filter((e) => e.category === cat);
    }
    if (date) {
      filtered = filtered.filter((e) => e.date === date);
    }
    if (priceFilter === "FREE") {
      filtered = filtered.filter((e) => e.priceType === "FREE");
    } else if (priceFilter === "PAID") {
      filtered = filtered.filter((e) => e.priceType === "PAID");
    }

    renderEvents(filtered);
  }

  // Search form submit
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  // Other filters
  [citySelect, categorySelect, dateInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", applyFilters);
  });

  // Price toggle buttons
  function setPriceFilter(newFilter) {
    priceFilter = newFilter;

    if (priceAnyBtn) {
      priceAnyBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (priceFilter === "ANY"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }
    if (priceFreeBtn) {
      priceFreeBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (priceFilter === "FREE"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }
    if (pricePaidBtn) {
      pricePaidBtn.className =
        "px-3 py-1.5 text-[11px] sm:text-xs font-medium " +
        (priceFilter === "PAID"
          ? "bg-primary-50 text-primary-700"
          : "text-slate-600 hover:bg-slate-50");
    }

    applyFilters();
  }

  if (priceAnyBtn)
    priceAnyBtn.addEventListener("click", () => setPriceFilter("ANY"));
  if (priceFreeBtn)
    priceFreeBtn.addEventListener("click", () => setPriceFilter("FREE"));
  if (pricePaidBtn)
    pricePaidBtn.addEventListener("click", () => setPriceFilter("PAID"));

  // Reset
  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (citySelect) citySelect.value = "";
    if (categorySelect) categorySelect.value = "";
    if (dateInput) dateInput.value = "";
    if (radiusInput) radiusInput.value = "20";
    if (radiusLabel) radiusLabel.textContent = "20 km";
    setPriceFilter("ANY");
  }

  if (resetBtn) resetBtn.addEventListener("click", () => resetFilters());
  if (emptyResetBtn)
    emptyResetBtn.addEventListener("click", () => resetFilters());

  // Initial load
  renderEvents(dummyEvents);
}

// ---------- Common footer year ----------
function setupYear() {
  const span = document.getElementById("year-span");
  if (span) {
    span.textContent = String(new Date().getFullYear());
  }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();
  setupLocationControls();
  setupFilters();
  setupYear();
});
