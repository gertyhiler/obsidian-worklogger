const {
  Plugin,
  MarkdownRenderChild,
  Modal,
  Notice,
  MarkdownView,
  setIcon,
  PluginSettingTab,
  Setting,
  getLanguage,
} = require("obsidian");
const {
  today,
  dateOK,
  add,
  time,
  hours,
  rate,
  currency,
  values,
  config,
  validate,
  locate,
  CURRENCIES,
} = require("./core");
const { t, locale, setLanguage } = require("./i18n");
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  e.className = cls || "";
  if (text !== undefined) e.textContent = text;
  if (parent) parent.append(e);
  return e;
}
function button(parent, text, fn) {
  const b = el("button", "", parent, text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
class Calendar extends MarkdownRenderChild {
  constructor(container, p, c, only = false) {
    super(container);
    this.p = p;
    this.c = config(c);
    this.only = only;
  }
  onload() {
    this.p.calendars.add(this);
    this.render();
  }
  onunload() {
    this.resizeObserver?.disconnect();
    this.cancel?.();
    this.p.calendars.delete(this);
    this.resizeObserver?.disconnect();
  }
  render() {
    this.cancel?.();
    const root = this.containerEl;
    root.replaceChildren();
    root.classList.add("worklogger");
    if (this.p.error) el("div", "worklogger-error", root, this.p.error);
    if (!this.p.data) {
      el("p", "", root, t("message0"));
      return;
    }
    if (this.p.data.title)
      el("h3", "worklogger-title", root, this.p.data.title);
    if (this.p.data.description)
      el("p", "worklogger-description", root, this.p.data.description);
    const top = el("div", "worklogger-top", root),
      period = el("div", "worklogger-period", top);
    for (const key of ["start", "end"]) {
      if (key === "end") el("span", "worklogger-symbol", period, "—");
      const input = el("input", "", period);
      input.type = "date";
      input.value = this.c[key];
      input.setAttribute(
        "aria-label",
        key === "start" ? t("message1") : t("message2"),
      );
      input.onchange = () => {
        if (dateOK(input.value)) this.p.settings({ [key]: input.value });
      };
    }
    const switcher = el("div", "worklogger-switch", top);
    switcher.setAttribute("aria-label", t("message3"));
    for (const days of [7, 14]) {
      const b = button(switcher, `${days} ${t("days")}`, () =>
        this.p.settings({ days }),
      );
      b.classList.toggle("is-active", this.c.days === days);
      b.setAttribute("aria-pressed", String(this.c.days === days));
    }
    const billing = el("div", "worklogger-equation", root);
    el("strong", "worklogger-total", billing, values(this.p.data).Time);
    el("span", "worklogger-symbol", billing, "×");
    const rateInput = el("input", "worklogger-rate", billing);
    rateInput.type = "number";
    rateInput.min = "0";
    rateInput.step = "0.01";
    rateInput.value = rate(this.p.data);
    rateInput.setAttribute("aria-label", t("message4"));
    rateInput.title = t("message4");
    rateInput.onchange = () => {
      const n = Number(rateInput.value);
      if (rateInput.value.trim() && Number.isFinite(n) && n >= 0)
        this.p.settings({ hourlyRate: n });
      else {
        new Notice(t("message5"));
        rateInput.value = rate(this.p.data);
      }
    };
    const currencySelect = el("select", "worklogger-currency", billing);
    currencySelect.setAttribute("aria-label", t("currency"));
    currencySelect.title = t("currencyHelp");
    for (const code of new Set([...CURRENCIES, currency(this.p.data)])) {
      const option = el("option", "", currencySelect, code);
      option.value = code;
    }
    currencySelect.value = currency(this.p.data);
    currencySelect.onchange = () =>
      this.p.settings({ currency: currencySelect.value });
    el("span", "worklogger-unit", billing, "/" + t("hour"));
    el("span", "worklogger-symbol", billing, "=");
    el("strong", "worklogger-cost", billing, values(this.p.data).Cost);
    if (this.c.start > this.c.end) {
      el("span", "worklogger-error", root, t("message6"));
      return;
    }
    if (this.only) return;
    const count =
      Math.round(
        (Date.parse(this.c.end + "T12:00:00Z") -
          Date.parse(this.c.start + "T12:00:00Z")) /
          86400000,
      ) + 1;
    if (count > 366) {
      el("div", "worklogger-error", root, t("message7"));
      return;
    }
    const frame = el("div", "worklogger-frame", root),
      scroll = el("div", "worklogger-scroll", frame),
      grid = el("div", "worklogger-grid", scroll);
    grid.style.setProperty("--days", count);
    const sizeGrid = () =>
      grid.style.setProperty(
        "--day-width",
        Math.max(86, (scroll.clientWidth - 52) / this.c.days) + "px",
      );
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(sizeGrid);
    this.resizeObserver.observe(scroll);
    sizeGrid();
    const plus = button(frame, "", () =>
      new EditModal(
        this.p,
        {
          id: crypto.randomUUID(),
          title: t("message8"),
          description: "",
          date: this.c.start,
          start: 600,
          end: 780,
        },
        true,
      ).open(),
    );
    plus.className = "worklogger-add";
    setIcon(plus, "plus");
    plus.title = t("message9");
    plus.setAttribute("aria-label", t("message9"));
    el("div", "worklogger-head", grid, "");
    const dates = Array.from({ length: count }, (_, i) => add(this.c.start, i));
    for (const d of dates) {
      el(
        "div",
        "worklogger-head in-period",
        grid,
        new Date(d + "T12:00:00").toLocaleDateString(locale(), {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    }
    const relevant = this.p.data.events.filter(
      (e) => e.date >= this.c.start && e.date <= this.c.end,
    );
    const min = Math.min(
        420,
        ...relevant.map((e) => Math.floor(e.start / 60) * 60),
      ),
      max = Math.max(1380, ...relevant.map((e) => Math.ceil(e.end / 60) * 60)),
      height = (max - min) * 0.8;
    const axis = el("div", "worklogger-axis", grid);
    axis.style.height = height + "px";
    for (let m = min; m < max; m += 60) {
      const label = el("span", "", axis, time(m));
      label.style.top = (m - min) * 0.8 + "px";
    }
    const cols = dates.map((date) => {
      const col = el("div", "worklogger-day", grid);
      col.dataset.date = date;
      col.style.height = height + "px";
      return col;
    });
    const paint = (node, e) => {
      node.style.top = (Math.max(e.start, min) - min) * 0.8 + "px";
      node.style.height =
        Math.max(12, (Math.min(e.end, max) - Math.max(e.start, min)) * 0.8) +
        "px";
      node.querySelector(".worklogger-label").textContent =
        `${e.title || t("message8")} · ${hours(e.end - e.start)}\n${time(e.start)}–${time(e.end)}`;
    };
    const eventNode = (e, col) => {
      const node = el("div", "worklogger-event", col);
      node.tabIndex = 0;
      node.dataset.id = e.id;
      node.title = e.description || "";
      node.setAttribute(
        "aria-label",
        `${e.title || t("message8")} ${e.date} ${time(e.start)}–${time(e.end)}`,
      );
      el("div", "worklogger-handle top", node).dataset.mode = "start";
      el("div", "worklogger-label", node);
      const del = button(node, "×", () =>
        this.p.change((es) => es.filter((x) => x.id !== e.id)),
      );
      del.className = "worklogger-delete";
      del.title = t("message10");
      del.onpointerdown = (ev) => ev.stopPropagation();
      el("div", "worklogger-handle bottom", node).dataset.mode = "end";
      paint(node, e);
      node.onkeydown = (ev) => {
        if (ev.key === "Delete" || ev.key === "Backspace") {
          ev.preventDefault();
          this.p.change((es) => es.filter((x) => x.id !== e.id));
        }
        if (ev.key === "Enter") new EditModal(this.p, e).open();
      };
      return node;
    };
    for (const e of this.p.data.events) {
      const index = dates.indexOf(e.date);
      if (index >= 0 && e.end > min && e.start < max) eventNode(e, cols[index]);
    }
    cols.forEach(
      (col) =>
        (col.onpointerdown = (ev) => {
          if (ev.button !== 0 || ev.target.closest("button")) return;
          ev.preventDefault();
          const existing = ev.target.closest(".worklogger-event"),
            original = existing
              ? this.p.data.events.find((x) => x.id === existing.dataset.id)
              : null,
            mode = original ? ev.target.dataset.mode || "move" : "create";
          const rect = col.getBoundingClientRect();
          const minute = (y) =>
            Math.max(
              min,
              Math.min(max, Math.round((y - rect.top) / 0.8 / 15) * 15 + min),
            );
          const initial = minute(ev.clientY);
          let draft = original
            ? { ...original }
            : {
                id: crypto.randomUUID(),
                title: t("message8"),
                description: "",
                date: col.dataset.date,
                start: Math.min(initial, max - 15),
                end: Math.min(initial + 15, max),
              };
          const node = existing || eventNode(draft, col);
          if (existing) node.focus({ preventScroll: true });
          let moved = false;
          col.setPointerCapture(ev.pointerId);
          const move = (e) => {
            moved =
              moved ||
              Math.abs(e.clientY - ev.clientY) > 3 ||
              Math.abs(e.clientX - ev.clientX) > 3;
            const at = minute(e.clientY);
            if (mode === "create") {
              draft.start = Math.min(initial, at, max - 15);
              draft.end = Math.min(
                max,
                Math.max(initial, at, draft.start + 15),
              );
            } else if (mode === "start")
              draft.start = Math.min(draft.end - 15, at);
            else if (mode === "end") draft.end = Math.max(draft.start + 15, at);
            else {
              const duration = original.end - original.start;
              draft.start = Math.max(
                0,
                Math.min(1440 - duration, original.start + at - initial),
              );
              draft.end = draft.start + duration;
              const target = cols.find((c) => {
                const r = c.getBoundingClientRect();
                return e.clientX >= r.left && e.clientX < r.right;
              });
              if (target) {
                draft.date = target.dataset.date;
                target.append(node);
              }
            }
            paint(node, draft);
          };
          const clean = () => {
            col.removeEventListener("pointermove", move);
            col.removeEventListener("pointerup", up);
            col.removeEventListener("pointercancel", cancel);
            document.removeEventListener("keydown", key);
            if (col.hasPointerCapture(ev.pointerId))
              col.releasePointerCapture(ev.pointerId);
            this.cancel = null;
          };
          const cancel = () => {
            clean();
            this.render();
          };
          const key = (e) => {
            if (e.key === "Escape") cancel();
          };
          const up = () => {
            clean();
            if (moved)
              this.p.change((es) =>
                original
                  ? es.map((x) => (x.id === original.id ? draft : x))
                  : [...es, draft],
              );
            else if (!original) node.remove();
            else if (mode === "move") new EditModal(this.p, original).open();
          };
          this.cancel = cancel;
          col.addEventListener("pointermove", move);
          col.addEventListener("pointerup", up);
          col.addEventListener("pointercancel", cancel);
          document.addEventListener("keydown", key);
        }),
    );
  }
}
class EditModal extends Modal {
  constructor(p, event, isNew = false) {
    super(p.app);
    this.p = p;
    this.event = event;
    this.isNew = isNew;
  }
  onOpen() {
    this.modalEl.classList.add("worklogger-edit-modal");
    const root = this.contentEl;
    el("div", "worklogger-edit-eyebrow", root, t("message11"));
    el(
      "h2",
      "worklogger-edit-title",
      root,
      this.isNew ? t("message12") : t("message13"),
    );
    const form = el("form", "worklogger-edit-form", root),
      inputs = {};
    const makeField = (parent, key, type, label, value) => {
      const group = el("div", "worklogger-edit-field", parent),
        id = "worklogger-" + key + "-" + crypto.randomUUID();
      const caption = el("label", "", group, label);
      caption.htmlFor = id;
      const input = el("input", "", group);
      input.type = type;
      input.id = id;
      input.value = value;
      input.required = true;
      inputs[key] = input;
      if (key === "start" || key === "end") {
        input.placeholder = t("message14");
        input.inputMode = "text";
        input.maxLength = 5;
        input.autocomplete = "off";
      }
      return group;
    };
    makeField(
      form,
      "title",
      "text",
      t("message15"),
      this.event.title || t("message8"),
    );
    const descriptionGroup = el("div", "worklogger-edit-field", form),
      descriptionId = "worklogger-description-" + crypto.randomUUID();
    const descriptionLabel = el("label", "", descriptionGroup, t("message16"));
    descriptionLabel.htmlFor = descriptionId;
    inputs.description = el("textarea", "", descriptionGroup);
    inputs.description.id = descriptionId;
    inputs.description.rows = 3;
    inputs.description.value = this.event.description || "";
    makeField(form, "date", "date", t("message17"), this.event.date);
    const times = el("div", "worklogger-edit-times", form);
    makeField(times, "start", "text", t("message18"), time(this.event.start));
    const endGroup = makeField(
      times,
      "end",
      "text",
      t("message19"),
      time(this.event.end),
    );
    el("span", "worklogger-edit-hint", endGroup, t("message20"));
    const duration = el("div", "worklogger-edit-duration", form);
    duration.setAttribute("aria-live", "polite");
    const parse = (s) =>
      /^\d{2}:\d{2}$/.test(s) && Number(s.slice(3)) < 60
        ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
        : NaN;
    const valid = () => {
      const start = parse(inputs.start.value),
        end = parse(inputs.end.value);
      return (
        !!inputs.title.value.trim() &&
        dateOK(inputs.date.value) &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end <= 1440 &&
        start < end
      );
    };
    const update = () => {
      duration.textContent = valid()
        ? t("message21") +
          hours(parse(inputs.end.value) - parse(inputs.start.value))
        : t("message22");
      duration.classList.toggle("is-invalid", !valid());
    };
    Object.values(inputs).forEach((i) => i.addEventListener("input", update));
    update();
    const error = el("div", "worklogger-edit-error", form);
    error.setAttribute("role", "alert");
    const actions = el("div", "worklogger-edit-actions", form);
    button(actions, t("message23"), () => this.close());
    const save = el("button", "mod-cta", actions, t("message24"));
    save.type = "submit";
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (!valid()) {
        error.textContent = t("message25");
        return;
      }
      save.disabled = true;
      error.textContent = "";
      const next = {
        ...this.event,
        title: inputs.title.value.trim(),
        description: inputs.description.value,
        date: inputs.date.value,
        start: parse(inputs.start.value),
        end: parse(inputs.end.value),
      };
      await this.p.change((es) =>
        this.isNew
          ? [...es, next]
          : es.map((e) => (e.id === this.event.id ? next : e)),
      );
      if (this.p.error) {
        error.textContent = this.p.error;
        save.disabled = false;
      } else this.close();
    };
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
class Store {
  constructor(app, path, data) {
    this.app = app;
    this.path = path;
    this.id = data.id;
    this.data = validate(data);
    this.history = [];
    this.calendars = new Set();
    this.queue = Promise.resolve();
    this.pending = 0;
  }
  file() {
    const f = this.app.vault.getAbstractFileByPath(this.path);
    if (!f) throw Error(t("message34"));
    return f;
  }
  renderAll() {
    for (const c of this.calendars) {
      c.c = config(this.data);
      c.render();
    }
    this.onUpdate?.();
  }
  async refresh() {
    await this.queue;
    try {
      const current = locate(
        await this.app.vault.read(this.file()),
        this.id,
      ).data;
      if (!same(current, this.data)) this.history = [];
      this.data = current;
      this.error = null;
    } catch (e) {
      this.error = t("message35") + e.message;
    }
    this.renderAll();
  }
  change(fn, undo = false, settings = null) {
    this.pending++;
    this.queue = this.queue.then(async () => {
      try {
        let previous, next;
        await this.app.vault.process(this.file(), (text) => {
          const block = locate(text, this.id);
          if (!same(block.data, this.data)) {
            this.data = block.data;
            this.history = [];
            throw Error(t("message36"));
          }
          previous = block.data;
          next = undo
            ? this.history.at(-1)
            : settings
              ? { ...previous, ...settings }
              : {
                  ...previous,
                  events: fn(previous.events.map((e) => ({ ...e }))),
                };
          if (!next) return text;
          validate(next);
          if (next.id !== this.id) throw Error(t("message37"));
          return (
            text.slice(0, block.start) +
            JSON.stringify(next, null, 2) +
            "\n" +
            text.slice(block.end)
          );
        });
        if (next) {
          if (undo) this.history.pop();
          else {
            this.history.push(previous);
            if (this.history.length > 50) this.history.shift();
          }
          this.data = next;
        }
        this.error = null;
      } catch (e) {
        this.error = t("message38") + e.message;
        new Notice(this.error);
      } finally {
        this.pending--;
        this.renderAll();
      }
    });
    return this.queue;
  }
  settings(values) {
    return this.change(null, false, values);
  }
  undo() {
    return this.change(null, true);
  }
}
class Tokens extends MarkdownRenderChild {
  constructor(container, plugin, path, spans) {
    super(container);
    this.plugin = plugin;
    this.path = path;
    this.spans = spans;
    this.serial = 0;
  }
  onload() {
    this.plugin.tokens.add(this);
    this.update();
  }
  onunload() {
    this.serial++;
    this.plugin.tokens.delete(this);
  }
  async update() {
    const serial = ++this.serial;
    let result, error;
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(this.path);
      if (!file) throw Error(t("message34"));
      const block = locate(await this.plugin.app.vault.read(file));
      result = values(block.data);
    } catch (e) {
      error = e.message;
    }
    if (serial !== this.serial) return;
    for (const [span, key] of this.spans) {
      span.textContent = error ? t("message39") + error + "]" : result[key];
      span.classList.toggle("worklogger-token-error", !!error);
    }
  }
}
module.exports = class Worklogger extends Plugin {
  async onload() {
    this.settings = Object.assign(
      { language: "auto", defaultCurrency: "RUB" },
      await this.loadData(),
    );
    if (!["auto", "en", "ru"].includes(this.settings.language))
      this.settings.language = "auto";
    if (!CURRENCIES.includes(this.settings.defaultCurrency))
      this.settings.defaultCurrency = "RUB";
    setLanguage(this.settings.language, getLanguage());
    this.addSettingTab(new WorkloggerSettings(this.app, this));
    this.stores = new Map();
    this.tokens = new Set();
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        for (const store of this.stores.values())
          if (store.path === file.path) void store.refresh();
        this.updateTokens(file.path);
      }),
    );
    this.registerMarkdownPostProcessor((element, ctx) => {
      const spans = [];
      const walker = element.ownerDocument.createTreeWalker(element, 4);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (
          node.parentElement?.closest(
            "code,pre,input,textarea,script,style,.worklogger,.worklogger-token",
          )
        )
          continue;
        const text = node.textContent;
        const pattern = /\{\.(Time|Cost|Rate)\}/g;
        let match,
          last = 0,
          found = false;
        const frag = element.ownerDocument.createDocumentFragment();
        while ((match = pattern.exec(text))) {
          found = true;
          frag.append(
            element.ownerDocument.createTextNode(text.slice(last, match.index)),
          );
          const span = element.ownerDocument.createElement("span");
          span.className = "worklogger-token";
          span.textContent = "…";
          frag.append(span);
          spans.push([span, match[1]]);
          last = match.index + match[0].length;
        }
        if (found) {
          frag.append(element.ownerDocument.createTextNode(text.slice(last)));
          node.replaceWith(frag);
        }
      }
      if (spans.length)
        ctx.addChild(new Tokens(element, this, ctx.sourcePath, spans));
    });
    for (const fence of ["worklogger"])
      this.registerMarkdownCodeBlockProcessor(fence, (source, element, ctx) => {
        try {
          const data = validate(JSON.parse(source));
          const key = JSON.stringify([ctx.sourcePath, data.id]);
          let store = this.stores.get(key);
          if (!store) {
            store = new Store(this.app, ctx.sourcePath, data);
            store.onUpdate = () => this.updateTokens(ctx.sourcePath);
            this.stores.set(key, store);
          } else if (!store.pending && !same(store.data, data)) {
            store.data = data;
            store.history = [];
            store.error = null;
            store.renderAll();
          }
          ctx.addChild(new Calendar(element, store, store.data));
        } catch (e) {
          element.textContent = t("message40") + e.message;
        }
      });
    this.addCommand({
      id: "insert-worklog",
      name: t("message41"),
      callback: () => this.insertWorklog(),
    });
    this.addRibbonIcon("calendar-clock", "Worklogger", () =>
      this.openCalendar(),
    );
  }
  updateTokens(path) {
    for (const token of this.tokens)
      if (token.path === path) void token.update();
  }
  async insertWorklog() {
    try {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.file) {
        new Notice(t("message42"));
        return;
      }
      const start = today(),
        data = {
          id: crypto.randomUUID(),
          version: 1,
          start,
          end: add(start, 13),
          days: 14,
          hourlyRate: 0,
          currency: this.settings.defaultCurrency,
          events: [],
        };
      const block =
        "\n```worklogger\n" + JSON.stringify(data, null, 2) + "\n```\n";
      if (view.getMode() === "source" && view.editor)
        view.editor.replaceSelection(block);
      else await this.app.vault.process(view.file, (text) => text + block);
    } catch (e) {
      new Notice(t("message43") + e.message);
    }
  }
  async openCalendar() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      new Notice(t("message42"));
      return;
    }
    try {
      locate(await this.app.vault.read(view.file));
      await this.app.workspace.openLinkText(view.file.path, "", false, {
        state: { mode: "preview" },
      });
    } catch (e) {
      if (e.message === t("message33")) await this.insertWorklog();
      else new Notice(e.message);
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    setLanguage(this.settings.language, getLanguage());
    for (const store of this.stores.values()) store.renderAll();
    for (const token of this.tokens) void token.update();
  }
  async refresh() {
    await Promise.all([...this.stores.values()].map((s) => s.refresh()));
  }
};

class WorkloggerSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new Setting(this.containerEl).setName(t("language")).addDropdown((drop) =>
      drop
        .addOption("auto", t("automatic"))
        .addOption("en", "English")
        .addOption("ru", "Русский")
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value;
          await this.plugin.saveSettings();
          this.display();
        }),
    );
    new Setting(this.containerEl)
      .setName(t("defaultCurrency"))
      .setDesc(t("currencyHelp"))
      .addDropdown((drop) => {
        for (const code of CURRENCIES) drop.addOption(code, code);
        drop
          .setValue(this.plugin.settings.defaultCurrency)
          .onChange(async (value) => {
            this.plugin.settings.defaultCurrency = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
