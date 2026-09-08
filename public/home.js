// public/home.js
// Just handles the "coming soon" toast when a disabled tool card is tapped.

let toastTimer = null;

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

document.querySelectorAll(".tool-card.disabled").forEach((card) => {
  card.addEventListener("click", () => {
    const name = card.getAttribute("data-tool") || "This tool";
    showToast(`${name} is coming soon`);
  });
});
