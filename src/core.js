const { t, locale, language } = require("./i18n");
const CURRENCIES = [
  "RUB",
  "USD",
  "EUR",
  "GBP",
  "CNY",
  "KZT",
  "GEL",
  "TRY",
  "AED",
  "UAH",
  "JPY",
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateOK = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const add = (s, n) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const time = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hours = (m, lang = language()) =>
  `${(m / 60).toLocaleString(locale(lang), { maximumFractionDigits: 2 })} ${t("hour", lang)}`;
const currency = (data) => data.currency ?? "RUB";
const money = (n, code = "RUB", lang = language()) =>
  new Intl.NumberFormat(locale(lang), {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
  }).format(n);
const rate = (data) => data.hourlyRate ?? 0;
const values = (data, lang = language()) => ({
  Time: hours(total(data.events, data.start, data.end), lang),
  Cost: money(
    (total(data.events, data.start, data.end) / 60) * rate(data),
    currency(data),
    lang,
  ),
  Rate: money(rate(data), currency(data), lang) + "/" + t("hour", lang),
});
function total(events, start, end) {
  let sum = 0;
  for (const date of new Set(
    events.filter((e) => e.date >= start && e.date <= end).map((e) => e.date),
  )) {
    let right = -1;
    for (const e of events
      .filter((e) => e.date === date)
      .sort((a, b) => a.start - b.start)) {
      sum += Math.max(0, e.end - Math.max(right, e.start));
      right = Math.max(right, e.end);
    }
  }
  return sum;
}
function config(raw = {}) {
  return {
    start: dateOK(raw.start) ? raw.start : today(),
    end: dateOK(raw.end) ? raw.end : add(today(), 13),
    days: raw.days === 7 ? 7 : 14,
  };
}
function validate(data) {
  if (
    !data ||
    typeof data.id !== "string" ||
    !data.id.trim() ||
    data.version !== 1 ||
    !dateOK(data.start) ||
    !dateOK(data.end) ||
    ![7, 14].includes(data.days) ||
    !Array.isArray(data.events)
  )
    throw Error(t("message26"));
  for (const key of ["title", "description"])
    if (data[key] !== undefined && typeof data[key] !== "string")
      throw Error(t("message27"));
  if (
    data.hourlyRate !== undefined &&
    (typeof data.hourlyRate !== "number" ||
      !Number.isFinite(data.hourlyRate) ||
      data.hourlyRate < 0)
  )
    throw Error(t("message28"));
  if (
    data.currency !== undefined &&
    (!/^[A-Z]{3}$/.test(data.currency) || typeof data.currency !== "string")
  )
    throw Error(t("invalidCurrency"));
  const ids = new Set();
  for (const e of data.events) {
    for (const key of ["title", "description"])
      if (e[key] !== undefined && typeof e[key] !== "string")
        throw Error(t("message29"));
    if (
      typeof e.id !== "string" ||
      ids.has(e.id) ||
      !dateOK(e.date) ||
      !Number.isInteger(e.start) ||
      !Number.isInteger(e.end) ||
      e.start < 0 ||
      e.end > 1440 ||
      e.start >= e.end
    )
      throw Error(t("message30"));
    ids.add(e.id);
  }
  return data;
}
// Scan complete fences, so an example nested inside a larger fence is not a target.
function locate(text, id) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  let offset = 0,
    open = null,
    matches = [];
  for (const line of lines) {
    const clean = line.replace(/\r?\n$/, "");
    if (!open) {
      const m = clean.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (m)
        open = {
          char: m[1][0],
          size: m[1].length,
          target: m[2].trim() === "worklogger",
          bodyStart: offset + line.length,
        };
    } else {
      const close = clean.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === open.char && close[1].length >= open.size) {
        if (open.target) {
          let data;
          try {
            data = JSON.parse(text.slice(open.bodyStart, offset));
          } catch (e) {
            throw Error(t("message31"));
          }
          if (id === undefined || data.id === id)
            matches.push({
              start: open.bodyStart,
              end: offset,
              data: validate(data),
            });
        }
        open = null;
      }
    }
    offset += line.length;
  }
  if (matches.length !== 1)
    throw Error(matches.length ? t("message32") : t("message33"));
  return matches[0];
}

module.exports = {
  today,
  dateOK,
  add,
  time,
  hours,
  money,
  rate,
  currency,
  values,
  total,
  config,
  validate,
  locate,
  CURRENCIES,
};
