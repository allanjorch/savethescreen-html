(function (global) {
  const SAVERS = [
    { key: "1", id: "veil", href: "veil.html", name: "Veil" },
    { key: "2", id: "drift", href: "drift.html", name: "Drift" },
    { key: "3", id: "ember", href: "ember.html", name: "Ember" },
    { key: "4", id: "bodies", href: "bodies.html", name: "Bodies" },
    { key: "5", id: "shoal", href: "shoal.html", name: "Shoal" },
    { key: "6", id: "gloam", href: "gloam.html", name: "Gloam" },
    { key: "7", id: "cinder", href: "cinder.html", name: "Cinder" },
    { key: "8", id: "murk", href: "murk.html", name: "Murk" },
    { key: "9", id: "wisp", href: "wisp.html", name: "Wisp" },
    { key: "0", id: "silt", href: "silt.html", name: "Silt" },
  ];

  const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

  const PAD = 28;

  function isEmbed() {
    return new URLSearchParams(location.search).has("embed");
  }

  function saverFromKey(key) {
    if (key === "0") return SAVERS[9];
    const n = Number(key);
    if (n >= 1 && n <= 9) return SAVERS[n - 1];
    return null;
  }

  function isGalleryKey(event) {
    return (
      event.code === "Backquote" ||
      event.key === "½" ||
      event.key === "§" ||
      event.key === "`" ||
      event.key === "~"
    );
  }

  function querySuffix() {
    const params = new URLSearchParams(location.search);
    params.delete("embed");
    const text = params.toString();
    return text ? "?" + text : "";
  }

  function quality(embed) {
    const q = new URLSearchParams(location.search).get("q");
    if (embed) return { fps: 8, maxLong: 320 };
    if (q === "high") return { fps: 60, maxLong: 2560 };
    if (q === "low") return { fps: 20, maxLong: 1280 };
    return { fps: 30, maxLong: 1600 };
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  function program(gl, frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p));
    }
    return p;
  }

  function showError(message) {
    const el = document.getElementById("error");
    if (!el) return;
    el.style.display = "grid";
    el.textContent = message;
  }

  function fit(canvas, gl, embed, maxLong) {
    const pad = embed ? 0 : PAD;
    const cssW = window.innerWidth + pad * 2;
    const cssH = window.innerHeight + pad * 2;
    const scale = Math.min(1, maxLong / Math.max(cssW, cssH));
    const w = Math.max(1, Math.round(cssW * scale));
    const h = Math.max(1, Math.round(cssH * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.style.left = -pad + "px";
      canvas.style.top = -pad + "px";
      gl.viewport(0, 0, w, h);
    }
    return { w: canvas.width, h: canvas.height };
  }

  async function goFullscreen() {
    const root = document.documentElement;
    if (document.fullscreenElement) return;
    try {
      await root.requestFullscreen({ navigationUI: "hide" });
    } catch (err) {
      try {
        await root.requestFullscreen();
      } catch (err2) {
        /* browser or window manager blocked it; maximized still works */
      }
    }
  }

  function boot(opts) {
    const embed = isEmbed();
    const q = quality(embed);
    const canvas = document.getElementById("stage");
    const hud = document.getElementById("hud");
    document.body.classList.add("saver");
    if (embed) document.body.classList.add("embed");

    const glOpts = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    };
    const gl =
      canvas.getContext("webgl", Object.assign({ desynchronized: true }, glOpts)) ||
      canvas.getContext("webgl", glOpts);

    if (!gl) {
      showError("WebGL is unavailable in this browser.");
      return;
    }

    let prog;
    try {
      prog = program(gl, opts.fragment);
    } catch (err) {
      showError("Shader failed to compile.\n" + err.message);
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");

    let idleTimer = 0;
    function pokeUi() {
      if (embed) return;
      document.body.classList.add("show-ui");
      hud.classList.remove("idle");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        document.body.classList.remove("show-ui");
        hud.classList.add("idle");
      }, 2800);
    }

    if (!embed && hud) {
      const brand = hud.querySelector(".brand");
      const title = hud.querySelector(".title");
      const hint = hud.querySelector(".hint");
      if (brand && opts.n) brand.textContent = "Save the Screen · " + opts.n + " of 10";
      if (title && opts.name) title.textContent = opts.name;
      if (hint) {
        hint.textContent =
          "Click or press F for fullscreen · 1–0 to switch · ½ back to the gallery";
      }
      pokeUi();
      window.setTimeout(() => hud.classList.add("idle"), 4200);
      window.addEventListener("mousemove", pokeUi, { passive: true });
      window.addEventListener("pointerdown", pokeUi, { passive: true });
    }

    window.addEventListener("keydown", (event) => {
      if (isGalleryKey(event)) {
        event.preventDefault();
        if (!embed) location.href = "index.html" + querySuffix();
        return;
      }
      const next = saverFromKey(event.key);
      if (next) {
        const suffix = new URLSearchParams(location.search).toString();
        const query = suffix ? "?" + suffix : "";
        if (!location.pathname.endsWith("/" + next.href) && !location.pathname.endsWith(next.href)) {
          location.href = next.href + query;
        }
        return;
      }
      if (embed) return;
      if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else goFullscreen();
      }
      if (event.key === "Escape") pokeUi();
    });

    if (!embed) {
      window.addEventListener("click", () => {
        goFullscreen();
      });
      window.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    let start = performance.now();
    let size = fit(canvas, gl, embed, q.maxLong);
    window.addEventListener("resize", () => {
      size = fit(canvas, gl, embed, q.maxLong);
    });

    const frameMs = 1000 / q.fps;
    let timeoutId = 0;

    function draw(now) {
      gl.uniform2f(uRes, size.w, size.h);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function stopLoop() {
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    }

    function startLoop() {
      if (timeoutId) return;
      const step = () => {
        timeoutId = 0;
        if (document.hidden) return;
        draw(performance.now());
        timeoutId = window.setTimeout(step, frameMs);
      };
      step();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    startLoop();
  }

  global.SaveScreen = { boot, SAVERS, saverFromKey, isGalleryKey };
})(window);
