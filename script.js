(() => {
  "use strict";

  // ======================================================================
  //  Math engine: tokenizer + recursive-descent parser (no eval()).
  // ======================================================================

  class CalcError extends Error {}

  const FUNCTIONS = {
    "sin⁻¹": (x, deg) => fromRad(Math.asin(x), deg),
    "cos⁻¹": (x, deg) => fromRad(Math.acos(x), deg),
    "tan⁻¹": (x, deg) => fromRad(Math.atan(x), deg),
    "sin": (x, deg) => trig(Math.sin, x, deg),
    "cos": (x, deg) => trig(Math.cos, x, deg),
    "tan": (x, deg) => trig(Math.tan, x, deg),
    "ln": x => Math.log(x),
    "log": x => Math.log10(x),
    "√": x => Math.sqrt(x),
    "∛": x => Math.cbrt(x),
  };
  const CONSTANTS = { "π": Math.PI, "e": Math.E };
  // Longest names first so "sin⁻¹" wins over "sin".
  const NAMES = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)]
    .sort((a, b) => b.length - a.length);

  function fromRad(r, deg) { return deg ? r * 180 / Math.PI : r; }

  function trig(fn, x, deg) {
    if (deg) {
      // Exact answers for the classic angles (sin 180 = 0, tan 90 = undefined).
      const m = ((x % 360) + 360) % 360;
      if (fn === Math.sin && m % 180 === 0) return 0;
      if (fn === Math.cos && m % 180 === 90) return 0;
      if (fn === Math.tan && m % 180 === 0) return 0;
      if (fn === Math.tan && m % 180 === 90) return NaN;
      x = x * Math.PI / 180;
    }
    const v = fn(x);
    return Math.abs(v) < 1e-13 ? 0 : v;
  }

  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    z -= 1;
    let x = c[0];
    for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function factorial(n) {
    if (Number.isInteger(n)) {
      if (n < 0) return NaN;
      if (n > 170) return Infinity;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    return gamma(n + 1);
  }

  function tokenize(src) {
    const s = src.replace(/-/g, "−").replace(/\*/g, "×").replace(/\//g, "÷");
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === " ") { i++; continue; }

      const num = /^(\d+\.?\d*|\.\d+)(E[+−]?\d+)?/.exec(s.slice(i));
      if (num) {
        tokens.push({ type: "num", value: parseFloat(num[0].replace("−", "-")) });
        i += num[0].length;
        continue;
      }
      if ("+−×÷^".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
      if ("!%²".includes(ch)) { tokens.push({ type: "post", value: ch }); i++; continue; }
      if (s.startsWith("⁻¹", i)) { tokens.push({ type: "post", value: "⁻¹" }); i += 2; continue; }
      if (ch === "(" || ch === ")") { tokens.push({ type: ch }); i++; continue; }

      const name = NAMES.find(n => s.startsWith(n, i));
      if (name) {
        tokens.push({ type: name in FUNCTIONS ? "func" : "const", value: name });
        i += name.length;
        continue;
      }
      throw new CalcError("Check your expression");
    }
    return tokens;
  }

  function evaluateExpression(src, deg) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const isOp = v => peek() && peek().type === "op" && peek().value === v;
    const startsPrimary = t => t && ["num", "const", "func", "("].includes(t.type);

    function expr() {
      let v = term();
      while (isOp("+") || isOp("−")) {
        const op = next().value;
        const r = term();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }

    function term() {
      let v = unary();
      for (;;) {
        if (isOp("×")) { next(); v *= unary(); }
        else if (isOp("÷")) {
          next();
          const r = unary();
          if (r === 0) throw new CalcError("Can't divide by zero");
          v /= r;
        }
        else if (startsPrimary(peek())) v *= unary(); // implicit: 2π, 3(4), 2sin(30)
        else return v;
      }
    }

    function unary() {
      if (isOp("−")) { next(); return -unary(); }
      if (isOp("+")) { next(); return unary(); }
      return power();
    }

    function power() {
      const base = postfix();
      if (isOp("^")) { next(); return Math.pow(base, unary()); }
      return base;
    }

    function postfix() {
      let v = primary();
      while (peek() && peek().type === "post") {
        const p = next().value;
        if (p === "!") v = factorial(v);
        else if (p === "%") v /= 100;
        else if (p === "²") v *= v;
        else if (p === "⁻¹") {
          if (v === 0) throw new CalcError("Can't divide by zero");
          v = 1 / v;
        }
      }
      return v;
    }

    function primary() {
      const t = next();
      if (!t) throw new CalcError("Finish your expression");
      if (t.type === "num") return t.value;
      if (t.type === "const") return CONSTANTS[t.value];
      if (t.type === "func") {
        const arg = peek() && peek().type === "(" ? primary() : unary();
        return FUNCTIONS[t.value](arg, deg);
      }
      if (t.type === "(") {
        const v = expr();
        if (peek() && peek().type === ")") next(); // missing ")" at the end is fine
        return v;
      }
      throw new CalcError("Check your expression");
    }

    if (tokens.length === 0) throw new CalcError("Finish your expression");
    const value = expr();
    if (pos < tokens.length) throw new CalcError("Check your expression");
    if (Number.isNaN(value)) throw new CalcError("Undefined result");
    if (!Number.isFinite(value)) throw new CalcError("Number too large");
    return value;
  }

  // ======================================================================
  //  Formatting
  // ======================================================================

  function numberToString(n) {
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e16 || abs < 1e-9)) {
      return n.toExponential(9).replace(/\.?0+e/, "e").replace("e", "E");
    }
    return String(parseFloat(n.toPrecision(12)));
  }

  function groupDigits(numStr) {
    if (numStr.includes("E")) return numStr;
    const [int, dec] = numStr.split(".");
    return (int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec !== undefined ? "." + dec : ""))
      .replace("-", "−");
  }

  const formatExpr = s =>
    s.replace(/-/g, "−").replace(/(\d+\.?\d*|\.\d+)(E[+−-]?\d+)?/g, m => groupDigits(m));

  // ======================================================================
  //  Calculator state + input handling
  // ======================================================================

  const OPS = "+−×÷^";
  const MAX_DIGITS = 16;

  const display = document.querySelector(".display");
  const exprEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const angleEl = document.getElementById("angle-mode");
  const angleBtn = document.querySelector('[data-action="angle"]');
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");

  const state = {
    expr: "",
    result: null,   // last computed result (string)
    done: false,    // true right after "="
    error: null,
    deg: load("calc-deg", true),
  };
  let history = load("calc-history", []);

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  const last = () => state.expr.slice(-1);
  const endsWithOperator = () => OPS.includes(last());
  const lastNumber = () => (/(\d+\.?\d*|\.\d+)(E[+−]?\d+)?$/.exec(state.expr) || [""])[0];
  const openParens = () =>
    (state.expr.match(/\(/g) || []).length - (state.expr.match(/\)/g) || []).length;
  const canEndValue = () => state.expr !== "" && !endsWithOperator() && last() !== "(";

  // After "=", typing a number starts over; typing an operator continues from the result.
  function startFresh() {
    if (state.done) { state.expr = ""; state.done = false; }
    state.error = null;
  }
  function continueFromResult() {
    if (state.done) {
      state.expr = state.result.replace("-", "−");
      state.done = false;
    }
    state.error = null;
  }

  function insertDigit(d) {
    startFresh();
    if (lastNumber().replace(".", "").length >= MAX_DIGITS) return;
    if (lastNumber() === "0" && !state.expr.endsWith(".")) state.expr = state.expr.slice(0, -1);
    state.expr += d;
  }

  function insertDecimal() {
    startFresh();
    const n = lastNumber();
    if (n.includes(".") || n.includes("E")) return;
    state.expr += n ? "." : "0.";
  }

  function insertOperator(op) {
    continueFromResult();
    if (state.expr === "" || last() === "(") {
      if (op === "−") state.expr += op;   // allow a leading negative sign
      return;
    }
    if (endsWithOperator()) {
      // Allow "2×−3", otherwise replace the previous operator.
      if (op === "−" && "×÷^".includes(last())) { state.expr += op; return; }
      state.expr = state.expr.replace(/[+−×÷^]+$/, "");
      if (state.expr === "") return;
    }
    state.expr += op;
  }

  function insertText(text) {       // functions, constants, "("
    startFresh();
    state.expr += text;
  }

  function insertPostfix(p) {        // !, %, ², ⁻¹
    continueFromResult();
    if (canEndValue()) state.expr += p;
  }

  function closeParen() {
    startFresh();
    if (openParens() > 0 && canEndValue()) state.expr += ")";
  }

  function negate() {
    continueFromResult();
    const n = lastNumber();
    if (!n) return;
    let head = state.expr.slice(0, -n.length);
    if (head.endsWith("(−")) head = head.slice(0, -2);
    else if (head.endsWith("−") && (head.length === 1 || "+−×÷^(".includes(head.slice(-2, -1)))) head = head.slice(0, -1);
    else head += head === "" || head.endsWith("(") ? "−" : "(−";
    state.expr = head + n;
  }

  function backspace() {
    state.error = null;
    if (state.done) { state.done = false; return; }
    const token = /(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|∛\(|e\^\(|⁻¹)$/.exec(state.expr);
    state.expr = state.expr.slice(0, -(token ? token[0].length : 1));
  }

  function clearAll() {
    state.expr = "";
    state.done = false;
    state.error = null;
  }

  function equals() {
    if (state.expr === "" || state.done) return;
    try {
      const value = evaluateExpression(state.expr, state.deg);
      const str = numberToString(value);
      const closed = state.expr + ")".repeat(Math.max(0, openParens()));
      history.unshift({ expr: formatExpr(closed), result: groupDigits(str), raw: str });
      history = history.slice(0, 30);
      save("calc-history", history);
      renderHistory();
      state.expr = closed;
      state.result = str;
      state.done = true;
      state.error = null;
    } catch (err) {
      if (!(err instanceof CalcError)) throw err;
      state.error = err.message;
    }
  }

  function toggleAngle() {
    state.deg = !state.deg;
    save("calc-deg", state.deg);
  }

  // ======================================================================
  //  Rendering
  // ======================================================================

  function preview() {
    // Only preview when there is something to calculate (not just a lone number).
    if (!/[+−×÷^!%²(πe√∛]|⁻¹|sin|cos|tan|ln|log/.test(state.expr.replace(/E[+−]/g, ""))) return "";
    try { return groupDigits(numberToString(evaluateExpression(state.expr, state.deg))); }
    catch { return ""; }
  }

  function render() {
    const shown = formatExpr(state.expr);
    display.classList.toggle("done", state.done);
    display.classList.toggle("has-error", !!state.error);

    if (state.done) {
      exprEl.textContent = shown + " =";
      resultEl.textContent = groupDigits(state.result);
    } else {
      exprEl.textContent = shown || "0";
      resultEl.textContent = state.error || preview();
    }
    exprEl.classList.toggle("long", !state.done && shown.length > 14);
    resultEl.classList.toggle("long", state.done && resultEl.textContent.length > 12);

    angleEl.textContent = state.deg ? "DEG" : "RAD";
    angleBtn.textContent = state.deg ? "Deg" : "Rad";
    angleBtn.setAttribute("aria-label",
      state.deg ? "Angles in degrees. Switch to radians" : "Angles in radians. Switch to degrees");
  }

  function renderHistory() {
    historyList.innerHTML = "";
    history.forEach(item => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "Use this result";
      const e = document.createElement("span");
      e.className = "h-expr";
      e.textContent = item.expr + " =";
      const r = document.createElement("span");
      r.className = "h-res";
      r.textContent = item.result;
      btn.append(e, r);
      btn.addEventListener("click", () => {
        startFresh();
        const value = item.raw.replace("-", "−");
        // Wrap negatives so they combine safely with what's already typed.
        state.expr += value.startsWith("−") && state.expr !== "" ? `(${value})` : value;
        render();
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });
    historyEmpty.hidden = history.length > 0;
  }

  // ======================================================================
  //  Events
  // ======================================================================

  const actions = {
    clear: clearAll, backspace, negate, equals,
    decimal: insertDecimal, angle: toggleAngle, close: closeParen,
  };

  function handleButton(btn) {
    const { digit, op, insert, post, action } = btn.dataset;
    if (digit !== undefined) insertDigit(digit);
    else if (op) insertOperator(op);
    else if (insert) insertText(insert);
    else if (post) insertPostfix(post);
    else if (action) actions[action]();
    render();
  }

  document.querySelectorAll(".keys, .sci-keys").forEach(pad =>
    pad.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (btn) handleButton(btn);
    }));

  const keyToSelector = {
    "+": '[data-op="+"]', "-": '[data-op="−"]', "*": '[data-op="×"]', "x": '[data-op="×"]',
    "/": '[data-op="÷"]', "^": '[data-op="^"]',
    "(": '[data-insert="("]', ")": '[data-action="close"]',
    "!": '[data-post="!"]', "%": '[data-post="%"]',
    ".": '[data-action="decimal"]', ",": '[data-action="decimal"]',
    "Enter": '[data-action="equals"]', "=": '[data-action="equals"]',
    "Backspace": '[data-action="backspace"]',
    "Escape": '[data-action="clear"]', "Delete": '[data-action="clear"]',
    "p": '[data-insert="π"]', "s": '[data-insert="sin("]', "c": '[data-insert="cos("]',
    "t": '[data-insert="tan("]', "l": '[data-insert="ln("]', "r": '[data-insert="√("]',
  };

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const selector = /^[0-9]$/.test(e.key) ? `[data-digit="${e.key}"]` : keyToSelector[e.key];
    const btn = selector && document.querySelector(selector);
    if (!btn) return;
    e.preventDefault();
    handleButton(btn);
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 100);
  });

  document.getElementById("clear-history").addEventListener("click", () => {
    history = [];
    save("calc-history", history);
    renderHistory();
  });

  // Scientific panel toggle
  const sciToggle = document.getElementById("sci-toggle");
  const sciKeys = document.querySelector(".sci-keys");
  function setScientific(on) {
    sciKeys.hidden = !on;
    sciToggle.setAttribute("aria-pressed", String(on));
    save("calc-sci", on);
  }
  setScientific(load("calc-sci", true));
  sciToggle.addEventListener("click", () => setScientific(sciKeys.hidden));

  // Theme toggle
  const themeBtn = document.getElementById("theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    return dark;
  }
  let isDark = applyTheme(load("calc-theme", null));
  themeBtn.addEventListener("click", () => {
    const nextTheme = isDark ? "light" : "dark";
    save("calc-theme", nextTheme);
    isDark = applyTheme(nextTheme);
  });

  renderHistory();
  render();
})();
