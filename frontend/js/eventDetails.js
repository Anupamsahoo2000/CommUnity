// eventDetails.js

const API_BASE_URL = "http://localhost:5000";

const eventLoading = document.getElementById("event-loading");
const eventError = document.getElementById("event-error");
const eventContent = document.getElementById("event-content");

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const getEventIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
};

const renderEvent = (event) => {
  eventLoading.classList.add("hidden");
  eventContent.classList.remove("hidden");

  const isFree = event.isFree || event.is_free;
  const price =
    isFree || event.basePrice == null
      ? "Free"
      : `₹${Number(event.basePrice || 0).toFixed(0)}`;

  eventContent.innerHTML = `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <h1 class="text-xl sm:text-2xl font-semibold tracking-tight">
            ${event.title}
          </h1>
          <p class="text-sm text-slate-400">
            ${event.city || "Any city"}
          </p>
        </div>
        <div class="text-right space-y-1 text-sm">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-[11px] text-slate-300">
            <span class="h-1.5 w-1.5 rounded-full ${
              event.status === "CANCELLED"
                ? "bg-rose-400"
                : event.status === "COMPLETED"
                ? "bg-slate-400"
                : "bg-emerald-400"
            }"></span>
            ${event.status || "PUBLISHED"}
          </span>
          <div class="font-semibold ${
            isFree ? "text-emerald-400" : "text-slate-100"
          }">
            ${price}
          </div>
        </div>
      </div>

      <div class="text-sm text-slate-300 leading-relaxed">
        ${event.description || "No description provided for this event."}
      </div>

      <div class="grid sm:grid-cols-3 gap-4 text-xs text-slate-300 mt-3">
        <div class="space-y-1">
          <div class="text-slate-400">Starts</div>
          <div>${formatDateTime(event.startTime || event.start_time)}</div>
        </div>
        <div class="space-y-1">
          <div class="text-slate-400">Ends</div>
          <div>${formatDateTime(event.endTime || event.end_time)}</div>
        </div>
        <div class="space-y-1">
          <div class="text-slate-400">Capacity</div>
          <div>${event.maxSeats ?? event.max_seats ?? "N/A"} seats</div>
        </div>
      </div>

      <div class="mt-4 border-t border-slate-800 pt-4 text-xs text-slate-400">
        <p>
          This page is powered by <code class="bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px]">GET /events/:id</code>.
          Booking, chat, and route maps will be added in later phases.
        </p>
      </div>
    </div>
  `;
};

const loadEvent = async () => {
  const id = getEventIdFromUrl();
  if (!id) {
    eventLoading.classList.add("hidden");
    eventError.textContent = "Missing event id in URL.";
    eventError.classList.remove("hidden");
    return;
  }

  try {
    const { data } = await api.get(`/events/${id}`);
    const event = data.event || data;
    renderEvent(event);
  } catch (err) {
    console.error(err);
    eventLoading.classList.add("hidden");
    eventError.textContent =
      err.response?.data?.message || "Failed to load event.";
    eventError.classList.remove("hidden");
  }
};

window.addEventListener("DOMContentLoaded", () => {
  loadEvent();
});
