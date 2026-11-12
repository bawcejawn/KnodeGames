// Copy buttons for the official token addresses (get.html and start.html).
for (const b of document.querySelectorAll("[data-copy]")) b.addEventListener("click", async () => {
  const t = document.getElementById(b.dataset.copy).textContent.trim();
  try { await navigator.clipboard.writeText(t); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); } catch { b.textContent = "Select it"; }
});
