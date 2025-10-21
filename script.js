/* =================== PARÁMETROS ÓPTIMOS DE PLANTAS =================== */
const plantOptimalParams = {
  "Tomate": { humedad: { min: 60, max: 80 }, temperatura: { min: 20, max: 25 } },
  "Cilantro": { humedad: { min: 40, max: 50 }, temperatura: { min: 10, max: 30 } },
  "Papa": { humedad: { min: 90, max: 95 }, temperatura: { min: 17, max: 25 } },
  "Frijol": { humedad: { min: 60, max: 70 }, temperatura: { min: 10, max: 21 } },
  "Pepino": { humedad: { min: 65, max: 85 }, temperatura: { min: 20, max: 28 } }
};

/* =================== ELEMENTOS DEL DOM =================== */
const humidityValueElem = document.getElementById('humedad-value');
const humiditySummaryElem = document.getElementById('humedad-summary');
const waterElement = document.getElementById('water');
const temperatureValueElem = document.getElementById('temp-value');
const temperatureSummaryElem = document.getElementById('temp-summary');
const thermometerFluid = document.getElementById('thermometer-fluid');
const ambientHumidityValueElem = document.getElementById('humedad-ambiente-value');
const ambientHumiditySummaryElem = document.getElementById('humedad-amb-summary');
const ambientWaterElement = document.getElementById('water-ambiente');
const evaluationTextElem = document.getElementById('evaluacion-text');
const optimumParamsSection = document.getElementById('optimum-params-section');
const mainCardsContainer = document.querySelector('.cards');
const mainTitle = document.querySelector('h1');
const optimumParamsButtons = document.querySelectorAll('.optimum-params-btn'); // ahora todos
const sensorButtons = document.querySelectorAll('.sensor-btn');
const humedadHuerta1Elem = document.getElementById('humedad-huerta1-value');
const humedadHuerta2Elem = document.getElementById('humedad-huerta2-value');
// card / widget elements (IDs actualizados para evitar duplicados)
const evaluacionHuerta1CardElem = document.getElementById('evaluacion-huerta1-card');
const evaluacionHuerta2CardElem = document.getElementById('evaluacion-huerta2-card'); // puede ser null si no existe
const evaluacionHuerta1WidgetElem = document.getElementById('evaluacion-huerta1-widget');
const evaluacionHuerta2WidgetElem = document.getElementById('evaluacion-huerta2-widget');
const lastUpdateElem = document.getElementById('last-update');
const reloadBtn = document.getElementById('reload-btn');
const recoToggle = document.getElementById('reco-toggle');
const recoPanel = document.getElementById('reco-panel');
const climaDecor = document.getElementById('clima-decor');
const tempPanelValueElem = document.getElementById('temp-panel-value');
const humedadPanelValueElem = document.getElementById('humedad-panel-value');
const humedadAmbPanelValueElem = document.getElementById('humedad-amb-panel-value');

/* =================== VARIABLES DE ESTADO =================== */
let currentHumedad = null;
let currentTemperatura = null;
let historialDatos = []; // Para exportar CSV
let lastWeatherData = null; // <-- nuevo: guardar últimos datos de clima (temp/humidity/rain1h)
let currentAmbientHumidity = null; // nuevo
const HOURLY_STORAGE_KEY = 'terradata_hourly_records_v1';
let hourlyRecords = [];

/* =================== API REST =================== */
const API_URL = "https://servidor-post-1.onrender.com/datos";

/* =================== UTILIDADES DE FETCH (timeout/abort) =================== */
async function fetchWithTimeout(url, options = {}, timeout = 12000) { // aumentado a 12s
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  options.signal = controller.signal;
  try {
    const res = await fetch(url, options);
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* =================== UTILIDADES UI =================== */
// (Se elimina la asignación global temprana de reloadBtn para evitar duplicados)
// if (reloadBtn) reloadBtn.onclick = () => { fetchDatos(); updateFromWeather(); };

function animateValue(elem) {
  if (!elem) return;
  elem.classList.remove('pop', 'update-pop');
  void elem.offsetWidth;
  elem.classList.add('pop', 'update-pop');
  // limpiar la clase update-pop al terminar
  setTimeout(() => { try { elem.classList.remove('update-pop'); } catch(e){} }, 500);
}

function resetSensorDisplays() {
  [
    humidityValueElem, humiditySummaryElem,
    temperatureValueElem, temperatureSummaryElem,
    ambientHumidityValueElem, ambientHumiditySummaryElem,
    humedadHuerta1Elem, humedadHuerta2Elem
  ].forEach(elem => {
    if (elem) elem.textContent = "--";
  });

  if (waterElement) {
    waterElement.style.height = `0%`;
    waterElement.style.backgroundColor = '';
  }
  if (thermometerFluid) {
    thermometerFluid.style.height = `0%`;
    thermometerFluid.style.backgroundColor = '';
  }
  if (ambientWaterElement) {
    ambientWaterElement.style.height = `0%`;
    ambientWaterElement.style.backgroundColor = '';
  }
  if (evaluationTextElem) {
    evaluationTextElem.textContent = "Esperando datos...";
    evaluationTextElem.classList.remove('eval-alerta', 'eval-optimo', 'eval-bueno', 'eval-nooptimo');
  }
}

/* =================== EVALUACIÓN DE CONDICIONES =================== */
// (modificado: ahora solo calcula y devuelve resultados, NO escribe en el DOM)
function evaluateConditions(humedad, temperatura) {
  const results = {
    optimalFor: [],
    goodFor: [],
    notOptimalFor: []
  };

  if (isNaN(humedad) || isNaN(temperatura)) {
    return results;
  }

  for (const [plant, params] of Object.entries(plantOptimalParams)) {
    const humedadInRange = humedad >= params.humedad.min && humedad <= params.humedad.max;
    const tempInRange = temperatura >= params.temperatura.min && temperatura <= params.temperatura.max;

    if (humedadInRange && tempInRange) {
      results.optimalFor.push(plantaNameSafe(plant));
    } else if (humedadInRange || tempInRange) {
      results.goodFor.push(plantaNameSafe(plant));
    } else {
      results.notOptimalFor.push(plantaNameSafe(plant));
    }
  }
  return results;
}

// helper para dejar nombres tal cual (por si en el futuro cambias formato)
function plantaNameSafe(name) { return name; }

// Nuevo: formatea resultados para mostrar en el widget
function formatResultsForWidget(results) {
  const parts = [];
  if (results.optimalFor.length > 0) {
    parts.push(`<span class="eval-optimo">Óptimo para: ${results.optimalFor.join(", ")}</span>`);
  }
  if (results.goodFor.length > 0) {
    parts.push(`<span class="eval-bueno">Bueno para: ${results.goodFor.join(", ")}</span>`);
  }
  if (results.notOptimalFor.length > 0) {
    parts.push(`<span class="eval-nooptimo">No óptimo para: ${results.notOptimalFor.join(", ")}</span>`);
  }
  return parts.join("<br>") || "Sin datos";
}

function formatEvaluation(results) {
  const textParts = [];
  if (results.optimalFor.length > 0) {
    textParts.push(`<span class="eval-optimo">Óptimo para: ${results.optimalFor.join(", ")}</span>`);
  }
  if (results.goodFor.length > 0) {
    textParts.push(`<span class="eval-bueno">Bueno para: ${results.goodFor.join(", ")}</span>`);
  }
  if (results.notOptimalFor.length > 0) {
    textParts.push(`<span class="eval-nooptimo">No óptimo para: ${results.notOptimalFor.join(", ")}</span>`);
  }

  if (results.optimalFor.length === 0 && results.goodFor.length === 0 && (currentHumedad !== null && currentTemperatura !== null)) {
    return `<span class="eval-alerta">¡Advertencia! Las condiciones actuales no son ideales para ninguna de las plantas registradas.</span>` + (textParts.length ? "<br>" + textParts.join("<br>") : "");
  }

  return textParts.join("<br>") || "Esperando datos para evaluación...";
}

function updateEvaluation() {
  if (currentHumedad !== null && currentTemperatura !== null) {
    const evaluation = evaluateConditions(currentHumedad, currentTemperatura);
    const evaluationText = formatEvaluation(evaluation);
    if (evaluationTextElem) {
      evaluationTextElem.innerHTML = evaluationText;
      evaluationTextElem.classList.remove('eval-alerta', 'eval-optimo', 'eval-bueno', 'eval-nooptimo');
      if (evaluation.optimalFor.length > 0) {
        evaluationTextElem.classList.add('eval-optimo');
      } else if (evaluation.goodFor.length > 0) {
        evaluationTextElem.classList.add('eval-bueno');
      } else {
        evaluationTextElem.classList.add('eval-alerta');
      }
    }
  } else {
    if (evaluationTextElem) {
      evaluationTextElem.textContent = "Esperando datos...";
      evaluationTextElem.classList.remove('eval-alerta', 'eval-optimo', 'eval-bueno', 'eval-nooptimo');
    }
  }
}

/* =================== UI: TARJETAS =================== */
function toggleCard(cardElement, buttonElement) {
  const isOpen = cardElement.classList.contains('open');
  document.querySelectorAll('.card-wrapper.open').forEach(openCard => {
    if (openCard !== cardElement) {
      openCard.classList.remove('open');
      const controllingButton = document.querySelector(`.sensor-btn[data-card="${openCard.id}"]`);
      if (controllingButton) controllingButton.setAttribute('aria-expanded', 'false');
    }
  });
  cardElement.classList.toggle('open', !isOpen);
  buttonElement.setAttribute('aria-expanded', String(!isOpen));
}

sensorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const cardId = btn.getAttribute('data-card');
    const card = document.getElementById(cardId);
    if (card) {
      toggleCard(card, btn);
    }
  });
});

/* =================== OBTENCIÓN DE DATOS POR FETCH =================== */
async function fetchDatos() {
  try {
    const res = await fetchWithTimeout(API_URL, {}, 12000);
    if (!res.ok) throw new Error('Respuesta no ok del servidor');
    const data = await res.json();

    // Guardar en historial para exportar (solo metemos valores recibidos, use ?? "--" para historial)
    historialDatos.push({
      fecha: new Date().toLocaleString(),
      humedad_huerta1: data.humedad_huerta1 ?? "--",
      humedad_huerta2: data.humedad_huerta2 ?? "--",
      temperatura: data.temperatura ?? "--",
      humedad_ambiente: data.humedad_ambiente ?? "--"
    });

    // Valores individuales: solo actualizar si vienen números válidos
    const val1 = (typeof data.humedad_huerta1 !== 'undefined') ? parseFloat(data.humedad_huerta1) : NaN;
    const val2 = (typeof data.humedad_huerta2 !== 'undefined') ? parseFloat(data.humedad_huerta2) : NaN;

    if (!isNaN(val1) && val1 >= 0) {
      const nuevo = val1.toFixed(1);
      if (humedadHuerta1Elem && humedadHuerta1Elem.textContent !== nuevo) {
        humedadHuerta1Elem.textContent = nuevo;
        animateValue(humedadHuerta1Elem);
      }
    }

    if (!isNaN(val2) && val2 >= 0) {
      const nuevo = val2.toFixed(1);
      if (humedadHuerta2Elem && humedadHuerta2Elem.textContent !== nuevo) {
        humedadHuerta2Elem.textContent = nuevo;
        animateValue(humedadHuerta2Elem);
      }
    }

    // === Calcular y mostrar el promedio general ===
    let n = 0;
    let suma = 0;
    if (!isNaN(val1) && val1 >= 0) { suma += val1; n++; }
    if (!isNaN(val2) && val2 >= 0) { suma += val2; n++; }

    if (n > 0) {
      let humedadActual = (suma / n).toFixed(1);
      // Si hace poco se detectó lluvia, aplicar un pequeño ajuste visual para reflejar infiltración
      if (lastWeatherData && lastWeatherData.rain1h && Number(lastWeatherData.rain1h) > 0) {
        // boost proporcional a mm en la última hora, limitado a 0-6 puntos
        const rainBoost = Math.min(6, Number(lastWeatherData.rain1h) * 2);
        const numeric = Math.max(0, Math.min(100, parseFloat(humedadActual) + rainBoost));
        humedadActual = numeric.toFixed(1);
        // pulso visual en la nube si existe
        if (ambientWaterElement && ambientWaterElement.classList) {
          ambientWaterElement.classList.add('pulse-boost');
          setTimeout(() => ambientWaterElement.classList.remove('pulse-boost'), 1000);
        }
      }
      currentHumedad = parseFloat(humedadActual);
      if (humidityValueElem && humidityValueElem.textContent !== humedadActual) {
        humidityValueElem.textContent = humedadActual;
        animateValue(humidityValueElem);
      }
      if (humiditySummaryElem) humiditySummaryElem.textContent = humedadActual;

      if (humedadPanelValueElem) {
        const texto = `${humedadActual}%`;
        if (humedadPanelValueElem.textContent !== texto) {
          humedadPanelValueElem.textContent = texto;
          animateValue(humedadPanelValueElem);
        }
      }

      if (waterElement && !isNaN(currentHumedad)) {
        const h = Math.max(0, Math.min(100, currentHumedad));
        waterElement.style.height = `${h}%`;
      }
    } // si no hay datos de huertas, NO sobreescribimos la UI ni seteamos currentHumedad a null

    // Temperatura: solo actualizar si viene valor válido
    if (typeof data.temperatura !== 'undefined') {
      const newTemperatura = parseFloat(data.temperatura);
      if (!isNaN(newTemperatura)) {
        currentTemperatura = newTemperatura;
        const tempStr = currentTemperatura.toFixed(1);
        if (temperatureValueElem && temperatureValueElem.textContent !== tempStr) {
          temperatureValueElem.textContent = tempStr;
          animateValue(temperatureValueElem);
        }
        if (temperatureSummaryElem) temperatureSummaryElem.textContent = tempStr;

        if (tempPanelValueElem) {
          const ttxt = `${tempStr} °C`;
          if (tempPanelValueElem.textContent !== ttxt) {
            tempPanelValueElem.textContent = ttxt;
            animateValue(tempPanelValueElem);
          }
        }
      }
    }

    // Humedad ambiente: solo actualizar si viene valor válido
    if (typeof data.humedad_ambiente !== 'undefined') {
      const newHumedadAmbiente = parseFloat(data.humedad_ambiente);
      if (!isNaN(newHumedadAmbiente)) {
        const ambStr = newHumedadAmbiente.toFixed(1);
        if (ambientHumidityValueElem && ambientHumidityValueElem.textContent !== ambStr) {
          ambientHumidityValueElem.textContent = ambStr;
          animateValue(ambientHumidityValueElem);
        }
        if (ambientHumiditySummaryElem) ambientHumiditySummaryElem.textContent = ambStr;
        if (ambientWaterElement) {
          const h = Math.max(0, Math.min(100, newHumedadAmbiente));
          ambientWaterElement.style.height = `${h}%`;
        }
        if (humedadAmbPanelValueElem) {
          const atxt = `${ambStr}%`;
          if (humedadAmbPanelValueElem.textContent !== atxt) {
            humedadAmbPanelValueElem.textContent = atxt;
            animateValue(humedadAmbPanelValueElem);
          }
        }
      }
    }

    // Evaluación por huerta: actualizar si hay valores válidos
    const humedad1 = (!isNaN(val1) ? val1 : null);
    const humedad2 = (!isNaN(val2) ? val2 : null);
    const temp = (typeof currentTemperatura === 'number' && !isNaN(currentTemperatura)) ? currentTemperatura : null;

    // Solo actualizamos el WIDGET de recomendaciones (no escribir dentro de la tarjeta)
    const evalText1 = (humedad1 !== null && temp !== null) ? cultivosOptimosPara(humedad1, temp) : (evaluacionHuerta1WidgetElem?.textContent || "--");
    const evalText2 = (humedad2 !== null && temp !== null) ? cultivosOptimosPara(humedad2, temp) : (evaluacionHuerta2WidgetElem?.textContent || "--");
    if (evaluacionHuerta1WidgetElem) evaluacionHuerta1WidgetElem.textContent = evalText1;
    if (evaluacionHuerta2WidgetElem) evaluacionHuerta2WidgetElem.textContent = evalText2;

    updateEvaluation();

    // actualizar recomendaciones basadas en los valores mostrados
    try { updateRecommendations(); } catch (e) { console.warn('updateRecommendations error', e); }
    
    // Actualiza la hora de la última lectura real (si viene timestamp unix)
    if (data.timestamp) {
      const tsNum = Number(data.timestamp);
      if (!isNaN(tsNum)) {
        const fecha = (tsNum > 1e12) ? new Date(tsNum) : new Date(tsNum * 1000); // soporta ms o s
        setHoraUltimaLectura(fecha.toLocaleString(), true);
      }
    }

    // Última actualización (tiempo local)
    setLastUpdate(new Date().toLocaleTimeString(), true);
    return true;
  } catch (err) {
    console.warn('fetchDatos error:', err);
    // No limpiar la UI por completo: mantener últimos valores visibles.
    setLastUpdate("Error al obtener datos (servidor)", false);
    setHoraUltimaLectura("--", false);
    return false;
  }
}

// NUEVA: recarga coordinada para evitar sobreescrituras problemáticas
function handleReload() {
  if (reloadBtn) {
    reloadBtn.disabled = true;
    const originalText = reloadBtn.textContent;
    reloadBtn.textContent = '⏳ Cargando...';
  }

  Promise.allSettled([fetchDatos(), updateFromWeather()])
    .then(results => {
      const okAny = results.some(r => r.status === 'fulfilled' && r.value === true);
      if (!okAny) {
        // Si TODO falla, limpiar y notificar
        resetSensorDisplays();
        setLastUpdate("", false);
        setHoraUltimaLectura("--", false);
        console.warn('Ambas fuentes fallaron al recargar. Verifica servidor/funciones.');
      }
    })
    .finally(() => {
      if (reloadBtn) {
        reloadBtn.disabled = false;
        reloadBtn.textContent = '🔄 Recargar';
      }
    });
}

/* =================== INDICADOR DE ACTUALIZACIÓN =================== */
function setLastUpdate(timeStr, ok = true) {
  if (!lastUpdateElem) return;
  lastUpdateElem.textContent = ok
    ? `Última actualización: ${timeStr}`
    : `Sin conexión con el servidor`;
  lastUpdateElem.style.color = ok ? "#009688" : "#ff3333";
}

/* =================== EXPORTAR DATOS A CSV =================== */
function exportarCSV() {
  if (!historialDatos.length) {
    alert("No hay datos para exportar.");
    return;
  }
  const encabezado = "Fecha,Huerta 1,Huerta 2,Temperatura,Humedad Ambiente\n";
  const filas = historialDatos.map(d =>
    `${d.fecha},${d.humedad_huerta1},${d.humedad_huerta2},${d.temperatura},${d.humedad_ambiente}`
  ).join("\n");
  const csv = encabezado + filas;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "terradata_historial.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =================== TEMA CLARO/OSCURO =================== */
function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  if (document.body.classList.contains("dark-theme")) {
    localStorage.setItem("terradata-theme", "dark");
  } else {
    localStorage.setItem("terradata-theme", "light");
  }
}


/* =================== FUNCIONES GLOBALES PARA HTML (Modal) =================== */
window.showOptimumParams = function() {
  if (optimumParamsSection) {
    optimumParamsSection.classList.add('show');
    optimumParamsSection.setAttribute('aria-hidden', 'false');
  }
  if (mainCardsContainer) mainCardsContainer.style.display = 'none';
  if (mainTitle) mainTitle.style.display = 'none';
  optimumParamsButtons.forEach(b => b.style.display = 'none');
  document.body.classList.add('no-scroll');
  // focus en modal
  const focusable = optimumParamsSection ? optimumParamsSection.querySelector('button, a, [tabindex]') : null;
  if (focusable) focusable.focus();
};
window.hideOptimumParams = function() {
  if (optimumParamsSection) {
    optimumParamsSection.classList.remove('show');
    optimumParamsSection.setAttribute('aria-hidden', 'true');
  }
  if (mainCardsContainer) mainCardsContainer.style.display = '';
  if (mainTitle) mainTitle.style.display = '';
  optimumParamsButtons.forEach(b => b.style.display = '');
  document.body.classList.remove('no-scroll');
};

/* cierre con ESC para modal */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && optimumParamsSection && optimumParamsSection.classList.contains('show')) {
    window.hideOptimumParams();
  }
});

/* =================== FORZAR LECTURA DESDE LA WEB =================== */
function forzarLecturaESP32() {
  fetch('https://servidor-post-1.onrender.com/forzar-lectura', { method: 'POST' })
    .then(res => res.json())
    .then((data) => {
      alert(data.msg || "Orden enviada al ESP32");
      setTimeout(() => { fetchDatos(); }, 6000); // Espera 6 segundos antes de refrescar
    })
    .catch(err => {
      console.warn('forzarLectura error:', err);
      alert("No se pudo contactar al servidor");
    });
}

/* NUEVO: función para obtener cultivos óptimos por huerta */
function cultivosOptimosPara(humedad, temperatura) {
  if (isNaN(humedad) || isNaN(temperatura)) return "Sin datos";
  const optimos = [];
  for (const [planta, params] of Object.entries(plantOptimalParams)) {
    if (
      humedad >= params.humedad.min && humedad <= params.humedad.max &&
      temperatura >= params.temperatura.min && temperatura <= params.temperatura.max
    ) {
      optimos.push(planta);
    }
  }
  return optimos.length ? optimos.join(", ") : "Ninguno";
}

/* =================== RECOMENDACIONES (widget) =================== */
/* Reescribo para que SOLO actualice el panel de recomendaciones (widget). */
function updateRecommendations() {
  var h1txt = (humedadHuerta1Elem && humedadHuerta1Elem.textContent) ? humedadHuerta1Elem.textContent : "";
  var h2txt = (humedadHuerta2Elem && humedadHuerta2Elem.textContent) ? humedadHuerta2Elem.textContent : "";
  var h1 = parseFloat(h1txt);
  var h2 = parseFloat(h2txt);
  var temp = (typeof currentTemperatura === 'number' && !isNaN(currentTemperatura)) ? currentTemperatura : null;

  function makeHtml(h) {
    if (temp === null) return "Sin datos (temperatura desconocida)";
    if (isNaN(h)) return "Sin datos huerta";
    var res = evaluateConditions(h, temp);
    return formatResultsForWidget(res); // devuelve solo el bloque de Óptimo/Bueno/No óptimo
  }

  if (evaluacionHuerta1WidgetElem) evaluacionHuerta1WidgetElem.innerHTML = makeHtml(h1);
  if (evaluacionHuerta2WidgetElem) evaluacionHuerta2WidgetElem.innerHTML = makeHtml(h2);
}

// Llamar updateRecommendations() tras actualizaciones donde se cambian huertas/temp:
// - en fetchDatos() justo después de actualizar humedadHuerta1Elem/humedadHuerta2Elem
// - en updateFromWeather() justo después de asignar las humedades simuladas

// Ejemplo: añadir estas llamadas (si no existen ya) en los lugares correspondientes:
// 1) dentro de fetchDatos(), justo después de actualizar evaluacionHuertaX y updateEvaluation():
//    updateRecommendations();
// 2) dentro de updateFromWeather(), después de asignar las humedades simuladas:
//    updateRecommendations();

// =================== WIDGET: mostrar panel con recomendaciones actualizadas ===================
document.addEventListener('DOMContentLoaded', function () {
  try {
    // Primera lectura inmediata
    if (typeof fetchDatos === 'function') fetchDatos();
    if (typeof updateFromWeather === 'function') updateFromWeather();

    // Intervals ajustados (evitar duplicados)
    if (typeof fetchDatos === 'function') setInterval(fetchDatos, 60 * 1000); // 60s
    if (typeof updateFromWeather === 'function') setInterval(updateFromWeather, WEATHER_FETCH_INTERVAL_MS); // 10min

    // botón recargar hace ambas lecturas de forma coordinada
    if (reloadBtn) {
      reloadBtn.addEventListener('click', handleReload);
    }

    // Asignar listeners a botones fijos
    if (optimumParamsButtons && optimumParamsButtons.length) {
      optimumParamsButtons.forEach(function(btn) {
        var txt = (btn.textContent || '').toLowerCase();
        btn.addEventListener('click', function () {
          if (txt.indexOf('parámetros') !== -1 || txt.indexOf('parámetro') !== -1) {
            window.showOptimumParams();
          } else if (txt.indexOf('tema') !== -1) {
            toggleTheme();
          } else if (txt.indexOf('forzar') !== -1 || txt.indexOf('lectura') !== -1) {
            forzarLecturaESP32();
          }
        });
      });
    }

    // Botón flotante de recomendaciones: localizar con ID o con clase si falta
    var toggleBtn = recoToggle || document.querySelector('.reco-toggle') || document.getElementById('reco-toggle');
    var panelEl = recoPanel || document.querySelector('.reco-panel') || document.getElementById('reco-panel');

    if (toggleBtn && panelEl) {
      // estado inicial
      try { toggleBtn.setAttribute('aria-expanded', 'false'); } catch(e){ }
      panelEl.style.display = 'none';

      // handler único y robusto
      var handleToggle = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        try { updateRecommendations(); } catch (err) { console.warn('updateRecommendations error', err); }
        var isOpen = panelEl.style.display === 'block';
        panelEl.style.display = isOpen ? 'none' : 'block';
        try { toggleBtn.setAttribute('aria-expanded', String(!isOpen)); } catch(e){ }
      };

      // remover listeners previos si los hubiera
      try { toggleBtn.removeEventListener('click', handleToggle); } catch(e){ }
      toggleBtn.addEventListener('click', handleToggle);

      // cerrar si se hace click fuera
      document.addEventListener('click', function (ev) {
        if (panelEl.style.display === 'block' && !panelEl.contains(ev.target) && ev.target !== toggleBtn) {
          panelEl.style.display = 'none';
          try { toggleBtn.setAttribute('aria-expanded', 'false'); } catch(e){ }
        }
      });

      // evitar cierre al clicar dentro
      panelEl.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); });
    }

    // Tema guardado
    var tema = localStorage.getItem("terradata-theme");
    if (tema === "dark") {
      document.body.classList.add("dark-theme");
    }
  } catch (err) {
    console.error('DOMContentLoaded init error:', err);
  }
});

// =================== CONFIGURACIÓN CLIMA (añadir/asegurar) ===================
const OPENWEATHER_API_KEY = ""; // Para pruebas locales puedes poner aquí tu key (temporal). En producción usa NETLIFY_OPENWEATHER_KEY en Netlify.
const OW_LAT = 6.2442;
const OW_LON = -75.5812;
const WEATHER_FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

// Intentar Netlify Function primero, luego fallback a OpenWeather si hay key
async function fetchWeather() {
  // 1) Netlify Function
  try {
    console.log('fetchWeather: llamando /.netlify/functions/getWeather ...');
    const res = await fetchWithTimeout('/.netlify/functions/getWeather', {}, 7000);
    if (res && res.ok) {
      const json = await res.json();
      console.log('fetchWeather: respuesta function ->', json);
      // esperar { temp, humidity, rain1h } o similar
      var temp = (json && typeof json.temp === 'number') ? json.temp : null;
      var humidity = (json && typeof json.humidity === 'number') ? json.humidity : null;
      var rain1h = (json && typeof json.rain1h === 'number') ? json.rain1h : (json && json.rain ? (json.rain['1h'] || json.rain['3h'] || 0) : 0);
      return { temp: temp, humidity: humidity, rain1h: rain1h, raw: json };
    } else {
      console.warn('fetchWeather: function no disponible o status:', res && res.status);
    }
  } catch (err) {
    console.warn('fetchWeather: error llamando function:', err);
  }

  // 2) Fallback directo a OpenWeather (solo si tienes clave en cliente)
  if (!OPENWEATHER_API_KEY) {
    console.warn('fetchWeather: no hay OPENWEATHER_API_KEY, no hay fallback disponible.');
    return null;
  }
  try {
    const url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + OW_LAT + '&lon=' + OW_LON + '&units=metric&lang=es&appid=' + OPENWEATHER_API_KEY;
    console.log('fetchWeather: llamando OpenWeather directo ...');
    const res2 = await fetchWithTimeout(url, {}, 9000);
    if (!res2 || !res2.ok) {
      console.warn('fetchWeather: OpenWeather respondió status:', res2 && res2.status);
      return null;
    }
    const j = await res2.json();
    const t = (j && j.main && typeof j.main.temp === 'number') ? j.main.temp : null;
    const h = (j && j.main && typeof j.main.humidity === 'number') ? j.main.humidity : null;
    const r = j && j.rain ? (j.rain['1h'] || j.rain['3h'] || 0) : 0;
    console.log('fetchWeather: OpenWeather ->', { temp: t, humidity: h, rain1h: r });
    return { temp: t, humidity: h, rain1h: r, raw: j };
  } catch (err) {
    console.error('fetchWeather: error OpenWeather fallback:', err);
    return null;
  }
}

function simulateSoilMoisture(ambientHumidity, rainMm) {
  if (ambientHumidity === null || isNaN(ambientHumidity)) return null;
  var base = ambientHumidity * 0.6;
  var rainEffect = 0;
  if (!isNaN(rainMm) && rainMm > 0) rainEffect = Math.min(30, rainMm * 8);
  var noise = (Math.random() * 6) - 3;
  var simulated = base + rainEffect + noise;
  simulated = Math.round(Math.max(5, Math.min(95, simulated)) * 10) / 10;
  return simulated;
}

async function updateFromWeather() {
  try {
    const weather = await fetchWeather();
    if (!weather) {
      console.warn('updateFromWeather: no se obtuvo weather');
      setLastUpdate('Sin datos clima', false);
      return false;
    }
    var temp = (typeof weather.temp === 'number') ? weather.temp : null;
    var hum = (typeof weather.humidity === 'number') ? weather.humidity : null;
    var rain = (typeof weather.rain1h === 'number') ? weather.rain1h : 0;

    // Guardar info simple para que fetchDatos pueda usarla al mostrar sensores
    lastWeatherData = { temp: temp, humidity: hum, rain1h: rain, raw: weather.raw };

    // temperatura
    if (temp !== null) {
      currentTemperatura = temp;
      var tempStr = temp.toFixed(1);
      if (temperatureValueElem) temperatureValueElem.textContent = tempStr;
      if (temperatureSummaryElem) temperatureSummaryElem.textContent = tempStr;
      if (thermometerFluid) {
        var minT = 0, maxT = 40;
        var fh = ((temp - minT) / (maxT - minT)) * 100;
        fh = Math.max(0, Math.min(100, fh));
        thermometerFluid.style.height = fh + '%';
      }
      if (tempPanelValueElem) tempPanelValueElem.textContent = temp.toFixed(1) + ' °C';
    }

    // humedad ambiente
    if (hum !== null) {
      currentAmbientHumidity = hum;
      var humStr = hum.toFixed(1);
      if (ambientHumidityValueElem) ambientHumidityValueElem.textContent = humStr;
      if (ambientHumiditySummaryElem) ambientHumiditySummaryElem.textContent = humStr;
      if (ambientWaterElement) ambientWaterElement.style.height = Math.max(0, Math.min(100, hum)) + '%';
      if (humedadAmbPanelValueElem) humedadAmbPanelValueElem.textContent = hum.toFixed(1) + '%';
    }

    // simular suelo (ya considera lluvia dentro de simulateSoilMoisture)
    var soil = simulateSoilMoisture(hum, rain || 0);
    if (soil !== null) {
      currentHumedad = soil;
      var soilStr = soil.toFixed(1);
      if (humidityValueElem) humidityValueElem.textContent = soilStr;
      if (humiditySummaryElem) humiditySummaryElem.textContent = soilStr;
      if (waterElement) waterElement.style.height = Math.max(0, Math.min(100, soil)) + '%';
      // huertas con ligera variación
      if (humedadHuerta1Elem) humedadHuerta1Elem.textContent = Math.max(0, Math.min(100, (soil + (Math.random()*4 - 2)))).toFixed(1);
      if (humedadHuerta2Elem) humedadHuerta2Elem.textContent = Math.max(0, Math.min(100, (soil + (Math.random()*4 - 2)))).toFixed(1);
      if (humedadPanelValueElem) humedadPanelValueElem.textContent = soil.toFixed(1) + '%';
      try { updateRecommendations(); } catch(e) { console.warn('updateRecommendations error', e); }
    }

    // actualizar estado lluvia visible y añadir registro horario (visual)
    try { updateRainStatus(); } catch(e){ }
    tryAddHourlyRecord(false);

    setLastUpdate(new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'}), true);
    return true;
  } catch (err) {
    console.error('updateFromWeather error:', err);
    setLastUpdate('Error (clima)', false);
    return false;
  }
}

/* Cargar / guardar historial horario (localStorage) */
function loadHourlyRecords() {
  try {
    const raw = localStorage.getItem(HOURLY_STORAGE_KEY);
    hourlyRecords = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('loadHourlyRecords error', e);
    hourlyRecords = [];
  }
}
function saveHourlyRecords() {
  try {
    localStorage.setItem(HOURLY_STORAGE_KEY, JSON.stringify(hourlyRecords));
  } catch (e) {
    console.warn('saveHourlyRecords error', e);
  }
}

/* Añadir registro horario (solo si pasó ~1h desde el último) */
function tryAddHourlyRecord(force = false) {
  const now = Date.now();
  // Necesitamos tener al menos temperatura y humedad de suelo/amb
  const soil = (typeof currentHumedad === 'number') ? currentHumedad : parseFloat(humidityValueElem?.textContent || NaN);
  const temp = (typeof currentTemperatura === 'number') ? currentTemperatura : parseFloat(temperatureValueElem?.textContent || NaN);
  const amb = (typeof currentAmbientHumidity === 'number') ? currentAmbientHumidity : parseFloat(ambientHumidityValueElem?.textContent || NaN);
  const rain = (lastWeatherData && typeof lastWeatherData.rain1h === 'number') ? lastWeatherData.rain1h : 0;

  if (isNaN(soil) && isNaN(temp) && isNaN(amb)) return; // no hay datos

  const last = hourlyRecords.length ? hourlyRecords[hourlyRecords.length - 1] : null;
  if (!force && last && (now - last.ts) < (55 * 60 * 1000)) {
    // si ya hay registro en <55 minutos no añadimos
    return;
  }

  const rec = {
    ts: now,
    soil: isNaN(soil) ? null : Number(Number(soil).toFixed(1)),
    temp: isNaN(temp) ? null : Number(Number(temp).toFixed(1)),
    ambient: isNaN(amb) ? null : Number(Number(amb).toFixed(1)),
    rain1h: Number(rain || 0)
  };
  hourlyRecords.push(rec);
  // mantener último N registros (ej. 72 horas)
  if (hourlyRecords.length > 72) hourlyRecords.shift();
  saveHourlyRecords();
  renderHourlyHistory();
}

/* Render del historial horario (timeline) */
function formatHourLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function renderHourlyHistory() {
  const track = document.getElementById('history-track');
  if (!track) return;
  track.innerHTML = '';
  // ordenar asc por ts
  const list = hourlyRecords.slice().sort((a,b) => a.ts - b.ts);
  if (!list.length) {
    track.innerHTML = '<div style="color:#00695c; padding:0.6rem;">No hay registros horarios aún.</div>';
    return;
  }
  for (const r of list) {
    const card = document.createElement('div');
    card.className = 'history-card' + (r.rain1h > 0 ? ' rainy' : '');
    card.innerHTML = `
      <div class="hour">${formatHourLabel(r.ts)}</div>
      <div class="icon">${r.rain1h > 0 ? '🌧️ Lluvia' : '☁️'}</div>
      <div class="vals">
        <span><strong>Suelo</strong><strong>${r.soil !== null ? r.soil + '%' : '--'}</strong></span>
        <span><strong>Temp</strong><strong>${r.temp !== null ? r.temp + '°C' : '--'}</strong></span>
        <span><strong>Amb</strong><strong>${r.ambient !== null ? r.ambient + '%' : '--'}</strong></span>
        <span><strong>mm/h</strong><strong>${r.rain1h}</strong></span>
      </div>
    `;
    track.appendChild(card);
  }
  // dejar visible el último registro
  track.scrollLeft = track.scrollWidth;
}

/* Mostrar estado de lluvia en UI */
function updateRainStatus() {
  const badge = document.getElementById('rain-badge');
  const decor = document.getElementById('clima-decor');
  if (!badge) return;
  const rain = lastWeatherData && typeof lastWeatherData.rain1h === 'number' ? lastWeatherData.rain1h : 0;
  if (rain > 0) {
    badge.textContent = `🌧️ Lloviendo (${rain} mm/h) en Medellín`;
    badge.style.color = '#0d47a1';
    badge.style.background = 'linear-gradient(90deg,#fff 0%, #eaf6ff 100%)';
    if (decor) decor.textContent = '🌧️';
  } else {
    badge.textContent = '☁️ Sin lluvia reciente en Medellín';
    badge.style.color = '#00796b';
    badge.style.background = 'linear-gradient(90deg,#fff 0%, #f0fbff 100%)';
    if (decor) decor.textContent = '☁️';
  }
}

/* Exportar histórico horario a CSV */
function exportHourlyCSV() {
  if (!hourlyRecords.length) {
    alert('No hay registros horarios para exportar.');
    return;
  }
  const header = 'FechaHora,Suelo(%),Temperatura(°C),HumedadAmb(%),Lluvia_mm_h\n';
  const rows = hourlyRecords.map(r => {
    const date = new Date(r.ts).toLocaleString();
    return `${date},${r.soil ?? ''},${r.temp ?? ''},${r.ambient ?? ''},${r.rain1h ?? 0}`;
  }).join('\n');
  const csv = header + rows;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terradata_hourly_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =================== FUNCIONES PARA HISTORIAL DE PROMEDIOS DIARIOS =================== */

let dailyAverageData = []; // Array para guardar los datos de promedios diarios

async function fetchHistoricalData() {
  const historyTableContainer = document.getElementById('historical-data-table');
  historyTableContainer.innerHTML = 'Calculando promedios históricos diarios...'; 

  try {
    const response = await fetch('/.netlify/functions/get-daily-averages'); 
    
    if (!response.ok) {
        throw new Error('Error al cargar promedios diarios desde el servidor.');
    }
    
    dailyAverageData = await response.json(); 
    renderHistoryTable(dailyAverageData);

  } catch (error) {
    console.error('Error al obtener promedios históricos:', error);
    historyTableContainer.innerHTML = '<p class="error-message">Fallo al cargar el historial de promedios diarios. Intenta más tarde.</p>';
  }
}

function renderHistoryTable(data) {
    const container = document.getElementById('historical-data-table');
    if (data.length === 0) {
        container.innerHTML = '<p>No hay promedios diarios disponibles. Se mostrarán después de las primeras 24 horas de recolección.</p>';
        return;
    }

    // Estructura de la tabla para promedios diarios
    let tableHTML = '<table><thead><tr>';
    tableHTML += '<th>Día</th><th>Temp. Promedio (°C)</th><th>Humedad Promedio (%)</th><th>Viento Promedio (m/s)</th>';
    tableHTML += '</tr></thead><tbody>';

    data.forEach(item => {
        const formattedDate = new Date(item.date).toLocaleDateString('es-ES', { 
            weekday: 'short', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });

        tableHTML += `<tr>
            <td>${formattedDate}</td>
            <td>${item.avg_temp.toFixed(1)}</td>
            <td>${item.avg_hum.toFixed(1)}</td>
            <td>${item.avg_wind.toFixed(1)}</td>
        </tr>`;
    });

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}


function exportHourlyCSV() {
    if (dailyAverageData.length === 0) {
        alert("No hay datos de promedios para exportar.");
        return;
    }
    
    let csvContent = "Día,Temp. Promedio,Humedad Promedio,Viento Promedio\n";

    dailyAverageData.forEach(item => {
        const formattedDate = new Date(item.date).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });
        csvContent += `${formattedDate},${item.avg_temp.toFixed(1)},${item.avg_hum.toFixed(1)},${item.avg_wind.toFixed(1)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'historial_promedios_terradata.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* =================== HANDLERS: Botón historial / Modal =================== */
(function setupHistoryModalHandlers() {
  const historyBtn = document.getElementById('history-btn');
  const hourlyModal = document.getElementById('hourly-modal');
  const modalClose = document.getElementById('hourly-modal-close');
  const backdrop = hourlyModal ? hourlyModal.querySelector('.hourly-modal-backdrop') : null;
  const exportBtn = document.getElementById('export-hourly-btn');

  function openModal() {
  const hourlyModal = document.getElementById('hourly-modal');
  hourlyModal.setAttribute('aria-hidden', 'false');
  hourlyModal.classList.add('visible');
  // 🚀 Llama a la función que consulta los datos de promedios
  fetchHistoricalData(); 
}


  function closeModal() {
    if (!hourlyModal) return;
    hourlyModal.setAttribute('aria-hidden', 'true');
    historyBtn?.setAttribute('aria-expanded', 'false');
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      const open = hourlyModal && hourlyModal.getAttribute('aria-hidden') === 'false';
      if (open) closeModal(); else openModal();
    });
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // teclado: ESC cierra
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hourlyModal && hourlyModal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // exportar botón (si existe)
  if (exportBtn) exportBtn.addEventListener('click', function () {
    try { exportHourlyCSV(); } catch(e) { console.warn('Error exportando CSV', e); }
  });

  // Asegurar que updateRainStatus actualice también clase en historyBtn (no rompe si no existe)
  const originalUpdateRainStatus = window.updateRainStatus;
  if (typeof originalUpdateRainStatus === 'function') {
    window.updateRainStatus = function () {
      try { originalUpdateRainStatus(); } catch(e) { console.warn(e); }
      // marcar botón si hay lluvia
      try {
        const rain = lastWeatherData && typeof lastWeatherData.rain1h === 'number' ? lastWeatherData.rain1h : 0;
        if (historyBtn) {
          if (rain > 0) historyBtn.classList.add('rainy'); else historyBtn.classList.remove('rainy');
        }
      } catch (e) { /* ignore */ }
    };
  } else {
    // fallback: sólo marcar con lastWeatherData
    if (historyBtn) {
      if (lastWeatherData && lastWeatherData.rain1h > 0) historyBtn.classList.add('rainy');
    }
  }
})();



