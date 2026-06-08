function confirmarObtenerGPS() {
  const confirmar = confirm("¿Desea obtener la ubicación actual?\n\nSi ya tiene coordenadas escritas, serán reemplazadas.");

  if (confirmar) {
    obtenerGPS();
  }
}

function obtenerGPS() {
  if (!navigator.geolocation) {
    alert("GPS no disponible en este dispositivo.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      document.getElementById("col_11").value = lat.toFixed(6) + ", " + lon.toFixed(6);

      const utm = latLonToUTMObj(lat, lon);

      document.getElementById("utm_x").value = utm.easting;
      document.getElementById("utm_y").value = utm.northing;
      document.getElementById("col_12").value = "16N " + utm.easting + " " + utm.northing;
    },
    function(error) {
      alert("No se pudo obtener la ubicación exacta. Active permisos de ubicación y GPS.");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function convertirGpsManual() {
  const valor = document.getElementById("col_11").value.trim();

  if (!valor) {
    limpiarUTM();
    return;
  }

  const partes = valor.split(",");

  if (partes.length !== 2) {
    alert("Formato GPS incorrecto. Use: latitud, longitud");
    limpiarUTM();
    return;
  }

  const lat = parseFloat(partes[0]);
  const lon = parseFloat(partes[1]);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert("Coordenadas GPS inválidas.");
    limpiarUTM();
    return;
  }

  const utm = latLonToUTMObj(lat, lon);

  document.getElementById("utm_x").value = utm.easting;
  document.getElementById("utm_y").value = utm.northing;
  document.getElementById("col_12").value = "16N " + utm.easting + " " + utm.northing;
}

function convertirUtmXYManual() {
  const valorX = document.getElementById("utm_x").value.trim();
  const valorY = document.getElementById("utm_y").value.trim();

  if (!valorX && !valorY) {
    document.getElementById("col_11").value = "";
    document.getElementById("col_12").value = "";
    return;
  }

  if (!valorX || !valorY) {
    return;
  }

  const x = parseFloat(valorX);
  const y = parseFloat(valorY);

  if (isNaN(x) || isNaN(y)) {
    alert("UTM inválido. Debe ingresar valores numéricos en X y Y.");
    document.getElementById("col_11").value = "";
    document.getElementById("col_12").value = "";
    return;
  }

  if (x < 100000 || x > 900000 || y < 0 || y > 10000000) {
    alert("Coordenadas UTM inválidas. Revise X y Y.");
    document.getElementById("col_11").value = "";
    document.getElementById("col_12").value = "";
    return;
  }

  const resultado = utmToLatLon("16N", x, y);

  document.getElementById("col_11").value =
    resultado.lat.toFixed(6) + ", " + resultado.lon.toFixed(6);

  document.getElementById("col_12").value =
    "16N " + Math.round(x) + " " + Math.round(y);
}

function limpiarUTM() {
  document.getElementById("utm_x").value = "";
  document.getElementById("utm_y").value = "";
  document.getElementById("col_12").value = "";
}

function latLonToUTMObj(lat, lon) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e = Math.sqrt(f * (2 - f));

  const zone = 16;
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  const e2 = e * e;
  const ep2 = e2 / (1 - e2);

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ep2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lon0);

  const M = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad)
  );

  let easting = k0 * N * (
    A + (1 - T + C) * A ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120
  ) + 500000;

  let northing = k0 * (
    M + N * Math.tan(latRad) * (
      A ** 2 / 2
      + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720
    )
  );

  return {
    zone: "16N",
    easting: Math.round(easting),
    northing: Math.round(northing)
  };
}

function utmToLatLon(zona, easting, northing) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const zoneNumber = parseInt(zona);
  const hemisphere = zona.slice(-1);

  const e = Math.sqrt(f * (2 - f));
  const e1sq = e * e / (1 - e * e);

  let x = easting - 500000;
  let y = northing;

  if (hemisphere === "S") {
    y -= 10000000;
  }

  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;

  const M = y / k0;
  const mu = M / (a * (1 - e ** 2 / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256));

  const e1 = (1 - Math.sqrt(1 - e ** 2)) / (1 + Math.sqrt(1 - e ** 2));

  const J1 = 3 * e1 / 2 - 27 * e1 ** 3 / 32;
  const J2 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32;
  const J3 = 151 * e1 ** 3 / 96;
  const J4 = 1097 * e1 ** 4 / 512;

  const fp = mu
    + J1 * Math.sin(2 * mu)
    + J2 * Math.sin(4 * mu)
    + J3 * Math.sin(6 * mu)
    + J4 * Math.sin(8 * mu);

  const C1 = e1sq * Math.cos(fp) ** 2;
  const T1 = Math.tan(fp) ** 2;
  const N1 = a / Math.sqrt(1 - e ** 2 * Math.sin(fp) ** 2);
  const R1 = a * (1 - e ** 2) / Math.pow(1 - e ** 2 * Math.sin(fp) ** 2, 1.5);
  const D = x / (N1 * k0);

  const lat = fp - (N1 * Math.tan(fp) / R1) * (
    D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e1sq) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e1sq - 3 * C1 ** 2) * D ** 6 / 720
  );

  const lon = (D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e1sq + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(fp);

  return {
    lat: lat * 180 / Math.PI,
    lon: lonOrigin + lon * 180 / Math.PI
  };
}
