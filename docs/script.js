(() => {
  const SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const MAX_DIGITS = 16;

  const resultEl = document.getElementById("result");
  const exprEl = document.getElementById("expression");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const opButtons = document.querySelectorAll("[data-op]");

  const state = {
    current: "0",    // number being typed / shown
    previous: null,  // left-hand operand
    operator: null,  // pending operator
    fresh: true,     // next digit starts a new number
    error: false,
  };

  let history = load("calc-history", []);

  // ---------- helpers ----------
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  // Round away floating point noise (e.g. 0.1 + 0.2 -> 0.3)
  function clean(n) {
    return parseFloat(n.toPrecision(12));
  }

  function format(str) {
    if (str === "-" ) return str;
    const [int, dec] = str.split(".");
    const sign = int.startsWith("-") ? "-" : "";
    const digits = int.replace("-", "");
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + grouped + (dec !== undefined ? "." + dec : "");
  }

  function numberToString(n) {
    if (!isFinite(n)) return null;
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e16 || abs < 1e-10)) return n.toExponential(6);
    return String(clean(n));
  }

  function compute(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? null : a / b;
    }
    return b;
  }

  // ---------- rendering ----------
  function render() {
    resultEl.classList.toggle("error", state.error);
    if (state.error) {
      resultEl.textContent = state.current;
    } else {
      const text = state.current.includes("e") ? state.current : format(state.current);
      resultEl.textContent = text;
      resultEl.classList.toggle("small", text.length > 11);
    }

    exprEl.textContent = state.operator && state.previous !== null
      ? `${format(state.previous)} ${SYMBOLS[state.operator]}`
      : exprEl.dataset.last || "";

    opButtons.forEach(b =>
      b.classList.toggle("active", b.dataset.op === state.operator && state.fresh && !state.error));
  }

  function renderHistory() {
    historyList.innerHTML = "";
    history.forEach(item => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "Use this result";
      btn.innerHTML = `<span class="h-expr"></span><span class="h-res"></span>`;
      btn.querySelector(".h-expr").textContent = item.expr + " =";
      btn.querySelector(".h-res").textContent = item.result;
      btn.addEventListener("click", () => {
        reset();
        state.current = item.raw;
        state.fresh = true;
        render();
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });
    historyEmpty.hidden = history.length > 0;
  }

  function showError(msg) {
    state.current = msg;
    state.error = true;
    state.previous = null;
    state.operator = null;
    state.fresh = true;
    exprEl.dataset.last = "";
  }

  function reset() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.fresh = true;
    state.error = false;
    exprEl.dataset.last = "";
  }

  // ---------- actions ----------
  function inputDigit(d) {
    if (state.error) reset();
    if (state.fresh) {
      state.current = d;
      state.fresh = false;
      exprEl.dataset.last = "";
    } else if (state.current.replace(/[-.]/g, "").length < MAX_DIGITS) {
      state.current = state.current === "0" ? d : state.current + d;
    }
  }

  function inputDecimal() {
    if (state.error) reset();
    if (state.fresh) {
      state.current = "0.";
      state.fresh = false;
      exprEl.dataset.last = "";
    } else if (!state.current.includes(".")) {
      state.current += ".";
    }
  }

  function chooseOperator(op) {
    if (state.error) return;
    if (state.operator && !state.fresh) {
      if (!evaluate(false)) return;
    }
    state.previous = state.current;
    state.operator = op;
    state.fresh = true;
  }

  // Returns false if an error occurred.
  function evaluate(record = true) {
    if (state.error || state.operator === null || state.previous === null) return true;
    const a = parseFloat(state.previous);
    const b = parseFloat(state.current);
    const value = compute(a, b, state.operator);
    const expr = `${format(state.previous)} ${SYMBOLS[state.operator]} ${format(state.current)}`;

    if (value === null) { showError("Can't divide by zero"); return false; }
    const str = numberToString(value);
    if (str === null) { showError("Number too large"); return false; }

    if (record) {
      history.unshift({ expr, result: str.includes("e") ? str : format(str), raw: str });
      history = history.slice(0, 30);
      save("calc-history", history);
      renderHistory();
      exprEl.dataset.last = expr + " =";
    }
    state.current = str;
    state.previous = null;
    state.operator = null;
    state.fresh = true;
    return true;
  }

  function backspace() {
    if (state.error) { reset(); return; }
    if (state.fresh) return;
    state.current = state.current.slice(0, -1);
    if (state.current === "" || state.current === "-") {
      state.current = "0";
      state.fresh = true;
    }
  }

  function negate() {
    if (state.error || state.current === "0") return;
    state.current = state.current.startsWith("-") ? state.current.slice(1) : "-" + state.current;
  }

  function percent() {
    if (state.error) return;
    let n = parseFloat(state.current);
    // 50 + 10% -> 50 + 5 ; 50 × 10% -> 50 × 0.1
    if (state.previous !== null && (state.operator === "+" || state.operator === "-")) {
      n = parseFloat(state.previous) * n / 100;
    } else {
      n = n / 100;
    }
    state.current = numberToString(n) ?? "0";
    state.fresh = true;
  }

  const actions = {
    clear: reset,
    backspace,
    negate,
    percent,
    decimal: inputDecimal,
    equals: () => evaluate(true),
  };

  // ---------- events ----------
  document.querySelector(".keys").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.digit) inputDigit(btn.dataset.digit);
    else if (btn.dataset.op) chooseOperator(btn.dataset.op);
    else if (btn.dataset.action) actions[btn.dataset.action]();
    render();
  });

  const keyMap = {
    "Enter": "equals", "=": "equals", "Escape": "clear", "Delete": "clear",
    "Backspace": "backspace", "%": "percent", ".": "decimal", ",": "decimal",
  };

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let selector = null;
    if (/^[0-9]$/.test(e.key)) { inputDigit(e.key); selector = `[data-digit="${e.key}"]`; }
    else if (e.key in SYMBOLS) { chooseOperator(e.key); selector = `[data-op="${e.key}"]`; }
    else if (e.key === "x" || e.key === "X") { chooseOperator("*"); selector = `[data-op="*"]`; }
    else if (keyMap[e.key]) { actions[keyMap[e.key]](); selector = `[data-action="${keyMap[e.key]}"]`; }
    else return;

    e.preventDefault();
    render();
    const btn = selector && document.querySelector(selector);
    if (btn) {
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 100);
    }
  });

  document.getElementById("clear-history").addEventListener("click", () => {
    history = [];
    save("calc-history", history);
    renderHistory();
  });

  // ---------- theme ----------
  const themeBtn = document.getElementById("theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    const dark = theme
      ? theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    return dark;
  }
  let isDark = applyTheme(load("calc-theme", null));
  themeBtn.addEventListener("click", () => {
    const next = isDark ? "light" : "dark";
    save("calc-theme", next);
    isDark = applyTheme(next);
  });

  renderHistory();
  render();
})();
