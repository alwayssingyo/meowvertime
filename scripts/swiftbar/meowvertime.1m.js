#!/usr/bin/env node
/*
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
*/

const MINUTES_IN_DAY = 24 * 60;
const BREAK_MINUTES_FIXED = 60; // 12:30~13:30
const BREAK_START_MINUTES = 12 * 60 + 30;
const BREAK_END_MINUTES = BREAK_START_MINUTES + BREAK_MINUTES_FIXED;
const DAILY_BASE_MINUTES = 8 * 60;
const DAILY_RECOGNIZED_MAX_MINUTES = 9 * 60;
const WEEKLY_TARGET_MINUTES = 40 * 60;

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];
const WEEKDAY_EDIT_ACTIONS = [
  "edit-mon",
  "edit-tue",
  "edit-wed",
  "edit-thu",
  "edit-fri",
];
const HOLIDAY_INPUT_TOKENS = new Set(["H", "HOL", "HOLIDAY", "공휴일"]);

const BLACK_COLOR = "#000000";
const OVERTIME_DAY_COLOR = "#B00020";

const normalizeText = (value) => String(value ?? "").trim();

const parseTimeToMinutes = (timeText) => {
  const [hoursText, minutesText] = String(timeText ?? "").split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const formatClockTime = (totalMinutes) => {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizeTimeText = (value) => {
  const minutes = parseTimeToMinutes(value);
  return minutes === null ? null : formatClockTime(minutes);
};

const getMinutesBetween = (startMinutes, endMinutes) => {
  const diff = endMinutes - startMinutes;
  return diff >= 0 ? diff : diff + MINUTES_IN_DAY;
};

const getRangeOverlapMinutes = (startA, endA, startB, endB) => {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return Math.max(0, end - start);
};

const getBreakOverlapMinutes = (startMinutes, endMinutes) => {
  if (endMinutes >= startMinutes) {
    return getRangeOverlapMinutes(
      startMinutes,
      endMinutes,
      BREAK_START_MINUTES,
      BREAK_END_MINUTES,
    );
  }

  return (
    getRangeOverlapMinutes(
      startMinutes,
      MINUTES_IN_DAY,
      BREAK_START_MINUTES,
      BREAK_END_MINUTES,
    ) +
    getRangeOverlapMinutes(0, endMinutes, BREAK_START_MINUTES, BREAK_END_MINUTES)
  );
};

const getNetMinutesWithBreak = (startMinutes, endMinutes) => {
  const grossMinutes = getMinutesBetween(startMinutes, endMinutes);
  const breakMinutes = getBreakOverlapMinutes(startMinutes, endMinutes);
  return Math.max(0, grossMinutes - breakMinutes);
};

const formatDuration = (totalMinutes) => {
  const absolute = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
};

const buildProgressBar = (value, max, slots = 10) => {
  if (max <= 0) {
    return "▰".repeat(slots);
  }

  const ratio = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(ratio * slots);
  return `${"▰".repeat(filled)}${"▱".repeat(slots - filled)}`;
};

const getBalanceColor = (netMinutes) => {
  if (netMinutes > DAILY_BASE_MINUTES) {
    return OVERTIME_DAY_COLOR;
  }
  return BLACK_COLOR;
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

const fromDateKey = (dateKey) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateKey.split("-");
  const date = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
  );
  date.setHours(0, 0, 0, 0);
  return date;
};

const getMondayOfWeek = (baseDate) => {
  const monday = new Date(baseDate);
  monday.setHours(0, 0, 0, 0);
  const dayIndex = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dayIndex);
  return monday;
};

const getWeekdayDateKeys = (mondayDate) => {
  const keys = [];
  for (let i = 0; i < 5; i += 1) {
    const date = new Date(mondayDate);
    date.setDate(mondayDate.getDate() + i);
    keys.push(toDateKey(date));
  }
  return keys;
};

const formatDayLabel = (dateKey, weekdayIndex) => {
  const date = fromDateKey(dateKey);
  if (!date) {
    return WEEKDAY_LABELS[weekdayIndex];
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${WEEKDAY_LABELS[weekdayIndex]} ${month}/${day}`;
};

const nowLocalTimeText = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const parseSimpleEnvFile = (content) => {
  const parsed = {};
  for (const rawLine of String(content ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
};

const getFs = async () => {
  const fsModule = await import("node:fs/promises");
  return fsModule.default ?? fsModule;
};

const getChildProcess = async () => import("node:child_process");

const readFileTextIfExists = async (filePath) => {
  if (!filePath) {
    return null;
  }

  try {
    const fs = await getFs();
    return await fs.readFile(filePath, "utf8");
  } catch (_error) {
    return null;
  }
};

const getScriptPath = () => normalizeText(process.argv[1]);

const getScriptDir = () => {
  const scriptPath = getScriptPath();
  if (!scriptPath || !scriptPath.includes("/")) {
    return process.cwd();
  }
  return scriptPath.slice(0, scriptPath.lastIndexOf("/"));
};

const getEnvCandidates = () => {
  const explicit = normalizeText(process.env.MEOW_ENV_FILE);
  const scriptEnv = `${getScriptDir()}/.env.swiftbar`;
  const cwdEnv = `${process.cwd()}/.env.swiftbar`;

  if (explicit) {
    return [explicit, scriptEnv, cwdEnv];
  }
  return [scriptEnv, cwdEnv];
};

const loadEnvFile = async () => {
  const candidates = getEnvCandidates();
  const visited = new Set();

  for (const candidate of candidates) {
    if (!candidate || visited.has(candidate)) {
      continue;
    }
    visited.add(candidate);

    const text = await readFileTextIfExists(candidate);
    if (!text) {
      continue;
    }

    const parsed = parseSimpleEnvFile(text);
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    if (!normalizeText(process.env.MEOW_ENV_FILE)) {
      process.env.MEOW_ENV_FILE = candidate;
    }
  }
};

const getStateFilePath = () => {
  const explicit = normalizeText(process.env.MEOW_STATE_FILE);
  if (explicit) {
    return explicit;
  }
  return `${getScriptDir()}/.meowvertime-state.json`;
};

const loadState = async () => {
  const stateFile = getStateFilePath();
  const text = await readFileTextIfExists(stateFile);
  if (!text) {
    return { days: {} };
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { days: {} };
    }

    const days = parsed.days;
    if (!days || typeof days !== "object" || Array.isArray(days)) {
      return { days: {} };
    }

    return { days: { ...days } };
  } catch (_error) {
    return { days: {} };
  }
};

const saveState = async (state) => {
  const fs = await getFs();
  const stateFile = getStateFilePath();
  await fs.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const sanitizeRecord = (record) => {
  if (!record || typeof record !== "object") {
    return {};
  }

  const next = {};
  if (record.holiday === true) {
    next.holiday = true;
    return next;
  }

  const startTime = normalizeTimeText(record.startTime);
  const endTime = normalizeTimeText(record.endTime);
  if (startTime) {
    next.startTime = startTime;
  }
  if (endTime) {
    next.endTime = endTime;
  }
  return next;
};

const getRecord = (state, dateKey) => sanitizeRecord(state.days?.[dateKey]);

const setRecord = (state, dateKey, nextRecord) => {
  const sanitized = sanitizeRecord(nextRecord);
  if (Object.keys(sanitized).length === 0) {
    delete state.days[dateKey];
    return;
  }
  state.days[dateKey] = sanitized;
};

const clearRecord = (state, dateKey) => {
  delete state.days[dateKey];
};

const getHolidaySetFromEnv = () => {
  const raw = normalizeText(process.env.MEOW_HOLIDAYS);
  if (!raw) {
    return new Set();
  }

  const set = new Set();
  for (const token of raw.split(",")) {
    const candidate = normalizeText(token);
    if (isDateKey(candidate)) {
      set.add(candidate);
    }
  }
  return set;
};

// 일별 계산 핵심 로직:
// - 점심시간(12:30~13:30)과 실제 근무구간이 겹치는 만큼 차감
// - 공휴일(자동/수동) 처리
// - 인정근무 9h 상한 및 초과분 추적
const evaluateDay = ({ record, dateKey, todayKey, nowMinutes, holidaySet }) => {
  const startMinutes = parseTimeToMinutes(record.startTime);
  const endMinutes = parseTimeToMinutes(record.endTime);
  const hasStart = startMinutes !== null;
  const hasEnd = endMinutes !== null;
  const isToday = dateKey === todayKey;
  const isInProgress = hasStart && !hasEnd && isToday;

  const isManualHoliday = record.holiday === true;
  const isAutoHoliday =
    holidaySet.has(dateKey) && !isManualHoliday && !hasStart && !hasEnd;
  const isHoliday = isManualHoliday || isAutoHoliday;

  if (isHoliday) {
    return {
      dateKey,
      startTimeText: "",
      endTimeText: "",
      hasStart: false,
      hasEnd: false,
      isToday,
      isInProgress: false,
      isHoliday: true,
      isManualHoliday,
      breakMinutes: BREAK_MINUTES_FIXED,
      netCompleteMinutes: DAILY_BASE_MINUTES,
      netLiveMinutes: DAILY_BASE_MINUTES,
      creditedCompleteMinutes: DAILY_BASE_MINUTES,
      creditedLiveMinutes: DAILY_BASE_MINUTES,
      capLossCompleteMinutes: 0,
      capLossLiveMinutes: 0,
      startMinutes: null,
    };
  }

  const netCompleteMinutes =
    hasStart && hasEnd
      ? getNetMinutesWithBreak(startMinutes, endMinutes)
      : 0;
  const creditedCompleteMinutes = Math.min(
    netCompleteMinutes,
    DAILY_RECOGNIZED_MAX_MINUTES,
  );
  const capLossCompleteMinutes = Math.max(
    0,
    netCompleteMinutes - DAILY_RECOGNIZED_MAX_MINUTES,
  );

  const netLiveMinutes = isInProgress
    ? getNetMinutesWithBreak(startMinutes, nowMinutes)
    : netCompleteMinutes;
  const creditedLiveMinutes = Math.min(
    netLiveMinutes,
    DAILY_RECOGNIZED_MAX_MINUTES,
  );
  const capLossLiveMinutes = Math.max(
    0,
    netLiveMinutes - DAILY_RECOGNIZED_MAX_MINUTES,
  );

  return {
    dateKey,
    startTimeText: hasStart ? formatClockTime(startMinutes) : "",
    endTimeText: hasEnd ? formatClockTime(endMinutes) : "",
    hasStart,
    hasEnd,
    isToday,
    isInProgress,
    isHoliday: false,
    isManualHoliday: false,
    breakMinutes: BREAK_MINUTES_FIXED,
    netCompleteMinutes,
    netLiveMinutes,
    creditedCompleteMinutes,
    creditedLiveMinutes,
    capLossCompleteMinutes,
    capLossLiveMinutes,
    startMinutes,
  };
};

const getDayCurrentCredit = (metric) =>
  metric.isInProgress
    ? metric.creditedLiveMinutes
    : metric.creditedCompleteMinutes;

const getDayCurrentNet = (metric) =>
  metric.isInProgress ? metric.netLiveMinutes : metric.netCompleteMinutes;

const getDayLine = (metric, index) => {
  const label = formatDayLabel(metric.dateKey, index);
  if (metric.isHoliday) {
    return {
      text: `${label} 8h 00m`,
      color: BLACK_COLOR,
    };
  }

  if (!metric.hasStart) {
    return {
      text: `${label} 미입력`,
      color: BLACK_COLOR,
    };
  }

  if (metric.hasStart && !metric.hasEnd && !metric.isInProgress) {
    return {
      text: `${label} ${metric.startTimeText}-퇴근미입력`,
      color: BLACK_COLOR,
    };
  }

  const netMinutes = getDayCurrentNet(metric);
  const color = getBalanceColor(netMinutes);

  let detail = `${label} ${formatDuration(netMinutes)}`;
  if (netMinutes > DAILY_BASE_MINUTES) {
    detail += " 🔥";
  }

  return { text: detail, color };
};

const shellSingleQuote = (value) => {
  const raw = String(value ?? "");
  return `'${raw.replaceAll("'", "'\\''")}'`;
};

const runAppleScriptPrompt = async (title, message, defaultValue) => {
  const { spawnSync } = await getChildProcess();
  const safe = (value) =>
    String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const script = [
    `set response to display dialog "${safe(message)}" with title "${safe(
      title,
    )}" default answer "${safe(defaultValue)}" buttons {"Cancel", "Save"} default button "Save"`,
    "text returned of response",
  ].join("\n");

  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return String(result.stdout ?? "").trim();
};

const readClipboardText = async () => {
  const { spawnSync } = await getChildProcess();
  const result = spawnSync("pbpaste", [], { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return String(result.stdout ?? "");
};

const notify = async (title, message) => {
  const { spawnSync } = await getChildProcess();
  const safe = (value) =>
    String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  spawnSync(
    "osascript",
    [
      "-e",
      `display notification "${safe(message)}" with title "${safe(title)}"`,
    ],
    { encoding: "utf8" },
  );
};

const buildWeekInputDefault = (dayMetrics) => {
  return dayMetrics
    .map((metric) => {
      if (metric.isHoliday) {
        return "H";
      }
      if (!metric.hasStart) {
        return "-";
      }
      if (metric.hasStart && !metric.hasEnd) {
        return `${metric.startTimeText}-`;
      }
      return `${metric.startTimeText}-${metric.endTimeText}`;
    })
    .join(", ");
};

const isHolidayInputToken = (value) =>
  HOLIDAY_INPUT_TOKENS.has(String(value ?? "").toUpperCase());

const extractMeridiemTimeTokens = (text) => {
  const tokens = [];
  const pattern = /(오전|오후)\s*([0-1]?\d):([0-5]\d)/g;
  for (const match of String(text ?? "").matchAll(pattern)) {
    let hour = Number(match[2]);
    const minutes = match[3];

    if (match[1] === "오전") {
      if (hour === 12) {
        hour = 0;
      }
    } else if (hour < 12) {
      hour += 12;
    }

    tokens.push(`${String(hour).padStart(2, "0")}:${minutes}`);
  }
  return tokens;
};

const uniqueOrdered = (items) => {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      unique.push(item);
    }
  }
  return unique;
};

const parseDayValueFromSection = (section) => {
  if (!section) {
    return "";
  }

  if (/(공휴일|HOLIDAY)/i.test(section)) {
    return "H";
  }

  const times = uniqueOrdered(extractMeridiemTimeTokens(section));
  if (times.length >= 2) {
    return `${times[0]}-${times[times.length - 1]}`;
  }
  if (times.length === 1) {
    return `${times[0]}-`;
  }
  return "";
};

const getSectionsByTextHeuristic = (html) => {
  const sections = [
    ...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/gi),
  ].map((match) => match[0]);

  if (sections.length < 5) {
    return [];
  }

  const candidates = sections.map((section) => {
    const times = uniqueOrdered(extractMeridiemTimeTokens(section));
    const containsRest = /휴게/.test(section);
    const containsAmPm = /오전|오후/.test(section);
    return { section, times, containsRest, containsAmPm };
  });

  let bestStart = -1;
  let bestScore = -1e9;

  for (let start = 0; start <= candidates.length - 5; start += 1) {
    const slice = candidates.slice(start, start + 5);
    const timeCounts = slice.map((item) => item.times.length);
    const daysWithAnyTime = timeCounts.filter((count) => count > 0).length;
    const daysWithTwoOrMore = timeCounts.filter((count) => count >= 2).length;

    if (daysWithAnyTime < 4) {
      continue;
    }

    let score = 0;
    score += daysWithAnyTime * 100;
    score += daysWithTwoOrMore * 60;

    for (const item of slice) {
      const count = item.times.length;
      if (count === 0) {
        score -= 40;
      } else if (count <= 3) {
        score += count * 20;
      } else {
        score -= (count - 3) * 30;
      }
      if (item.containsRest) {
        score += 5;
      }
      if (item.containsAmPm) {
        score += 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  if (bestStart < 0) {
    return [];
  }

  return candidates
    .slice(bestStart, bestStart + 5)
    .map((candidate) => candidate.section);
};

const parseFlexHtmlImportText = (htmlText, weekDateKeys) => {
  const html = String(htmlText ?? "");
  const sections = getSectionsByTextHeuristic(html);

  if (sections.length < 5) {
    return { error: "Flex 주간 HTML 섹션을 찾지 못했어요." };
  }

  const updates = [];
  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const section = sections[dayIndex] ?? "";
    if (!section) {
      continue;
    }

    const dayLabel = WEEKDAY_LABELS[dayIndex];
    const dateKey = weekDateKeys[dayIndex];
    let dayValue = "";

    dayValue = parseDayValueFromSection(section);

    if (!dayValue) {
      continue;
    }

    const parsed = parseDayInputValue(dayValue, dayLabel, dateKey);
    if (!parsed.error) {
      updates.push(parsed.update);
    }
  }

  if (updates.length === 0) {
    return {
      error:
        "Flex HTML에서 월~금 출퇴근 정보를 찾지 못했어요. 타임라인 영역의 outerHTML을 복사해서 다시 시도해 주세요.",
    };
  }

  return { updates };
};

const parseWeekInputText = (text, weekDateKeys) => {
  const raw = normalizeText(text);
  if (!raw) {
    return { error: "입력값이 비어 있어요." };
  }

  const tokens = raw
    .split(",")
    .map((chunk) => normalizeText(chunk))
    .filter((chunk) => chunk !== "");
  const updates = [];

  if (tokens.length !== 5) {
    return { error: "주간 한줄 입력은 5개(월~금) 값을 콤마로 입력해 주세요." };
  }

  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const dayLabel = WEEKDAY_LABELS[dayIndex];
    const dateKey = weekDateKeys[dayIndex];
    const parsed = parseDayInputValue(tokens[dayIndex], dayLabel, dateKey);
    if (parsed.error) {
      return { error: parsed.error };
    }
    updates.push(parsed.update);
  }

  if (updates.length === 0) {
    return { error: "변경할 항목이 없어요." };
  }

  return { updates };
};

const parseClipboardImportText = (text, weekDateKeys) => {
  const normalized = normalizeText(String(text ?? "").replace(/\r/g, "\n"));
  if (!normalized) {
    return { error: "클립보드가 비어 있어요." };
  }

  const isLikelyHtml =
    normalized.includes("<") &&
    normalized.includes(">") &&
    /<\/?[a-z][\s\S]*>/i.test(normalized);
  if (!isLikelyHtml) {
    return {
      error:
        "클립보드 import는 HTML만 지원해요. Flex 타임라인 영역에서 Copy outerHTML 후 다시 시도해 주세요.",
    };
  }

  return parseFlexHtmlImportText(normalized, weekDateKeys);
};

const parseDayInputValue = (value, dayLabel, dateKey) => {
  const normalized = normalizeText(value);
  if (normalized === "" || normalized === "-") {
    return { update: { dateKey, type: "clear" } };
  }

  if (isHolidayInputToken(normalized)) {
    return { update: { dateKey, type: "holiday" } };
  }

  const timeRange = normalized.match(
    /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})?$/,
  );
  if (!timeRange) {
    return {
      error: `${dayLabel} 입력 형식 오류 (예: 09:00-18:00 / 09:00- / H / -)`,
    };
  }

  const startTime = normalizeTimeText(timeRange[1]);
  const endTime = timeRange[2] ? normalizeTimeText(timeRange[2]) : "";
  if (!startTime || (timeRange[2] && !endTime)) {
    return { error: `${dayLabel} 시간 형식 오류 (HH:MM)` };
  }

  return {
    update: {
      dateKey,
      type: "time",
      startTime,
      endTime,
    },
  };
};

const promptDayInput = async ({ dayLabel, dateKey, metric }) => {
  const defaultValue = metric.isHoliday
    ? "H"
    : !metric.hasStart
      ? "-"
      : `${metric.startTimeText}-${metric.hasEnd ? metric.endTimeText : ""}`;

  const message = [
    `${dayLabel} 입력`,
    "형식: 09:00-18:00 / 09:00- / H / -",
    "H=공휴일(자동 8h), -=미입력",
  ].join("\n");

  const input = await runAppleScriptPrompt(
    "Meowvertime",
    message,
    defaultValue,
  );
  if (input === null) {
    return { canceled: true };
  }

  return parseDayInputValue(input, dayLabel, dateKey);
};

const applyWeekUpdates = (state, updates) => {
  for (const update of updates) {
    if (update.type === "clear") {
      clearRecord(state, update.dateKey);
      continue;
    }

    if (update.type === "holiday") {
      setRecord(state, update.dateKey, { holiday: true });
      continue;
    }

    if (update.type === "time") {
      setRecord(state, update.dateKey, {
        holiday: false,
        startTime: update.startTime,
        endTime: update.endTime,
      });
    }
  }
};

const runActionIfNeeded = async ({ action, weekDateKeys, dayMetrics }) => {
  if (!action) {
    return false;
  }

  const state = await loadState();
  const dayActionEntries = [
    { action: "edit-mon", dayIndex: 0, label: "월" },
    { action: "edit-tue", dayIndex: 1, label: "화" },
    { action: "edit-wed", dayIndex: 2, label: "수" },
    { action: "edit-thu", dayIndex: 3, label: "목" },
    { action: "edit-fri", dayIndex: 4, label: "금" },
  ];

  if (action === "edit-week") {
    const defaultText = buildWeekInputDefault(dayMetrics);
    const message = [
      "주간 입력 (쉼표로 구분)",
      "예: 09:00-18:00, 09:00-19:00, H, -, 09:00-",
      "H=공휴일(자동 8h), -=미입력",
    ].join("\n");
    const input = await runAppleScriptPrompt(
      "Meowvertime",
      message,
      defaultText,
    );
    if (input === null) {
      return true;
    }

    const parsed = parseWeekInputText(input, weekDateKeys);
    if (parsed.error) {
      await notify("Meowvertime", parsed.error);
      return true;
    }

    applyWeekUpdates(state, parsed.updates);
    await saveState(state);
    return true;
  }

  if (action === "import-clipboard") {
    const clipboardText = await readClipboardText();
    if (clipboardText === null) {
      await notify("Meowvertime", "클립보드를 읽지 못했어요.");
      return true;
    }

    const parsed = parseClipboardImportText(clipboardText, weekDateKeys);
    if (parsed.error) {
      await notify("Meowvertime", parsed.error);
      return true;
    }

    applyWeekUpdates(state, parsed.updates);
    await saveState(state);
    await notify(
      "Meowvertime",
      `클립보드 기록 ${parsed.updates.length}일치를 반영했어요.`,
    );
    return true;
  }

  const dayAction = dayActionEntries.find((entry) => entry.action === action);
  if (dayAction) {
    const dateKey = weekDateKeys[dayAction.dayIndex];
    const metric = dayMetrics[dayAction.dayIndex];
    const parsed = await promptDayInput({
      dayLabel: dayAction.label,
      dateKey,
      metric,
    });
    if (parsed.canceled) {
      return true;
    }
    if (parsed.error) {
      await notify("Meowvertime", parsed.error);
      return true;
    }

    applyWeekUpdates(state, [parsed.update]);
    await saveState(state);
    return true;
  }

  if (action === "reset-week") {
    for (const dateKey of weekDateKeys) {
      clearRecord(state, dateKey);
    }
    await saveState(state);
    return true;
  }

  return false;
};

const renderMenu = ({
  weekDateKeys,
  dayMetrics,
  creditsLiveMinutes,
  remainingLiveMinutes,
  overLiveMinutes,
  totalBankedLiveMinutes,
  totalCapLossLiveMinutes,
  fridayNeedMinutes,
  fridayEarlyLeaveMinutes,
  fridayExtraMinutes,
  fridayCanFinish,
  fridayPredictedLeave,
  fridayHolidayAuto,
  scriptPath,
}) => {
  const progressPercent = Math.max(
    0,
    Math.round((creditsLiveMinutes / WEEKLY_TARGET_MINUTES) * 100),
  );
  const headline =
    remainingLiveMinutes > 0
      ? `💗 ${formatDuration(remainingLiveMinutes)}`
      : `😼 +${formatDuration(overLiveMinutes)}`;
  const activeLineSuffix = "refresh=true";
  const scriptRef = shellSingleQuote(scriptPath || "meowvertime.1m.js");

  console.log(`${headline} | dropdown=false`);
  console.log("---");
  console.log(
    `🐱 Meowvertime Week | color=#ff7aa2 size=13 ${activeLineSuffix}`,
  );
  console.log(
    `${weekDateKeys[0]} ~ ${weekDateKeys[4]} | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  console.log(
    `🐾 진행률 ${buildProgressBar(creditsLiveMinutes, WEEKLY_TARGET_MINUTES)} ${progressPercent}% | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  console.log(
    `🐟 인정 누적 ${formatDuration(creditsLiveMinutes)} / ${formatDuration(WEEKLY_TARGET_MINUTES)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  console.log(
    remainingLiveMinutes > 0
      ? `🧶 주간 잔여 ${formatDuration(remainingLiveMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`
      : `😾 주간 초과 ${formatDuration(overLiveMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  console.log(
    `🍼 쌓은 시간 ${formatDuration(totalBankedLiveMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  if (totalCapLossLiveMinutes > 0) {
    console.log(
      `🙀 9h 초과 미반영 ${formatDuration(totalCapLossLiveMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  }

  console.log("---");
  console.log(`🍭 이번주 근무시간 | color=${BLACK_COLOR} ${activeLineSuffix}`);
  dayMetrics.forEach((metric, index) => {
    const line = getDayLine(metric, index);
    const dayAction = WEEKDAY_EDIT_ACTIONS[index];
    console.log(
      `${line.text} | color=${line.color} bash=${scriptRef} param1=${dayAction} terminal=false ${activeLineSuffix}`,
    );
  });

  console.log("---");
  console.log(`🏠 금요일 예상 | color=${BLACK_COLOR} ${activeLineSuffix}`);
  console.log(
    `금요일 필요 인정근무: ${formatDuration(fridayNeedMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
  );
  if (!fridayCanFinish) {
    console.log(
      `⚠️ 금요일만으로 충족 불가 (일 최대 인정 9h) | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  } else if (fridayHolidayAuto) {
    console.log(
      `🎌 금요일 공휴일 자동 8h 적용 | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  } else if (fridayNeedMinutes <= DAILY_BASE_MINUTES) {
    console.log(
      `😺 금요일 조기퇴근 가능 ${formatDuration(fridayEarlyLeaveMinutes)} | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  } else {
    console.log(
      `💼 금요일 8h + 추가 ${formatDuration(fridayExtraMinutes)} 필요 | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  }
  if (fridayPredictedLeave) {
    console.log(
      `🏁 금요일 예상 퇴근 ${fridayPredictedLeave} | color=${BLACK_COLOR} ${activeLineSuffix}`,
    );
  }

  console.log("---");
  console.log(
    `📝 주간 한줄 입력(빠른 편집) | bash=${scriptRef} param1=edit-week terminal=false refresh=true`,
  );
  console.log(
    `📥 Flex 화면 붙여넣기 import | bash=${scriptRef} param1=import-clipboard terminal=false refresh=true`,
  );
  console.log(
    `🧼 이번주 전체 기록 지우기 | bash=${scriptRef} param1=reset-week terminal=false refresh=true`,
  );
  console.log("🔄 새로고침 | refresh=true");
};

const main = async () => {
  await loadEnvFile();

  const now = new Date();
  const todayKey = toDateKey(now);
  const weekDateKeys = getWeekdayDateKeys(getMondayOfWeek(now));
  const holidaySet = getHolidaySetFromEnv();
  const nowMinutes = parseTimeToMinutes(nowLocalTimeText()) ?? 0;

  const state = await loadState();
  const dayMetrics = weekDateKeys.map((dateKey) =>
    evaluateDay({
      record: getRecord(state, dateKey),
      dateKey,
      todayKey,
      nowMinutes,
      holidaySet,
    }),
  );

  const action = normalizeText(process.argv[2]);
  const handled = await runActionIfNeeded({
    action,
    weekDateKeys,
    dayMetrics,
  });
  if (handled) {
    return;
  }

  let creditsLiveMinutes = 0;
  let totalBankedLiveMinutes = 0;
  let totalCapLossLiveMinutes = 0;
  for (const metric of dayMetrics) {
    const credited = getDayCurrentCredit(metric);
    creditsLiveMinutes += credited;
    totalBankedLiveMinutes += Math.max(0, credited - DAILY_BASE_MINUTES);
    totalCapLossLiveMinutes += metric.isInProgress
      ? metric.capLossLiveMinutes
      : metric.capLossCompleteMinutes;
  }

  const remainingLiveMinutes = Math.max(
    0,
    WEEKLY_TARGET_MINUTES - creditsLiveMinutes,
  );
  const overLiveMinutes = Math.max(
    0,
    creditsLiveMinutes - WEEKLY_TARGET_MINUTES,
  );

  let creditsBeforeFridayMinutes = 0;
  for (let i = 0; i < 4; i += 1) {
    creditsBeforeFridayMinutes += getDayCurrentCredit(dayMetrics[i]);
  }

  const fridayNeedMinutes = Math.max(
    0,
    WEEKLY_TARGET_MINUTES - creditsBeforeFridayMinutes,
  );
  const fridayEarlyLeaveMinutes = Math.max(
    0,
    DAILY_BASE_MINUTES - fridayNeedMinutes,
  );
  const fridayExtraMinutes = Math.max(
    0,
    fridayNeedMinutes - DAILY_BASE_MINUTES,
  );
  const fridayCanFinish = fridayNeedMinutes <= DAILY_RECOGNIZED_MAX_MINUTES;

  const fridayMetric = dayMetrics[4];
  const fridayHolidayAuto = fridayMetric.isHoliday;

  let fridayPredictedLeave = "";
  if (
    fridayCanFinish &&
    !fridayMetric.isHoliday &&
    fridayMetric.hasStart &&
    !fridayMetric.hasEnd
  ) {
    fridayPredictedLeave = formatClockTime(
      fridayMetric.startMinutes + BREAK_MINUTES_FIXED + fridayNeedMinutes,
    );
  }

  renderMenu({
    weekDateKeys,
    dayMetrics,
    creditsLiveMinutes,
    remainingLiveMinutes,
    overLiveMinutes,
    totalBankedLiveMinutes,
    totalCapLossLiveMinutes,
    fridayNeedMinutes,
    fridayEarlyLeaveMinutes,
    fridayExtraMinutes,
    fridayCanFinish,
    fridayPredictedLeave,
    fridayHolidayAuto,
    scriptPath: getScriptPath(),
  });
};

main().catch((error) => {
  console.log("Plugin error");
  console.log("---");
  console.log(error instanceof Error ? error.message : String(error));
});
