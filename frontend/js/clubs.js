// clubs.js

const API_BASE_URL = "http://localhost:5000";

const clubsGrid = document.getElementById("clubs-grid");
const clubsLoading = document.getElementById("clubs-loading");
const clubsEmpty = document.getElementById("clubs-empty");
const clubsCityFilter = document.getElementById("clubs-city-filter");
const clubsFilterApply = document.getElementById("clubs-filter-apply");
const clubsFilterClear = document.getElementById("clubs-filter-clear");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const renderClubs = (clubs) => {
  clubsLoading.classList.add("hidden");
  clubsGrid.innerHTML = "";

  if (!clubs || clubs.length === 0) {
    clubsEmpty.classList.remove("hidden");
    return;
  }

  clubsEmpty.classList.add("hidden");

  clubs.forEach((club) => {
    const card = document.createElement("article");
    card.className =
      "rounded-2xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between hover:border-primary-500/70 hover:bg-slate-900/80 transition-all";

    const isPaid = club.isPaidMembership || club.is_paid_membership;
    const fee =
      isPaid && club.membershipFee != null
        ? `₹${Number(club.membershipFee).toFixed(0)} / join`
        : "Free to join";

    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold line-clamp-2">${club.name}</h2>
          <span class="text-[11px] text-slate-400">
            ${club.city || "Any city"}
          </span>
        </div>
        <p class="text-xs text-slate-400 line-clamp-3">
          ${club.description || "No description provided."}
        </p>
      </div>
      <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
          ${
            isPaid
              ? '<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Paid membership'
              : '<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Free membership'
          }
        </span>
        <span class="font-semibold text-slate-100">
          ${fee}
        </span>
      </div>
    `;

    clubsGrid.appendChild(card);
  });
};

const loadClubs = async (options = {}) => {
  clubsLoading.classList.remove("hidden");
  clubsEmpty.classList.add("hidden");
  clubsGrid.innerHTML = "";

  try {
    const params = {
      limit: 30,
      offset: 0,
    };

    if (options.city) {
      params.city = options.city;
    }

    const { data } = await api.get("/clubs", { params });
    renderClubs(data.clubs || data.rows || []);
  } catch (err) {
    console.error(err);
    clubsLoading.classList.add("hidden");
    clubsEmpty.classList.remove("hidden");
    clubsEmpty.textContent =
      err.response?.data?.message || "Failed to load clubs.";
  }
};

clubsFilterApply.addEventListener("click", () => {
  const city = clubsCityFilter.value.trim() || undefined;
  loadClubs({ city });
});

clubsFilterClear.addEventListener("click", () => {
  clubsCityFilter.value = "";
  loadClubs({});
});

window.addEventListener("DOMContentLoaded", () => {
  loadClubs();
});
