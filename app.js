const sourceFile = "./Social_media_impact_on_life-selected-columns.csv";
const numberFormat = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormat = new Intl.NumberFormat("es-MX");
const allLevelsValue = "__all__";
const missingLevelValue = "__missing__";
let sourceCsvText = "";

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

function calculateMetrics(csvText, selectedLevel = allLevelsValue) {
  const [rawHeaders, ...allRecords] = parseCsv(csvText);
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
    "Academic_Level",
  ];
  const missingColumns = requiredColumns.filter((column) => !columnIndexes.has(column));
  if (missingColumns.length > 0) {
    throw new Error(`Faltan columnas requeridas en el CSV: ${missingColumns.join(", ")}.`);
  }

  const academicLevelIndex = columnIndexes.get("Academic_Level");
  const academicLevelCounts = new Map();
  for (const record of allRecords) {
    const level = record[academicLevelIndex]?.trim() ?? "";
    const key = level || missingLevelValue;
    const group = academicLevelCounts.get(key) ?? { label: level || "Sin categoría (vacíos)", count: 0 };
    group.count += 1;
    academicLevelCounts.set(key, group);
  }

  const records = allRecords.filter((record) => {
    const level = record[academicLevelIndex]?.trim() ?? "";
    if (selectedLevel === allLevelsValue) {
      return true;
    }
    if (selectedLevel === missingLevelValue) {
      return level === "";
    }
    return level === selectedLevel;
  });

  const participantIds = new Set();
  const platformTotals = new Map();
  const ageTotals = new Map();
  const sleepQualityCounts = new Map();
  const usageValues = [];
  const usageSleepPairs = [];

  function addToGroup(groups, key, value) {
    const group = groups.get(key) ?? { total: 0, count: 0 };
    group.total += value;
    group.count += 1;
    groups.set(key, group);
  }

  for (const record of records) {
    const participantId = record[columnIndexes.get("Student_ID")]?.trim();
    if (participantId) {
      participantIds.add(participantId);
    }

    const rawUsage = record[columnIndexes.get("Daily_Usage_Hours")]?.trim() ?? "";
    const platform = record[columnIndexes.get("Primary_Platform")]?.trim();
    const rawAge = record[columnIndexes.get("Age")]?.trim() ?? "";
    const rawSleep = record[columnIndexes.get("Sleep_Duration_Hours")]?.trim() ?? "";
    const rawQuality = record[columnIndexes.get("Sleep_Quality_Score")]?.trim() ?? "";
    const usage = Number(rawUsage);
    const age = Number(rawAge);
    const sleep = Number(rawSleep);
    const quality = Number(rawQuality);

    if (rawUsage && Number.isFinite(usage)) {
      usageValues.push(usage);
      if (platform) {
        addToGroup(platformTotals, platform, usage);
      }
      if (rawAge && Number.isFinite(age)) {
        addToGroup(ageTotals, age, usage);
      }
      if (rawSleep && Number.isFinite(sleep)) {
        usageSleepPairs.push({ usage, sleep });
      }
    }

    if (rawQuality && Number.isFinite(quality)) {
      sleepQualityCounts.set(quality, (sleepQualityCounts.get(quality) ?? 0) + 1);
    }
  }
  if (records.length > 0 && participantIds.size === 0) {
    throw new Error("No se encontraron identificadores de participantes en el CSV.");
  }
  if (records.length > 0 && (platformTotals.size === 0 || ageTotals.size === 0 || usageSleepPairs.length === 0
    || usageValues.length === 0 || sleepQualityCounts.size === 0)) {
    throw new Error("No hay suficientes registros válidos para construir todas las gráficas.");
  }

  function average(columnName) {
    const columnIndex = columnIndexes.get(columnName);
    const values = [];
    for (const record of records) {
      const rawValue = record[columnIndex]?.trim() ?? "";
      if (!rawValue) {
        continue;
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new Error(`La columna ${columnName} contiene un valor no numérico.`);
      }
      values.push(value);
    }

    return values.length > 0
      ? values.reduce((total, value) => total + value, 0) / values.length
      : null;
  }

  const platformRows = new Map();
  const platformIndex = columnIndexes.get("Primary_Platform");
  for (const record of records) {
    const platform = record[platformIndex]?.trim();
    if (!platform) {
      continue;
    }
    const stats = platformRows.get(platform) ?? {
      participants: 0,
      usageCount: 0,
      usageTotal: 0,
      sleepCount: 0,
      sleepTotal: 0,
      qualityCount: 0,
      qualityTotal: 0,
    };
    stats.participants += 1;
    for (const [columnName, totalName, countName] of [
      ["Daily_Usage_Hours", "usageTotal", "usageCount"],
      ["Sleep_Duration_Hours", "sleepTotal", "sleepCount"],
      ["Sleep_Quality_Score", "qualityTotal", "qualityCount"],
    ]) {
      const rawValue = record[columnIndexes.get(columnName)]?.trim() ?? "";
      const value = Number(rawValue);
      if (rawValue && Number.isFinite(value)) {
        stats[totalName] += value;
        stats[countName] += 1;
      }
    }
    platformRows.set(platform, stats);
  }

  return {
    participants: participantIds.size,
    averageUsage: average("Daily_Usage_Hours"),
    averageSleep: average("Sleep_Duration_Hours"),
    averageSleepQuality: average("Sleep_Quality_Score"),
    selectedLevel,
    matchingRecords: records.length,
    totalRecords: allRecords.length,
    academicLevels: [...academicLevelCounts.entries()]
      .map(([value, group]) => ({ value, label: group.label, count: group.count })),
    usageByPlatform: [...platformTotals.entries()]
      .map(([label, group]) => ({ label, average: group.total / group.count, count: group.count }))
      .sort((left, right) => left.label.localeCompare(right.label, "es")),
    usageByAge: [...ageTotals.entries()]
      .map(([label, group]) => ({ label, average: group.total / group.count, count: group.count }))
      .sort((left, right) => left.label - right.label),
    usageSleepPairs,
    usageValues,
    sleepQualityCounts: [...sleepQualityCounts.entries()]
      .map(([score, count]) => ({ score, count }))
      .sort((left, right) => left.score - right.score),
    platformSummary: [...platformRows.entries()]
      .map(([platform, stats]) => ({
        platform,
        participants: stats.participants,
        averageUsage: stats.usageCount ? stats.usageTotal / stats.usageCount : null,
        averageSleep: stats.sleepCount ? stats.sleepTotal / stats.sleepCount : null,
        averageSleepQuality: stats.qualityCount ? stats.qualityTotal / stats.qualityCount : null,
      }))
      .sort((left, right) => left.platform.localeCompare(right.platform, "es")),
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

function renderEmptyChart(selector, message = "Sin registros para esta selección.") {
  const container = document.querySelector(selector);
  container.classList.remove("donut-chart-layout");
  const messageElement = document.createElement("p");
  messageElement.className = "empty-chart";
  messageElement.textContent = message;
  container.replaceChildren(messageElement);
}

function renderPlatformChart(data) {
  if (data.length === 0) {
    renderEmptyChart("#platform-chart");
    return;
  }
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
  if (data.length === 0) {
    renderEmptyChart("#age-chart");
    return;
  }
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

function renderUsageSleepScatter(data) {
  if (data.length === 0) {
    renderEmptyChart("#scatter-chart");
    return;
  }
  const title = "Uso diario y duración del sueño";
  const svg = createChartSvg(
    document.querySelector("#scatter-chart"),
    title,
    `Diagrama de dispersión de ${integerFormat.format(data.length)} participantes. Eje horizontal: uso diario de redes en horas por día. Eje vertical: duración del sueño en horas por noche.`,
  );
  const left = 58;
  const right = 468;
  const top = 25;
  const bottom = 270;
  const maxUsage = Math.ceil(Math.max(...data.map((point) => point.usage)) / 2) * 2;
  const maxSleep = Math.ceil(Math.max(...data.map((point) => point.sleep)) / 2) * 2;
  const xMax = Math.max(2, maxUsage);
  const yMax = Math.max(2, maxSleep);

  for (let value = 0; value <= xMax; value += 2) {
    const x = left + (value / xMax) * (right - left);
    svg.append(createSvgElement("line", {
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      class: "chart-grid-line",
    }));
    addSvgText(svg, String(value), {
      x,
      y: bottom + 18,
      "text-anchor": "middle",
      class: "chart-tick-label",
    });
  }

  for (let value = 0; value <= yMax; value += 2) {
    const y = bottom - (value / yMax) * (bottom - top);
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
  addSvgText(svg, "Uso de redes (horas/día)", {
    x: (left + right) / 2,
    y: 342,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });
  addSvgText(svg, "Sueño (horas/noche)", {
    x: 16,
    y: (top + bottom) / 2,
    transform: `rotate(-90 16 ${(top + bottom) / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });

  for (const point of data) {
    const circle = createSvgElement("circle", {
      cx: left + (point.usage / xMax) * (right - left),
      cy: bottom - (point.sleep / yMax) * (bottom - top),
      r: 2.2,
      fill: "#168b83",
      "fill-opacity": 0.32,
    });
    const pointTitle = createSvgElement("title");
    pointTitle.textContent =
      `Uso: ${numberFormat.format(point.usage)} horas/día; sueño: ${numberFormat.format(point.sleep)} horas/noche`;
    circle.append(pointTitle);
    svg.append(circle);
  }
}

function renderUsageHistogram(values) {
  if (values.length === 0) {
    renderEmptyChart("#usage-histogram");
    return;
  }
  const title = "Distribución del uso diario";
  const svg = createChartSvg(
    document.querySelector("#usage-histogram"),
    title,
    "Histograma del número de participantes en intervalos de dos horas de uso diario de redes sociales.",
  );
  const binWidth = 2;
  const maxValue = Math.max(binWidth, Math.ceil(Math.max(...values) / binWidth) * binWidth + binWidth);
  const bins = Array.from({ length: maxValue / binWidth }, (_, index) => ({
    start: index * binWidth,
    end: (index + 1) * binWidth,
    count: 0,
  }));
  for (const value of values) {
    const binIndex = Math.min(Math.floor(value / binWidth), bins.length - 1);
    bins[binIndex].count += 1;
  }

  const left = 58;
  const right = 468;
  const top = 25;
  const bottom = 270;
  const maximumCount = Math.max(...bins.map((bin) => bin.count));
  const countStep = Math.max(1, Math.ceil(maximumCount / 4));
  const axisMax = Math.ceil(maximumCount / countStep) * countStep;
  for (let count = 0; count <= axisMax; count += countStep) {
    const y = bottom - (count / axisMax) * (bottom - top);
    svg.append(createSvgElement("line", {
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      class: "chart-grid-line",
    }));
    addSvgText(svg, integerFormat.format(count), {
      x: left - 9,
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
  addSvgText(svg, "Uso de redes (horas/día)", {
    x: (left + right) / 2,
    y: 342,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });
  addSvgText(svg, "Participantes", {
    x: 16,
    y: (top + bottom) / 2,
    transform: `rotate(-90 16 ${(top + bottom) / 2})`,
    "text-anchor": "middle",
    class: "chart-axis-label",
  });

  const slotWidth = (right - left) / bins.length;
  const barWidth = slotWidth - 2;
  for (const [index, bin] of bins.entries()) {
    const barHeight = (bin.count / axisMax) * (bottom - top);
    const bar = createSvgElement("rect", {
      x: left + index * slotWidth + 1,
      y: bottom - barHeight,
      width: barWidth,
      height: barHeight,
      fill: "#168b83",
    });
    const barTitle = createSvgElement("title");
    barTitle.textContent = `${bin.start} a menos de ${bin.end} horas: ${integerFormat.format(bin.count)} participantes`;
    bar.append(barTitle);
    svg.append(bar);
    addSvgText(svg, `${bin.start}–${bin.end}`, {
      x: left + (index + 0.5) * slotWidth,
      y: bottom + 18,
      "text-anchor": "middle",
      class: "chart-tick-label",
    });
  }
}

function renderSleepQualityChart(data) {
  if (data.length === 0) {
    renderEmptyChart("#sleep-quality-chart");
    return;
  }
  const title = "Distribución de calidad del sueño";
  const container = document.querySelector("#sleep-quality-chart");
  container.classList.add("donut-chart-layout");
  const svg = createChartSvg(
    container,
    title,
    "Gráfica de dona con la proporción de participantes para cada puntuación registrada en Sleep_Quality_Score.",
  );
  svg.setAttribute("viewBox", "0 0 320 350");
  const colors = ["#315b78", "#168b83", "#70b9a9", "#e0a84f", "#cb765f"];
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const centerX = 165;
  const centerY = 175;
  const outerRadius = 112;
  const innerRadius = 67;
  let startAngle = -Math.PI / 2;

  function pointAt(radius, angle) {
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  }

  for (const [index, item] of data.entries()) {
    const endAngle = startAngle + (item.count / total) * Math.PI * 2;
    const outerStart = pointAt(outerRadius, startAngle);
    const outerEnd = pointAt(outerRadius, endAngle);
    const innerEnd = pointAt(innerRadius, endAngle);
    const innerStart = pointAt(innerRadius, startAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const segment = createSvgElement("path", {
      d: [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
        "Z",
      ].join(" "),
      fill: colors[index % colors.length],
    });
    const segmentTitle = createSvgElement("title");
    segmentTitle.textContent =
      `Puntuación ${item.score}: ${integerFormat.format(item.count)} participantes (${numberFormat.format((item.count / total) * 100)}%)`;
    segment.append(segmentTitle);
    svg.append(segment);
    startAngle = endAngle;
  }

  addSvgText(svg, integerFormat.format(total), {
    x: centerX,
    y: centerY - 2,
    class: "donut-total",
  });
  addSvgText(svg, "participantes", {
    x: centerX,
    y: centerY + 17,
    class: "donut-caption",
  });

  const legend = document.createElement("ul");
  legend.className = "chart-legend";
  for (const [index, item] of data.entries()) {
    const entry = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = colors[index % colors.length];
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent =
      `Puntuación ${item.score}: ${integerFormat.format(item.count)} (${numberFormat.format((item.count / total) * 100)}%)`;
    entry.append(swatch, label);
    legend.append(entry);
  }
  container.append(legend);
}

function renderPlatformTable(data) {
  const container = document.querySelector("#platform-table");
  if (data.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-table";
    message.textContent = "Sin registros para esta selección.";
    container.replaceChildren(message);
    return;
  }

  const table = document.createElement("table");
  table.className = "data-table";
  const caption = document.createElement("caption");
  caption.className = "sr-only";
  caption.textContent = "Participantes y promedios de uso de redes y sueño por plataforma principal.";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [
    "Plataforma",
    "Participantes",
    "Uso (horas/día)",
    "Sueño (horas/noche)",
    "Calidad (puntos)",
  ];
  for (const text of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    headerRow.append(cell);
  }
  head.append(headerRow);

  const body = document.createElement("tbody");
  for (const item of data) {
    const row = document.createElement("tr");
    const values = [
      item.platform,
      integerFormat.format(item.participants),
      item.averageUsage === null ? "—" : numberFormat.format(item.averageUsage),
      item.averageSleep === null ? "—" : numberFormat.format(item.averageSleep),
      item.averageSleepQuality === null ? "—" : numberFormat.format(item.averageSleepQuality),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, head, body);
  container.replaceChildren(table);
}

function renderMetrics(metrics) {
  document.querySelector("#participant-count").textContent = integerFormat.format(metrics.participants);
  document.querySelector("#average-usage").textContent =
    metrics.averageUsage === null ? "—" : numberFormat.format(metrics.averageUsage);
  document.querySelector("#average-sleep").textContent =
    metrics.averageSleep === null ? "—" : numberFormat.format(metrics.averageSleep);
  document.querySelector("#average-sleep-quality").textContent =
    metrics.averageSleepQuality === null ? "—" : numberFormat.format(metrics.averageSleepQuality);

  const filter = document.querySelector("#academic-level-filter");
  const selectedOption = filter.selectedOptions[0];
  const levelDescription = metrics.selectedLevel === allLevelsValue
    ? "Todos los niveles"
    : selectedOption?.textContent ?? "Nivel académico seleccionado";
  const status = document.querySelector("#kpi-status");
  const filterStatus = document.querySelector("#filter-status");
  if (metrics.matchingRecords === 0) {
    status.dataset.state = "empty";
    status.textContent = "Sin registros para la selección actual. Elige otro nivel o muestra todos los datos.";
    filterStatus.textContent = "La selección actual no contiene registros.";
  } else {
    delete status.dataset.state;
    status.textContent = `${integerFormat.format(metrics.participants)} participantes · ${levelDescription}.`;
    filterStatus.textContent = `${integerFormat.format(metrics.matchingRecords)} registros coincidentes.`;
  }

  renderPlatformChart(metrics.usageByPlatform);
  renderAgeChart(metrics.usageByAge);
  renderUsageSleepScatter(metrics.usageSleepPairs);
  renderUsageHistogram(metrics.usageValues);
  renderSleepQualityChart(metrics.sleepQualityCounts);
  renderPlatformTable(metrics.platformSummary);
}

function populateAcademicLevelFilter(levels, totalRecords) {
  const filter = document.querySelector("#academic-level-filter");
  const allOption = filter.querySelector(`option[value="${allLevelsValue}"]`);
  allOption.textContent = `Todos los niveles (${integerFormat.format(totalRecords)})`;

  for (const level of levels) {
    const option = document.createElement("option");
    option.value = level.value;
    option.textContent = `${level.label} (${integerFormat.format(level.count)})`;
    filter.append(option);
  }

  filter.disabled = false;
  document.querySelector("#reset-filters").disabled = false;
}

function showUpdateError(error) {
  const message = `No se pudieron actualizar los datos: ${error.message}`;
  for (const selector of ["#participant-count", "#average-usage", "#average-sleep", "#average-sleep-quality"]) {
    document.querySelector(selector).textContent = "—";
  }
  const status = document.querySelector("#kpi-status");
  status.dataset.state = "error";
  status.textContent = message;
  document.querySelector("#filter-status").textContent = "No fue posible aplicar el filtro.";
  for (const selector of [
    "#platform-chart",
    "#age-chart",
    "#scatter-chart",
    "#usage-histogram",
    "#sleep-quality-chart",
  ]) {
    renderEmptyChart(selector, "No se pudieron calcular los resultados.");
  }
  const tableMessage = document.createElement("p");
  tableMessage.className = "empty-table";
  tableMessage.textContent = "No se pudo calcular la tabla.";
  document.querySelector("#platform-table").replaceChildren(tableMessage);
}

function updateSelectedLevel() {
  const selectedLevel = document.querySelector("#academic-level-filter").value;
  try {
    renderMetrics(calculateMetrics(sourceCsvText, selectedLevel));
  } catch (error) {
    showUpdateError(error);
  }
}

async function loadMetrics() {
  const status = document.querySelector("#kpi-status");
  try {
    const response = await fetch(sourceFile);
    if (!response.ok) {
      throw new Error(`No se pudo leer el archivo fuente (HTTP ${response.status}).`);
    }
    sourceCsvText = await response.text();
    const metrics = calculateMetrics(sourceCsvText);
    populateAcademicLevelFilter(metrics.academicLevels, metrics.totalRecords);
    document.querySelector("#academic-level-filter").addEventListener("change", updateSelectedLevel);
    document.querySelector("#reset-filters").addEventListener("click", () => {
      const filter = document.querySelector("#academic-level-filter");
      filter.value = allLevelsValue;
      updateSelectedLevel();
    });
    renderMetrics(metrics);
  } catch (error) {
    status.dataset.state = "error";
    status.textContent = `No se pudieron calcular los KPI: ${error.message} Abre el proyecto desde un servidor local y comprueba que el CSV esté en la misma carpeta.`;
    document.querySelector("#filter-status").textContent = "No se pudieron cargar las opciones de filtro.";
  }
}

loadMetrics();
