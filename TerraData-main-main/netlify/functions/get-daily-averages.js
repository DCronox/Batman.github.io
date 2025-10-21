// Archivo: netlify/functions/get-daily-averages.js
// Descripción: Calcula el promedio diario de temperatura, humedad y viento a partir de lecturas horarias.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ====== Inicialización de Firebase ======
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString()
  );
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  throw new Error("⚠️ No se encontró la variable FIREBASE_SERVICE_ACCOUNT o FIREBASE_SERVICE_ACCOUNT_BASE64");
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

exports.handler = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // 1️⃣ Leer lecturas horarias del último mes
    const snapshot = await db
      .collection("lecturas_horarias")
      .where("timestamp", ">=", thirtyDaysAgo)
      .orderBy("timestamp", "asc")
      .get();

    const readings = snapshot.docs.map((doc) => doc.data());
    const dailyData = {};

    // 2️⃣ Agrupar por día
    readings.forEach((r) => {
      if (!r.timestamp) return;
      const dateObj =
        typeof r.timestamp.toDate === "function"
          ? r.timestamp.toDate()
          : new Date(r.timestamp);
      const dateKey = dateObj.toISOString().split("T")[0];

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { tempSum: 0, humSum: 0, windSum: 0, count: 0 };
      }

      if (typeof r.ambientTemp === "number")
        dailyData[dateKey].tempSum += r.ambientTemp;
      if (typeof r.ambientHumidity === "number")
        dailyData[dateKey].humSum += r.ambientHumidity;
      if (typeof r.windSpeed === "number")
        dailyData[dateKey].windSum += r.windSpeed;

      dailyData[dateKey].count++;
    });

    // 3️⃣ Calcular promedios
    const averages = Object.keys(dailyData)
      .map((dateKey) => {
        const d = dailyData[dateKey];
        return {
          date: dateKey,
          avg_temp: d.tempSum / d.count,
          avg_hum: d.humSum / d.count,
          avg_wind: d.windSum / d.count
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      statusCode: 200,
      body: JSON.stringify(averages),
      headers: { "Content-Type": "application/json" }
    };
  } catch (error) {
    console.error("❌ Error al calcular promedios:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Fallo al calcular promedios" })
    };
  }
};

