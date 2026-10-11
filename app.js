const sourceFile = "./Social_media_impact_on_life-selected-columns.csv";
const numberFormat = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormat = new Intl.NumberFormat("es-MX");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("El archivo CSV contiene un campo entre comillas sin cerrar.");
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

function calculateMetrics(csvText) {
  const [rawHeaders, ...records] = parseCsv(csvText);
  if (!rawHeaders) {
    throw new Error("El archivo CSV está vacío.");
  }

  const headers = rawHeaders.map((header) => header.trim().replace(/^\uFEFF/, ""));
  const columnIndexes = new Map(headers.map((header, index) => [header, index]));
  const requiredColumns = [
    "Student_ID",
    "Daily_Usage_Hours",
    "Sleep_Duration_Hours",
    "Sleep_Quality_Score",
  ];
  const missingColumns = requiredColumns.filter((column) => !columnIndexes.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas en el CSV: ${missingColumns.join(", ")}.`);
  }

  const participantIds = new Set();
  for (const record of records) {
    const participantId = record[columnIndexes.get("Student_ID")]?.trim();
    if (participantId) {
      participantIds.add(participantId);
    }
  }
  if (participantIds.size === 0) {
    throw new Error("No se encontraron identificadores de participantes en el CSV.");
  }

  function average(columnName) {
    const columnIndex = columnIndexes.get(columnName);
    const values = records
      .map((record) => record[columnIndex]?.trim() ?? "")
      .filter((value) => value !== "")
      .map((value) => Number(value));

    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`La columna ${columnName} no contiene valores numéricos válidos.`);
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  return {
    participants: participantIds.size,
    averageUsage: average("Daily_Usage_Hours"),
    averageSleep: average("Sleep_Duration_Hours"),
    averageSleepQuality: average("Sleep_Quality_Score"),
  };
}

function renderMetrics(metrics) {
  document.querySelector("#participant-count").textContent = integerFormat.format(metrics.participants);
  document.querySelector("#average-usage").textContent = numberFormat.format(metrics.averageUsage);
  document.querySelector("#average-sleep").textContent = numberFormat.format(metrics.averageSleep);
  document.querySelector("#average-sleep-quality").textContent = numberFormat.format(metrics.averageSleepQuality);

  const status = document.querySelector("#kpi-status");
  status.textContent = `Cálculo completado desde el archivo fuente: ${integerFormat.format(metrics.participants)} participantes.`;
}

async function loadMetrics() {
  const status = document.querySelector("#kpi-status");
  try {
    const response = await fetch(sourceFile);
    if (!response.ok) {
      throw new Error(`No se pudo leer el archivo fuente (HTTP ${response.status}).`);
    }
    const metrics = calculateMetrics(await response.text());
    renderMetrics(metrics);
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = `No se pudieron calcular los KPI: ${error.message} Abre el proyecto desde un servidor local y comprueba que el CSV esté en la misma carpeta.`;
  }
}

loadMetrics();
