const fetch = require('node-fetch');

exports.handler = async function(event) {
  const key = process.env.OPENWEATHERMAP_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No API key configured on server' }) };
  }

  const lat = 6.2442;
  const lon = -75.5812;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'OpenWeather error' }) };
    }
    const json = await res.json();
    const temp = typeof json.main?.temp === 'number' ? json.main.temp : null;
    const humidity = typeof json.main?.humidity === 'number' ? json.main.humidity : null;
    const rain1h = (json.rain && (json.rain['1h'] || json.rain['3h'])) ? (json.rain['1h'] || json.rain['3h'] || 0) : 0;
    return { statusCode: 200, body: JSON.stringify({ temp, humidity, rain1h, raw: json }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
