function togglePanel(button) {
  const panelId = button.dataset.panel;
  const panel = document.getElementById(panelId);

  const open = panel.classList.contains("open");

  document.querySelectorAll(".panel.open").forEach((p) => {
    if (p !== panel) {
      p.style.maxHeight = null;
      p.classList.remove("open");
    }
  });

  if (!open) {
    panel.classList.add("open");
    panel.style.maxHeight = panel.scrollHeight + "px";
  } else {
    panel.style.maxHeight = null;
    panel.classList.remove("open");
  }
}

document.querySelectorAll(".sensor-btn").forEach((btn) => {
  btn.addEventListener("click", () => togglePanel(btn));
});

// Simulación de sensor DHT22
function readSensor() {
  const humedad = (Math.random() * 40 + 40).toFixed(1); // 40-80 %
  const temperatura = (Math.random() * 10 + 20).toFixed(1); // 20-30 °C
  return { humedad, temperatura };
}

function updateUI() {
  const { humedad, temperatura } = readSensor();
  document.getElementById("humedad-value").textContent = humedad;
  document.getElementById("temp-value").textContent = temperatura;
}

updateUI();
setInterval(updateUI, 5000);
