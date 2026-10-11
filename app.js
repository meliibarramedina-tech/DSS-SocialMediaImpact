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
    "Primary_Platform",
    "Age",
  ];
  const missingColumns = requiredColumns.filter((column) => !columnIndexes.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas en el CSV: ${missingColumns.join(", ")}.`);
  }

  const participantIds = new Set();
  const platformTotals = new Map();
  const ageTotals = new Map();
  for (const record of records) {
    const participantId = record[columnIndexes.get("Student_ID")]?.trim();
    if (participantId) {
      participantIds.add(participantId);
    }

    const rawUsage = record[columnIndexes.get("Daily_Usage_Hours")]?.trim() ?? "";
    const platform = record[columnIndexes.get("Primary_Platform")]?.trim();
    const rawAge = record[columnIndexes.get("Age")]?.trim() ?? "";
    const usage = Number(rawUsage);
    const age = Number(rawAge);
    if (!rawUsage || !platform || !rawAge || !Number.isFinite(usage) || !Number.isFinite(age)) {
      continue;
    }

    function addToGroup(groups, key) {
      const group = groups.get(key) ?? { total: 0, count: 0 };
      group.total += usage;
      group.count += 1;
      groups.set(key, group);
    }

    addToGroup(platformTotals, platform);
    addToGroup(ageTotals, age);
  }
  if (participantIds.size === 0) {
    throw new Error("No se encontraron identificadores de participantes en el CSV.");
  }
  if (platformTotals.size === 0 || ageTotals.size === 0) {
    throw new Error("No hay registros válidos para construir las gráficas.");
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
    usageByPlatform: [...platformTotals.entries()]
      .map(([label, group]) => ({ label, average: group.total / group.count, count: group.count }))
      .sort((left, right) => left.label.localeCompare(right.label, "es")),
    usageByAge: [...ageTotals.entries()]
      .map(([label, group]) => ({ label, average: group.total / group.count, count: group.count }))
      .sort((left, right) => left.label - right.label),
  };
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  return element;
}

function addSvgText(svg, text, attributes = {}) {
  const element = createSvgElement("text", attributes);
  element.textContent = text;
  svg.append(element);
  return element;
}

function createChartSvg(container, title, description) {
  const svg = createSvgElement("svg", {
    viewBox: "0 0 480 350",
    role: "img",
    "aria-label": `${title}. ${description}`,
  });
  const titleElement = createSvgElement("title");
  titleElement.textContent = title;
  const descriptionElement = createSvgElement("desc");
  descriptionElement.textContent = description;
  svg.append(titleElement, descriptionElement);
  container.replaceChildren(svg);
  return svg;
}

function addChartAxes(svg, { left, right, top, bottom, maxValue, xLabel, yLabel }) {
  const tickStep = 2;
  for (let value = 0; value <= maxValue; value += tickStep) {
    const y = bottom - (value / maxValue) * (bottom - top);
    svg.append(createSvgElement("line", {
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      class: "chart-grid-line",
    }));
    addSvgText(svg, String(value), {
      x: left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-tick-label",
    });
  }

  svg.append(createSvgElement("line", {
    x1: left,
    y1: top,
    x2: left,
    y2: bottom,
    class: "chart-axis-line",
  }));
  svg.append(createSvgElement("line", {
    x1: left,
    y1: bottom,
    x2: right,
    y2: bottom,
    class: "chart-axis-line",
  }));
  addSvgText(svg, xLabel, {
    x: (left + right) / 2,
    y: 342,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });
  addSvgText(svg, yLabel, {
    x: 17,
    y: (top + bottom) / 2,
    transform: `rotate(-90 17 ${(top + bottom) / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });
}

function renderPlatformChart(data) {
  const title = "Uso diario promedio por plataforma";
  const svg = createChartSvg(
    document.querySelector("#platform-chart"),
    title,
    "Gráfica de barras del promedio de horas diarias de uso de redes sociales por plataforma principal.",
  );
  const left = 52;
  const right = 468;
  const top = 25;
  const bottom = 265;
  const maxValue = Math.max(8, Math.ceil(Math.max(...data.map((item) => item.average)) / 2) * 2);
  addChartAxes(svg, {
    left,
    right,
    top,
    bottom,
    maxValue,
    xLabel: "Plataforma principal",
    yLabel: "Uso promedio (horas/día)",
  });

  const slotWidth = (right - left) / data.length;
  const barWidth = Math.min(48, slotWidth * 0.58);
  for (const [index, item] of data.entries()) {
    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
    const barHeight = (item.average / maxValue) * (bottom - top);
    const bar = createSvgElement("rect", {
      x,
      y: bottom - barHeight,
      width: barWidth,
      height: barHeight,
      rx: 4,
      fill: "#168b83",
    });
    const barTitle = createSvgElement("title");
    barTitle.textContent =
      `${item.label}: ${numberFormat.format(item.average)} horas/día (n=${integerFormat.format(item.count)})`;
    bar.append(barTitle);
    svg.append(bar);
    addSvgText(svg, numberFormat.format(item.average), {
      x: x + barWidth / 2,
      y: bottom - barHeight - 7,
      "text-anchor": "middle",
      class: "chart-tick-label",
    });
    addSvgText(svg, item.label, {
      x: x + barWidth / 2,
      y: bottom + 18,
      "text-anchor": "middle",
      class: "chart-tick-label",
    });
  }
}

function renderAgeChart(data) {
  const title = "Uso diario promedio por edad";
  const svg = createChartSvg(
    document.querySelector("#age-chart"),
    title,
    "Gráfica de líneas transversal del promedio de horas diarias de uso de redes sociales por edad, no por fecha.",
  );
  const left = 52;
  const right = 468;
  const top = 25;
  const bottom = 265;
  const maxValue = Math.max(8, Math.ceil(Math.max(...data.map((item) => item.average)) / 2) * 2);
  addChartAxes(svg, {
    left,
    right,
    top,
    bottom,
    maxValue,
    xLabel: "Edad (años)",
    yLabel: "Uso promedio (horas/día)",
  });

  const xFor = (index) => left + (data.length === 1 ? 0 : (index / (data.length - 1)) * (right - left));
  const yFor = (value) => bottom - (value / maxValue) * (bottom - top);
  const path = data.map((item, index) =>
    `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(item.average)}`,
  ).join(" ");
  svg.append(createSvgElement("path", {
    d: path,
    fill: "none",
    stroke: "#2379e8",
    "stroke-width": 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));

  for (const [index, item] of data.entries()) {
    const x = xFor(index);
    const y = yFor(item.average);
    const point = createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 4,
      fill: "#2379e8",
      stroke: "#ffffff",
      "stroke-width": 2,
    });
    const pointTitle = createSvgElement("title");
    pointTitle.textContent =
      `${item.label} años: ${numberFormat.format(item.average)} horas/día (n=${integerFormat.format(item.count)})`;
    point.append(pointTitle);
    svg.append(point);

    if (index === 0 || index === data.length - 1 || index % 2 === 0) {
      addSvgText(svg, String(item.label), {
        x,
        y: bottom + 18,
        "text-anchor": "middle",
        class: "chart-tick-label",
      });
    }
  }
}

function renderMetrics(metrics) {
  document.querySelector("#participant-count").textContent = integerFormat.format(metrics.participants);
  document.querySelector("#average-usage").textContent = numberFormat.format(metrics.averageUsage);
  document.querySelector("#average-sleep").textContent = numberFormat.format(metrics.averageSleep);
  document.querySelector("#average-sleep-quality").textContent = numberFormat.format(metrics.averageSleepQuality);

  const status = document.querySelector("#kpi-status");
  status.textContent = `Cálculo completado desde el archivo fuente: ${integerFormat.format(metrics.participants)} participantes.`;
  renderPlatformChart(metrics.usageByPlatform);
  renderAgeChart(metrics.usageByAge);
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
