/*!
 * Bluetti Power Card for Home Assistant
 * Display + control card. Data is read from entities provided by another
 * integration; this card only maps and presents them.
 *
 * Resource: /local/bluetti-power-card.js  (type: JavaScript Module)
 * Card type: custom:bluetti-power-card
 */

const COLORS = {
  dc_charging: "#ffd60a",
  ac_charging: "#30d158",
  dc_discharging: "#0a84ff",
  ac_discharging: "#ff9f0a",
};
const POWER_KEYS = ["dc_charging", "ac_charging", "dc_discharging", "ac_discharging"];

class BluettiPowerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._modeKey = "";
    this._pending = {};
  }

  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._update();
    }, 15000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  static getConfigElement() {
    return document.createElement("bluetti-power-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._build();
    if (this._hass) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._built) this._update();
  }

  getCardSize() {
    return 8;
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  _build() {
    const node = (k, pos, icon, label) => `
      <div class="node ${pos}" data-k="${k}">
        <div class="circle"><ha-icon icon="${icon}"></ha-icon></div>
        <div class="txt">
          <div class="val"><span class="num">–</span><span class="unit">W</span></div>
          <div class="lbl">${label}</div>
        </div>
      </div>`;

    const flow = (k, d) => `
      <path class="track" d="${d}"/>
      <path class="flow" data-k="${k}" d="${d}" style="stroke:${COLORS[k]}"/>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { background:transparent; box-shadow:none; border:none; }
        .panel {
          background:#1c1c1e; border-radius:18px; padding:12px;
          color:#fff; box-sizing:border-box;
        }
        .panel + .panel { margin-top:12px; }

        /* ---------- stage ---------- */
        .stage {
          position:relative; max-width:420px; margin:0 auto;
          container-type:inline-size; aspect-ratio:400/315;
        }
        svg { position:absolute; inset:0; width:100%; height:100%; }
        .track { fill:none; stroke:#2c2c2e; stroke-width:7; stroke-linecap:round; }
        .flow {
          fill:none; stroke-width:4; stroke-linecap:round;
          stroke-dasharray:10 16; opacity:0; transition:opacity .4s;
        }
        .flow.on { opacity:1; animation:flow 1s linear infinite; }
        @keyframes flow { to { stroke-dashoffset:-26; } }
        .gauge-bg { fill:none; stroke:#2c2c2e; stroke-width:12; stroke-linecap:round; }
        .gauge { fill:none; stroke-width:12; stroke-linecap:round;
                 transition:stroke-dasharray .6s, stroke .6s; }

        .node { position:absolute; display:flex; align-items:center; gap:3cqw; }
        .tl { left:4cqw; top:4cqw; }
        .tr { right:4cqw; top:4cqw; flex-direction:row-reverse; text-align:right; }
        .bl { left:4cqw; bottom:4cqw; }
        .br { right:4cqw; bottom:4cqw; flex-direction:row-reverse; text-align:right; }
        .circle {
          width:14cqw; height:14cqw; border-radius:50%; background:#8e8e93;
          display:flex; align-items:center; justify-content:center; flex:none;
          box-shadow:0 0 0 1.2cqw rgba(255,255,255,.06);
          transition:background .4s;
        }
        .node.active .circle { background:var(--c); }
        .circle ha-icon { --mdc-icon-size:7cqw; color:#fff; display:flex; }
        .val { font-size:6.5cqw; font-weight:700; line-height:1.1; }
        .unit { font-size:4.2cqw; font-weight:600; color:#aeaeb2; margin-left:.5cqw; }
        .lbl { font-size:3.8cqw; color:#8e8e93; font-weight:500; }

        .center {
          position:absolute; left:50%; top:47.6%; transform:translate(-50%,-50%);
          display:flex; flex-direction:column; align-items:center; text-align:center;
        }
        .center ha-icon { --mdc-icon-size:7cqw; display:flex; }
        .soc { font-size:13cqw; font-weight:700; line-height:1.05; }
        .soc small { font-size:5cqw; font-weight:600; color:#aeaeb2; margin-left:.5cqw; }
        .time { font-size:3.3cqw; line-height:1.25; color:#aeaeb2; margin-top:1cqw; min-height:2.5em; white-space:pre-line; }

        .power {
          position:absolute; left:50%; bottom:4cqw; transform:translateX(-50%);
          width:10cqw; height:10cqw; display:flex; align-items:center; justify-content:center;
          cursor:pointer; color:#ff453a; --mdc-icon-size:8cqw; opacity:.55;
        }
        .power.on { opacity:1; }

        /* ---------- controls ---------- */
        .controls { padding:6px 14px; }
        .row { display:flex; align-items:center; gap:14px; padding:10px 0; }
        .ico {
          width:46px; height:46px; border-radius:11px; background:#4a381a; color:#ff9f0a;
          display:flex; align-items:center; justify-content:center; flex:none;
        }
        .row .name { flex:1; font-size:17px; font-weight:500; }
        ha-switch { --mdc-theme-secondary:#0a84ff; }
        .modes { display:flex; background:#2c2c2e; border-radius:11px; padding:3px; gap:3px; flex:1; }
        .modes button {
          flex:1; border:none; background:transparent; color:#aeaeb2; padding:9px 4px;
          border-radius:9px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;
        }
        .modes button.sel { background:#0a84ff; color:#fff; }
        .modes button:disabled { opacity:.5; cursor:default; }
        .row.mode { flex-direction:column; align-items:stretch; gap:8px; }
        .row.mode .name { flex:none; }
        .row.pending ha-switch { opacity:.5; animation:pulse 1s ease-in-out infinite; }
        .modes button.wait { animation:pulse 1s ease-in-out infinite; }
        @keyframes pulse { 50% { opacity:.35; } }
        .node.unavail { opacity:.45; }
        .node.unavail .unit { display:none; }
        .row.unavail .ico, .row.unavail ha-switch, .row.unavail .modes { opacity:.4; }
        .row.unavail .name::after {
          content:" · Unavailable"; color:#8e8e93; font-size:13px; font-weight:400;
        }
        .hidden { display:none !important; }
      </style>

      <ha-card>
        <div class="panel">
          <div class="stage">
            <svg viewBox="0 0 400 315" preserveAspectRatio="xMidYMid meet">
              ${flow("dc_charging", "M44 72 V125 Q44 140 59 140 H120")}
              ${flow("ac_charging", "M356 72 V125 Q356 140 341 140 H280")}
              ${flow("dc_discharging", "M128 185 H59 Q44 185 44 200 V243")}
              ${flow("ac_discharging", "M272 185 H341 Q356 185 356 200 V243")}
              <path class="gauge-bg" pathLength="100" d="M150.5 199.5 A70 70 0 1 1 249.5 199.5"/>
              <path class="gauge" pathLength="100" stroke-dasharray="0 100"
                    d="M150.5 199.5 A70 70 0 1 1 249.5 199.5"/>
            </svg>

            ${node("dc_charging", "tl", "mdi:solar-power", "PV")}
            ${node("ac_charging", "tr", "mdi:transmission-tower", "Grid")}
            ${node("dc_discharging", "bl", "mdi:current-dc", "DC")}
            ${node("ac_discharging", "br", "mdi:current-ac", "AC")}

            <div class="center">
              <ha-icon class="bat" icon="mdi:battery"></ha-icon>
              <div class="soc"><span class="soc-num">–</span><small>%</small></div>
              <div class="time"></div>
            </div>

            <ha-icon class="power hidden" icon="mdi:power"></ha-icon>
          </div>
        </div>

        <div class="panel controls">
          <div class="row" data-sw="dc_switch">
            <div class="ico"><ha-icon icon="mdi:current-dc"></ha-icon></div>
            <span class="name">DC</span>
            <ha-switch></ha-switch>
          </div>
          <div class="row" data-sw="ac_switch">
            <div class="ico"><ha-icon icon="mdi:current-ac"></ha-icon></div>
            <span class="name">AC</span>
            <ha-switch></ha-switch>
          </div>
          <div class="row mode" data-mode>
            <span class="name">Charging mode</span>
            <div class="modes"></div>
          </div>
        </div>
      </ha-card>
    `;

    const root = this.shadowRoot;

    // switches
    root.querySelectorAll("[data-sw]").forEach((row) => {
      const key = row.dataset.sw;
      row.querySelector("ha-switch").addEventListener("change", (ev) => {
        const id = this._config[key];
        if (!id || !this._hass) return;
        const st = this._hass.states[id];
        const isOn = !!st && st.state === "on";
        const want = ev.target.checked;
        // do not keep the optimistic toggle: show the real entity state until it changes
        ev.target.checked = isOn;
        if (want === isOn || this._unavail(id) || this._isPending(key, st && st.state)) return;
        this._setPending(key, st ? st.state : null);
        this._hass.callService("homeassistant", want ? "turn_on" : "turn_off", {
          entity_id: id,
        });
      });
    });

    // master power button (optional)
    root.querySelector(".power").addEventListener("click", () => {
      const id = this._config.power_switch;
      if (id && this._hass) this._hass.callService("homeassistant", "toggle", { entity_id: id });
    });

    // charging mode buttons (event delegation)
    root.querySelector(".modes").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      const id = this._config.charging_mode;
      if (!btn || !id || !this._hass) return;
      const st = this._hass.states[id];
      if (!st || st.state === btn.dataset.o || this._unavail(id) || this._isPending("charging_mode", st.state)) return;
      this._setPending("charging_mode", st.state, btn.dataset.o);
      this._hass.callService(id.split(".")[0], "select_option", {
        entity_id: id,
        option: btn.dataset.o,
      });
    });

    this._modeKey = "";
    this._built = true;
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */
  // A control is "pending" from the click until the entity state actually changes
  // (or 15 s pass, e.g. if the command failed).
  _setPending(key, from, target) {
    this._pending[key] = { from, target, until: Date.now() + 15000 };
    setTimeout(() => this._hass && this._update(), 15100);
    this._update();
  }

  _isPending(key, current) {
    const p = this._pending[key];
    if (!p) return false;
    if (Date.now() > p.until || current !== p.from) {
      delete this._pending[key];
      return false;
    }
    return true;
  }

  // true if the entity is unavailable, the whole device is offline,
  // or (for readings only) it has not reported for longer than stale_after seconds
  _unavail(id) {
    if (!id) return false;
    if (this._deviceOffline) return true;
    const s = this._hass.states[id];
    if (!s || s.state === "unavailable" || s.state === "unknown") return true;
    const c = this._config;
    if (c.stale_after > 0 && this._isReading(id)) {
      const t = new Date(s.last_reported || s.last_updated).getTime();
      if (!isNaN(t) && Date.now() - t > c.stale_after * 1000) return true;
    }
    return false;
  }

  _isReading(id) {
    const c = this._config;
    return id === c.soc || POWER_KEYS.some((k) => c[k] === id);
  }

  _power(id) {
    const s = id && this._hass.states[id];
    if (!s) return null;
    const v = parseFloat(s.state);
    if (isNaN(v)) return null;
    const u = (s.attributes.unit_of_measurement || "W").toLowerCase();
    return u === "kw" ? v * 1000 : v;
  }

  _minutes(id) {
    const s = id && this._hass.states[id];
    if (!s || ["unknown", "unavailable", ""].includes(s.state)) return null;
    const txt = s.state.trim();
    if (/^-?\d+(\.\d+)?$/.test(txt)) {
      const v = parseFloat(txt);
      const u = (s.attributes.unit_of_measurement || "h").toLowerCase();
      if (u === "s") return v / 60;
      if (u === "m" || u.startsWith("min")) return v;
      if (u.startsWith("d")) return v * 1440;
      return v * 60; // hours by default
    }
    const t = Date.parse(txt); // timestamp sensor
    if (!isNaN(t)) return Math.max(0, (t - Date.now()) / 60000);
    return null;
  }

  _fmt(mins) {
    const m = Math.round(mins);
    if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
    if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
    return `${m}m`;
  }

  _batteryIcon(soc, charging) {
    if (soc == null) return "mdi:battery-off-outline";
    const n = Math.round(soc / 10) * 10;
    if (charging) return n <= 0 ? "mdi:battery-charging-outline" : `mdi:battery-charging-${n}`;
    if (n >= 100) return "mdi:battery";
    if (n <= 0) return "mdi:battery-outline";
    return `mdi:battery-${n}`;
  }

  /* ------------------------------------------------------------------ */
  /* update                                                              */
  /* ------------------------------------------------------------------ */
  _update() {
    const c = this._config;
    const h = this._hass;
    const root = this.shadowRoot;

    // device offline if the availability entity says so
    const av = c.availability_entity && h.states[c.availability_entity];
    this._deviceOffline =
      !!c.availability_entity && (!av || ["off", "unavailable", "unknown"].includes(av.state));

    // availability: "offline" = device offline or every mapped reading unavailable
    const core = [c.soc, ...POWER_KEYS.map((k) => c[k])].filter(Boolean);
    const offline = this._deviceOffline || (core.length > 0 && core.every((id) => this._unavail(id)));
    const socBad = this._unavail(c.soc);

    // power nodes + flow lines
    const p = {};
    POWER_KEYS.forEach((k) => {
      p[k] = this._unavail(c[k]) ? null : this._power(c[k]);
      const active = p[k] != null && p[k] > 0;
      const n = root.querySelector(`.node[data-k="${k}"]`);
      n.style.setProperty("--c", COLORS[k]);
      const bad = this._unavail(c[k]);
      n.classList.toggle("active", active);
      n.classList.toggle("unavail", bad || !c[k]);
      n.querySelector(".num").textContent = bad ? "N/A" : p[k] == null ? "–" : Math.round(p[k]);
      root.querySelector(`.flow[data-k="${k}"]`).classList.toggle("on", active);
    });

    // SOC
    let soc = this._unavail(c.soc) ? null : this._power(c.soc);
    if (soc != null) soc = Math.max(0, Math.min(100, soc));
    const input = (p.dc_charging || 0) + (p.ac_charging || 0);
    const output = (p.dc_discharging || 0) + (p.ac_discharging || 0);
    const net = input - output;
    const state = net > 5 ? "charging" : net < -5 ? "discharging" : "idle";

    const ringColor = soc == null ? "#8e8e93" : soc >= 50 ? "#30d158" : soc >= 20 ? "#ff9f0a" : "#ff453a";
    const gauge = root.querySelector(".gauge");
    gauge.style.stroke = ringColor;
    gauge.setAttribute("stroke-dasharray", `${soc == null ? 0 : soc * 0.9999} 100`);
    gauge.style.opacity = soc ? 1 : 0;
    root.querySelector(".soc-num").textContent = soc == null ? "–" : Math.round(soc);
    const bat = root.querySelector(".bat");
    bat.setAttribute("icon", this._batteryIcon(soc, state === "charging"));
    bat.style.color = ringColor;

    // time left
    let text = "";
    if (state === "charging") {
      if (soc != null && soc >= 100) {
        text = "Fully charged";
      } else {
        let mins = this._minutes(c.time_to_full);
        if (!(mins > 0)) mins = this._minutes(c.time_remaining);
        if (!(mins > 0) && c.capacity_wh && soc != null) {
          mins = (((100 - soc) / 100) * c.capacity_wh / net) * 60;
        }
        if (mins > 0) text = `${this._fmt(mins)}\nto full`;
      }
    } else if (state === "discharging") {
      let mins = this._minutes(c.time_to_empty);
      if (!(mins > 0)) mins = this._minutes(c.time_remaining);
      if (!(mins > 0) && c.capacity_wh && soc != null) {
        mins = ((soc / 100) * c.capacity_wh / -net) * 60;
      }
      if (mins > 0) text = `${this._fmt(mins)}\nto empty`;
    }
    if (offline) text = "Device offline";
    else if (socBad) text = "Unavailable";
    root.querySelector(".time").textContent = text;

    // master power button
    const pw = root.querySelector(".power");
    pw.classList.toggle("hidden", !c.power_switch);
    if (c.power_switch) {
      const st = h.states[c.power_switch];
      pw.classList.toggle("on", !!st && st.state === "on" && !this._deviceOffline);
    }

    // AC / DC switches
    root.querySelectorAll("[data-sw]").forEach((row) => {
      const id = c[row.dataset.sw];
      row.classList.toggle("hidden", !id);
      if (!id) return;
      const st = h.states[id];
      const sw = row.querySelector("ha-switch");
      sw.checked = !!st && st.state === "on";
      sw.disabled = this._unavail(id);
      row.classList.toggle("pending", this._isPending(row.dataset.sw, st && st.state));
      row.classList.toggle("unavail", this._unavail(id));
    });

    // charging mode
    const modeRow = root.querySelector("[data-mode]");
    const mid = c.charging_mode;
    modeRow.classList.toggle("hidden", !mid);
    modeRow.classList.toggle("unavail", this._unavail(mid));
    if (mid) {
      const st = h.states[mid];
      const options = (st && st.attributes.options) || [];
      const key = mid + "|" + options.join("|");
      const box = root.querySelector(".modes");
      if (options.length && key !== this._modeKey) {  // keep old buttons while unavailable
        this._modeKey = key;
        box.textContent = "";
        options.forEach((o) => {
          const b = document.createElement("button");
          b.dataset.o = o;
          b.textContent = o.charAt(0).toUpperCase() + o.slice(1);
          box.appendChild(b);
        });
      }
      const pending = this._isPending("charging_mode", st && st.state);
      const target = pending ? this._pending.charging_mode.target : null;
      box.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("sel", !!st && b.dataset.o === st.state);
        b.classList.toggle("wait", pending && b.dataset.o === target);
        b.disabled = this._unavail(mid);
      });
    }

    // hide controls panel if nothing configured
    root.querySelector(".controls").classList.toggle(
      "hidden",
      !(c.ac_switch || c.dc_switch || c.charging_mode)
    );
  }
}

/* ==================================================================== */
/* Visual editor – entity matching                                      */
/* ==================================================================== */
const LABELS = {
  dc_charging: "DC charging power (PV / solar input)",
  ac_charging: "AC charging power (grid input)",
  dc_discharging: "DC discharging power (DC output)",
  ac_discharging: "AC discharging power (AC output)",
  soc: "State of charge (SOC)",
  time_remaining: "Time remaining (single sensor, optional)",
  time_to_full: "Time to full (optional)",
  time_to_empty: "Time to empty (optional)",
  capacity_wh: "Battery capacity, Wh (fallback time calculation, optional)",
  ac_switch: "AC output switch",
  dc_switch: "DC output switch",
  charging_mode: "Charging mode (select: silent / standard / turbo)",
  power_switch: "Power button switch (optional)",
  availability_entity: "Availability entity, e.g. 'Bluetti online' binary sensor (optional)",
  stale_after: "Mark readings unavailable if not updated for, seconds (optional)",
};

const SCHEMA = [
  { name: "dc_charging", selector: { entity: { domain: "sensor" } } },
  { name: "ac_charging", selector: { entity: { domain: "sensor" } } },
  { name: "dc_discharging", selector: { entity: { domain: "sensor" } } },
  { name: "ac_discharging", selector: { entity: { domain: "sensor" } } },
  { name: "soc", selector: { entity: { domain: "sensor" } } },
  { name: "time_remaining", selector: { entity: { domain: "sensor" } } },
  { name: "time_to_full", selector: { entity: { domain: "sensor" } } },
  { name: "time_to_empty", selector: { entity: { domain: "sensor" } } },
  {
    name: "capacity_wh",
    selector: { number: { min: 0, max: 100000, mode: "box", unit_of_measurement: "Wh" } },
  },
  { name: "ac_switch", selector: { entity: { domain: ["switch", "input_boolean"] } } },
  { name: "dc_switch", selector: { entity: { domain: ["switch", "input_boolean"] } } },
  { name: "charging_mode", selector: { entity: { domain: ["select", "input_select"] } } },
  { name: "power_switch", selector: { entity: { domain: ["switch", "input_boolean"] } } },
  { name: "availability_entity", selector: { entity: { domain: ["binary_sensor", "input_boolean"] } } },
  {
    name: "stale_after",
    selector: { number: { min: 0, max: 86400, mode: "box", unit_of_measurement: "s" } },
  },
];

class BluettiPowerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.schema = SCHEMA;
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = ev.detail.value;
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
  }
}

customElements.define("bluetti-power-card", BluettiPowerCard);
customElements.define("bluetti-power-card-editor", BluettiPowerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "bluetti-power-card",
  name: "Bluetti Power Card",
  description: "Power flow, SOC and controls for a Bluetti power station",
});
