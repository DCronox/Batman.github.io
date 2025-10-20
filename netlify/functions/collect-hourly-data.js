// Archivo: netlify/functions/collect-hourly-data.js
// Descripción: Recoge datos del clima desde OpenWeather y los guarda cada hora en Firestore.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

// ====== Inicialización de Firebase con soporte para JSON y Base64 ======
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  // Si la clave está codificada en Base64
  serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
  );
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Si la clave está pegada en una sola línea
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  throw new Error("⚠️ No se encontró la variable FIREBASE_SERVICE_ACCOUNT o FIREBASE_SERVICE_ACCOUNT_BASE64");
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ====== Configuración de la API de clima ======
const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const LAT = 6.2442;  // Medellín
const LON = -75.5812;
const WEATHER_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&units=metric&lang=es&appid=${API_KEY}`;

// Configure the function to run hourly using Netlify's native scheduled functions
exports.config = {
  schedule: "@hourly"
};

exports.handler = async () => {
  if (!API_KEY) {
    console.error("❌ Falta la variable OPENWEATHERMAP_API_KEY");
    return { statusCode: 500, body: "Error: Falta clave de API de OpenWeather" };
  }

  try {
    // 1️⃣ Obtener datos del clima
    const response = await fetch(WEATHER_URL);
    if (!response.ok) throw new Error(`Error de API (${response.status})`);
    const data = await response.json();

    // 2️⃣ Preparar los datos
    const reading = {
      ambientTemp: data.main?.temp ?? null,
      ambientHumidity: data.main?.humidity ?? null,
      windSpeed: data.wind?.speed ?? null,
      rain1h:
        (data.rain && (data.rain["1h"] || data.rain["3h"]))
          ? (data.rain["1h"] || data.rain["3h"])
          : 0,
      timestamp: FieldValue.serverTimestamp()
    };

    // 3️⃣ Guardar en Firestore
    await db.collection("lecturas_horarias").add(reading);

    console.log("✅ Lectura guardada correctamente:", reading);
    return { statusCode: 200, body: "Lectura horaria guardada exitosamente." };
  } catch (err) {
    console.error("❌ Error al recolectar datos:", err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
