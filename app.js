document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const photoUpload = document.getElementById("photo-upload");
  const fileNameDisplay = document.getElementById("file-name");
  const downloadBtn = document.getElementById("download-btn");
  const shareBtn = document.getElementById("share-btn");
  const actionsSection = document.getElementById("actions-section");
  const placeholderOverlay = document.getElementById("placeholder-overlay");
  const canvasWrapper = document.getElementById("canvas-wrapper");
  const canvas = document.getElementById("id-canvas");
  const ctx = canvas.getContext("2d");

  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");

  // UI Panels
  const detailsSection = document.getElementById("details-section");
  const photoTools = document.getElementById("photo-tools");
  const teamDetailsSection = document.getElementById("team-details-section");

  // Inputs
  const nameInput = document.getElementById("builder-name");
  const stackInput = document.getElementById("builder-stack");
  const titleDisplay = document.getElementById("builder-title");
  const titleDisplay2 = document.getElementById("builder-title-2");
  const clearTitle2Btn = document.getElementById("clear-title-2-btn");

  // Sliders
  const zoomSlider = document.getElementById("zoom-slider");
  const rotateSlider = document.getElementById("rotate-slider");
  const brightnessSlider = document.getElementById("brightness-slider");

  // --- State ---
  const state = {
    template: "builderID", // 'builderID' (Format B) or 'frame' (Format A)
    photo: null,
    transform: { zoom: 1, rotate: 0, x: 0, y: 0, flip: false },
    filters: { brightness: 1 },
    builderName: "",
    builderStack: "",
    builderTitle: "THE SHIPPER",
    builderTitle2: "FULL-STACK WIZARD",
    textOffsets: { roleY: 147, roleAngle: -8, t1Y: 179, t2Y: 247 },
    teamName: "",
    teamNameY: 968,
    teamPhotoRadius: 46,
    teamMembers: ["", "", ""],
    memberPos: [
      { x: 540, y: 1050 },
      { x: 540, y: 1120 },
      { x: 540, y: 1190 },
    ],
  };

  let generatedImageUrl = null;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let draggingLabel = -1; // index 0-2 for team member labels, -1 = photo drag

  // Preload Images
  const goaLogo = new Image();
  goaLogo.src = "goa_hindi.svg";
  goaLogo.onload = () => render();

  // Preload background images
  const bgBuilderID = new Image();
  bgBuilderID.src = "2.png";
  bgBuilderID.onload = () => render();

  const fgBuilderID = new Image();
  fgBuilderID.src = "3.png";
  fgBuilderID.onload = () => render();

  const bgPFP = new Image();
  bgPFP.src = "4.png";
  bgPFP.onload = () => render();

  const fgPFP = new Image();
  fgPFP.src = "5.png";
  fgPFP.onload = () => render();

  const bgTeamID = new Image();
  bgTeamID.src = "1.png";
  bgTeamID.onload = () => render();

  const BUILDER_TITLES = [
    "10X SHIPPER",
    "TERMINAL DWELLER",
    "PROTOCOL ARCHITECT",
    "VOID NAVIGATOR",
    "BASED BUILDER",
    "FULL-STACK WIZARD",
    "SYSTEMS SCHOLAR",
    "PIXEL PUSHER",
    "BASE-LAYER DEGEN",
    "RUST MAXI",
    "CSS WIZARD",
    "PROMPT ENGINEER",
    "AI OVERLORD",
  ];

  const HEIC_MIME_TYPES = new Set([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ]);

  function isHeicFile(file) {
    if (!file) return false;
    const fileType = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    return HEIC_MIME_TYPES.has(fileType) || /\.(heic|heif)$/i.test(fileName);
  }

  // Resize image blob to max 1600px before uploading — speeds up server conversion
  async function resizeHeicBeforeUpload(file) {
    // We can't decode HEIC in canvas directly, so just return as-is
    // heic-to will be used for conversion later
    // But cap at 15MB to avoid huge transfers
    if (file.size <= 15 * 1024 * 1024) return file;
    // If over 15MB, slice isn't valid for HEIC — just send it anyway
    return file;
  }

  // --- Camera Capture ---
  const cameraModal = document.getElementById("camera-modal");
  const cameraVideo = document.getElementById("camera-video");
  const snapCanvas = document.getElementById("camera-snap-canvas");
  let cameraStream = null;

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera not supported in this browser.");
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      cameraVideo.srcObject = cameraStream;
      cameraModal.classList.remove("hidden");
    } catch (err) {
      alert("Could not access camera: " + err.message);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.classList.add("hidden");
  }

  function snapPhoto() {
    snapCanvas.width = cameraVideo.videoWidth;
    snapCanvas.height = cameraVideo.videoHeight;
    snapCanvas.getContext("2d").drawImage(cameraVideo, 0, 0);
    snapCanvas.toBlob(
      (blob) => {
        closeCamera();
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          state.photo = img;
          resetTransform();
          if (placeholderOverlay) placeholderOverlay.classList.add("hidden");
          photoTools.classList.remove("hidden");
          actionsSection.classList.remove("hidden");
          fileNameDisplay.textContent = "Camera capture ✓";
          URL.revokeObjectURL(url);
          render();
        };
        img.src = url;
      },
      "image/jpeg",
      0.92,
    );
  }

  document.getElementById("capture-btn").addEventListener("click", openCamera);
  document.getElementById("snap-btn").addEventListener("click", snapPhoto);
  document
    .getElementById("close-camera-btn")
    .addEventListener("click", closeCamera);

  // Screens & Navigation
  const selectionScreen = document.getElementById("selection-screen");
  const workspaceScreen = document.getElementById("workspace-screen");
  const activeModeBadge = document.getElementById("active-mode-badge");
  const backBtn = document.getElementById("back-to-selection-btn");

  // --- Template Switching ---
  function setTemplate(template) {
    state.template = template;

    if (template === "teamID") {
      if (heroTitle) heroTitle.textContent = "TEAM ID GENERATOR";
      if (heroSubtitle)
        heroSubtitle.textContent =
          "Build together. Ship together. Generate your team card.";
      if (activeModeBadge) activeModeBadge.textContent = "TEAM ID CARD";
      detailsSection.classList.add("hidden");
      teamDetailsSection.classList.remove("hidden");
      if (canvasWrapper) {
        canvasWrapper.classList.remove("square");
        canvasWrapper.classList.add("portrait");
      }
      canvas.width = 1080;
      canvas.height = 1350;
    } else if (template === "frame") {
      if (heroTitle) heroTitle.textContent = "PFP FRAME GENERATOR";
      if (heroSubtitle)
        heroSubtitle.textContent =
          "Stand out on X. Wrap your photo in branded HH Goa 2026 vibes.";
      if (activeModeBadge) activeModeBadge.textContent = "PFP FRAME";
      detailsSection.classList.add("hidden");
      teamDetailsSection.classList.add("hidden");
      if (canvasWrapper) {
        canvasWrapper.classList.remove("portrait");
        canvasWrapper.classList.add("square");
      }
      canvas.width = 1080;
      canvas.height = 1080;
    } else {
      if (heroTitle) heroTitle.textContent = "BUILDER ID GENERATOR";
      if (heroSubtitle)
        heroSubtitle.textContent =
          "Less Noise. More Signal. Generate your official radar card.";
      if (activeModeBadge) activeModeBadge.textContent = "BUILDER ID CARD";
      detailsSection.classList.remove("hidden");
      teamDetailsSection.classList.add("hidden");
      if (canvasWrapper) {
        canvasWrapper.classList.remove("square");
        canvasWrapper.classList.add("portrait");
      }
      canvas.width = 1080;
      canvas.height = 1350;
    }

    if (state.photo) {
      photoTools.classList.remove("hidden");
    }

    render();
  }

  // --- Event Listeners ---
  // Handle Choice Buttons on Initial Screen
  document.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const template = btn.dataset.template;

      if (selectionScreen) selectionScreen.classList.add("hidden");
      if (workspaceScreen) workspaceScreen.classList.remove("hidden");

      setTemplate(template);
    });
  });

  // Handle Back to Choice Screen
  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (workspaceScreen) workspaceScreen.classList.add("hidden");
      if (selectionScreen) selectionScreen.classList.remove("hidden");

      if (heroTitle) heroTitle.textContent = "BUILDER ID & PFP FRAME GENERATOR";
      if (heroSubtitle)
        heroSubtitle.textContent =
          "Less Noise. More Signal. Select an option to start.";
    });
  }

  // Team inputs
  document.getElementById("team-name").addEventListener("input", (e) => {
    state.teamName = e.target.value;
    render();
  });
  [1, 2, 3].forEach((i) => {
    document
      .getElementById(`team-member-${i}`)
      .addEventListener("input", (e) => {
        state.teamMembers[i - 1] = e.target.value;
        render();
      });
  });

  // Inputs (Format B only)
  nameInput.addEventListener("input", (e) => {
    state.builderName = e.target.value;
    render();
  });
  stackInput.addEventListener("input", (e) => {
    state.builderStack = e.target.value;
    render();
  });

  document
    .getElementById("regenerate-title-btn")
    .addEventListener("click", (e) => {
      e.preventDefault();
      state.builderTitle =
        BUILDER_TITLES[Math.floor(Math.random() * BUILDER_TITLES.length)];
      titleDisplay.textContent = state.builderTitle;
      render();
    });

  document
    .getElementById("regenerate-title-2-btn")
    .addEventListener("click", (e) => {
      e.preventDefault();
      state.builderTitle2 =
        BUILDER_TITLES[Math.floor(Math.random() * BUILDER_TITLES.length)];
      titleDisplay2.textContent = state.builderTitle2;
      render();
    });

  if (clearTitle2Btn) {
    clearTitle2Btn.addEventListener("click", (e) => {
      e.preventDefault();
      state.builderTitle2 = "";
      titleDisplay2.textContent = "NONE";
      render();
    });
  }

  async function convertHeicToJpeg(file) {
    if (!isHeicFile(file)) return file;

    try {
      const possibleFns = [
        window.HeicTo,
        window.heicTo,
        window.HeicTo && window.HeicTo.heicTo,
        window.heicTo && window.heicTo.heicTo,
      ].filter(Boolean);

      for (const fn of possibleFns) {
        if (typeof fn !== "function") continue;

        const converted = await fn({
          blob: file,
          type: "image/jpeg",
          quality: 0.6,
        });

        const result = Array.isArray(converted) ? converted[0] : converted;
        if (result) return result;
      }
    } catch (err) {
      console.warn(
        "Browser HEIC conversion failed, using server fallback:",
        err,
      );
    }

    const formData = new FormData();
    formData.append("file", file, file.name);

    const liveServerPort = ["5500", "5501", "5502"].includes(window.location.port);
    const serverUrl = liveServerPort
      ? "http://localhost:8080/convert-heic"
      : "/convert-heic";

    const response = await fetch(serverUrl, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        payload.error || `HEIC conversion failed (${response.status})`,
      );
    }

    const buffer = await response.arrayBuffer();
    return new Blob([buffer], { type: "image/jpeg" });
  }

  // Photo Upload
  photoUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileNameDisplay.textContent = file.name;

    let blob = file;
    if (isHeicFile(file)) {
      let dots = 0;
      const ticker = setInterval(() => {
        dots = (dots + 1) % 4;
        fileNameDisplay.textContent = "Converting HEIC" + ".".repeat(dots);
      }, 400);

      try {
        blob = await convertHeicToJpeg(file);
        clearInterval(ticker);
        const outName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
        fileNameDisplay.textContent = outName + " ✓";
      } catch (err) {
        clearInterval(ticker);
        console.error("HEIC conversion error:", err);
        fileNameDisplay.textContent = `HEIC ERROR: ${err.message || err}`;
        return;
      }
    }

    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      state.photo = img;
      resetTransform();
      if (placeholderOverlay) placeholderOverlay.classList.add("hidden");
      photoTools.classList.remove("hidden");
      actionsSection.classList.remove("hidden");
      URL.revokeObjectURL(url);
      render();
    };
    img.onerror = () => {
      console.error("Failed to load image from converted blob");
      fileNameDisplay.textContent = "Error: Failed to load converted image";
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  // Sliders & Tools
  zoomSlider.addEventListener("input", (e) => {
    state.transform.zoom = parseFloat(e.target.value);
    render();
  });
  rotateSlider.addEventListener("input", (e) => {
    state.transform.rotate = parseInt(e.target.value);
    render();
  });
  brightnessSlider.addEventListener("input", (e) => {
    state.filters.brightness = parseFloat(e.target.value);
    render();
  });

  document.getElementById("auto-fit-btn").addEventListener("click", (e) => {
    e.preventDefault();
    state.transform.zoom = 1;
    state.transform.x = 0;
    state.transform.y = 0;
    zoomSlider.value = 1;
    render();
  });

  document.getElementById("flip-btn").addEventListener("click", (e) => {
    e.preventDefault();
    state.transform.flip = !state.transform.flip;
    render();
  });

  document.getElementById("reset-photo-btn").addEventListener("click", (e) => {
    e.preventDefault();
    resetTransform();
  });

  function resetTransform() {
    state.transform = { zoom: 1, rotate: 0, x: 0, y: 0, flip: false };
    state.filters = { brightness: 1 };
    zoomSlider.value = 1;
    rotateSlider.value = 0;
    brightnessSlider.value = 1;
    render();
  }

  // Helper: get canvas coords from event offset
  function toCanvasCoords(offsetX, offsetY) {
    const rect = canvas.getBoundingClientRect();
    return {
      cx: offsetX * (canvas.width / rect.width),
      cy: offsetY * (canvas.height / rect.height),
    };
  }

  // Helper: find which team label (if any) is near a canvas point
  function hitLabel(cx, cy) {
    if (state.template !== "teamID") return -1;
    const HIT = 60;
    for (let i = 0; i < 3; i++) {
      if (!state.teamMembers[i]) continue;
      const p = state.memberPos[i];
      if (Math.abs(cx - p.x) < 200 && Math.abs(cy - p.y) < HIT) return i;
    }
    return -1;
  }

  function hitPhoto(cx, cy) {
    if (!state.photo) return false;
    if (state.template === "frame") return true;
    if (state.template === "builderID") {
      return cx >= 299 && cx <= 774 && cy >= 388 && cy <= 842;
    }
    if (state.template === "teamID") {
      return cx >= 129 && cx <= 951 && cy >= 328 && cy <= 862;
    }
    return false;
  }

  // Canvas Dragging (photo + team labels)
  canvas.addEventListener("mousedown", (e) => {
    const { cx, cy } = toCanvasCoords(e.offsetX, e.offsetY);
    const lbl = hitLabel(cx, cy);
    if (lbl !== -1) {
      draggingLabel = lbl;
      dragStart = { x: e.offsetX, y: e.offsetY };
    } else if (hitPhoto(cx, cy)) {
      isDragging = true;
      dragStart = { x: e.offsetX, y: e.offsetY };
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = e.offsetX - dragStart.x;
    const dy = e.offsetY - dragStart.y;

    if (draggingLabel !== -1) {
      state.memberPos[draggingLabel].x += dx * scaleX;
      state.memberPos[draggingLabel].y += dy * scaleY;
      dragStart = { x: e.offsetX, y: e.offsetY };
      render();
    } else if (isDragging) {
      state.transform.x += dx * scaleX;
      state.transform.y += dy * scaleY;
      dragStart = { x: e.offsetX, y: e.offsetY };
      render();
    }
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    draggingLabel = -1;
  });
  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
    draggingLabel = -1;
  });

  // Touch events
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const ox = touch.clientX - rect.left;
      const oy = touch.clientY - rect.top;
      const { cx, cy } = toCanvasCoords(ox, oy);
      const lbl = hitLabel(cx, cy);
      if (lbl !== -1) {
        draggingLabel = lbl;
        dragStart = { x: ox, y: oy };
        e.preventDefault();
      } else if (hitPhoto(cx, cy)) {
        isDragging = true;
        dragStart = { x: ox, y: oy };
        e.preventDefault();
      }
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 1) return;
      if (draggingLabel !== -1 || isDragging) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const dx = touchX - dragStart.x;
      const dy = touchY - dragStart.y;

      if (draggingLabel !== -1) {
        state.memberPos[draggingLabel].x += dx * scaleX;
        state.memberPos[draggingLabel].y += dy * scaleY;
        dragStart = { x: touchX, y: touchY };
        render();
      } else if (isDragging) {
        state.transform.x += dx * scaleX;
        state.transform.y += dy * scaleY;
        dragStart = { x: touchX, y: touchY };
        render();
      }
    },
    { passive: false },
  );

  window.addEventListener("touchend", () => {
    isDragging = false;
    draggingLabel = -1;
  });

  const form = document.getElementById("generator-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  }

  // --- Main Render Dispatcher ---
  function render() {
    document.fonts.ready.then(() => {
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;
      if (state.template === "frame") renderFormatA(WIDTH, HEIGHT);
      else if (state.template === "teamID") renderFormatC(WIDTH, HEIGHT);
      else renderFormatB(WIDTH, HEIGHT);
      generatedImageUrl = canvas.toDataURL("image/png");
    });
  }

  // --- Format A: PFP Frame / Overlay ---
  function renderFormatA(WIDTH, HEIGHT) {
    // 1. Background
    ctx.drawImage(bgPFP, 0, 0, WIDTH, HEIGHT);

    // 2. Photo centered
    if (state.photo) {
      const img = state.photo;
      const imgRatio = img.width / img.height;
      const slotRatio = WIDTH / HEIGHT;
      let sW, sH;
      if (imgRatio > slotRatio) {
        sW = WIDTH * state.transform.zoom;
        sH = sW / imgRatio;
      } else {
        sH = HEIGHT * state.transform.zoom;
        sW = sH * imgRatio;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, HEIGHT);
      ctx.clip();
      ctx.translate(
        WIDTH / 2 + state.transform.x,
        HEIGHT / 2 + state.transform.y,
      );
      ctx.rotate((state.transform.rotate * Math.PI) / 180);
      if (state.transform.flip) ctx.scale(-1, 1);
      ctx.filter = `brightness(${state.filters.brightness})`;
      ctx.drawImage(img, -sW / 2, -sH / 2, sW, sH);
      ctx.restore();
    }

    // 3. Transparent overlay (5.png) on top
    if (fgPFP.complete && fgPFP.naturalWidth > 0) {
      ctx.drawImage(fgPFP, 0, 0, WIDTH, HEIGHT);
    }
  }

  // --- Format B: Builder ID Card ---
  // Photo slot: top-left (299, 388), size 475x454
  function renderFormatB(WIDTH, HEIGHT) {
    const pX = 299,
      pY = 388,
      pW = 475,
      pH = 454;

    // 1. Draw background
    ctx.drawImage(bgBuilderID, 0, 0, WIDTH, HEIGHT);

    // 2. Draw photo clipped to slot
    ctx.save();
    ctx.beginPath();
    ctx.rect(pX, pY, pW, pH);
    ctx.clip();
    if (state.photo) {
      const img = state.photo;
      const imgRatio = img.width / img.height;
      const slotRatio = pW / pH;
      let sW, sH;
      if (imgRatio > slotRatio) {
        sW = pW * state.transform.zoom;
        sH = sW / imgRatio;
      } else {
        sH = pH * state.transform.zoom;
        sW = sH * imgRatio;
      }
      ctx.translate(
        pX + pW / 2 + state.transform.x,
        pY + pH / 2 + state.transform.y,
      );
      ctx.rotate((state.transform.rotate * Math.PI) / 180);
      if (state.transform.flip) ctx.scale(-1, 1);
      ctx.filter = `brightness(${state.filters.brightness})`;
      ctx.drawImage(img, -sW / 2, -sH / 2, sW, sH);
    } else {
      ctx.fillStyle = "rgba(180,180,180,0.5)";
      ctx.fillRect(pX, pY, pW, pH);
      ctx.fillStyle = "#555";
      ctx.textAlign = "center";
      ctx.font = '700 26px "Space Mono", monospace';
      ctx.fillText("UPLOAD PHOTO", pX + pW / 2, pY + pH / 2 + 10);
    }
    ctx.restore();

    // 3. Draw transparent overlay (3.png) — tape sits over photo
    if (fgBuilderID.complete && fgBuilderID.naturalWidth > 0) {
      ctx.drawImage(fgBuilderID, 0, 0, WIDTH, HEIGHT);
    }

    drawBuilderIDText(pX, pY, pH, WIDTH);
  }

  // Shared Header
  function drawHeader(margin, titleColor, WIDTH) {
    ctx.fillStyle = titleColor;
    ctx.textAlign = "center";
    ctx.save();
    ctx.scale(1, 1.3);
    ctx.font = '400 115px "Playfair Display", serif';
    ctx.fillText("HACKER HOUSE", WIDTH / 2, (margin + 125) / 1.3);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    if (goaLogo.complete && goaLogo.naturalWidth > 0) {
      const logoWidth = 130;
      const logoHeight = (logoWidth / goaLogo.width) * goaLogo.height;
      ctx.drawImage(
        goaLogo,
        (WIDTH - logoWidth) / 2,
        margin + 95,
        logoWidth,
        logoHeight,
      );
    }
    ctx.restore();

    ctx.fillStyle = titleColor;
    ctx.font = '400 24px "Space Mono", monospace';
    ctx.fillText("GOA, INDIA · 28 - 31 OCT 2026", WIDTH / 2, margin + 200);
  }

  // Format B Photo Area
  function drawPhotoArea(x, y, size) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#fffbf0";

    let boxHeight = size + 160;
    ctx.fillRect(x - 30, y - 30, size + 60, boxHeight);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();

    if (state.photo) {
      const img = state.photo;
      const imgRatio = img.width / img.height;
      let sWidth, sHeight;
      if (imgRatio > 1) {
        sHeight = size;
        sWidth = sHeight * imgRatio;
      } else {
        sWidth = size;
        sHeight = sWidth / imgRatio;
      }

      ctx.translate(
        x + size / 2 + state.transform.x,
        y + size / 2 + state.transform.y,
      );
      ctx.rotate((state.transform.rotate * Math.PI) / 180);
      ctx.scale(state.transform.zoom, state.transform.zoom);
      if (state.transform.flip) {
        ctx.scale(-1, 1);
      }
      ctx.filter = `brightness(${state.filters.brightness})`;
      ctx.drawImage(img, -sWidth / 2, -sHeight / 2, sWidth, sHeight);
    } else {
      ctx.fillStyle = "#ddd";
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "#999";
      ctx.textAlign = "center";
      ctx.font = '700 32px "Space Mono", monospace';
      ctx.fillText("NO PHOTO", x + size / 2, y + size / 2 + 10);
    }
    ctx.restore();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
  }

  // Format B Text Fields — positioned below the photo slot (slot bottom = y:842)
  function drawBuilderIDText(pX, pY, pH, WIDTH) {
    const slotBottom = pY + pH; // 842
    ctx.textAlign = "center";
    ctx.font = '700 48px "Space Mono", monospace';
    ctx.fillStyle = "#f8e31a";
    ctx.fillText(
      (state.builderName || "NAME").toUpperCase(),
      WIDTH / 2,
      slotBottom + 70,
    );

    ctx.font = '700 34px "Space Mono", monospace';
    ctx.fillStyle = "#116c3b";
    ctx.save();
    ctx.translate(WIDTH / 2, slotBottom + state.textOffsets.roleY);
    ctx.rotate((state.textOffsets.roleAngle * Math.PI) / 180);
    ctx.fillText((state.builderStack || "ROLE").toUpperCase(), 0, 0);
    ctx.restore();

    ctx.font = '700 30px "Space Mono", monospace';
    const titleText = state.builderTitle;
    if (titleText && titleText.trim() !== "") {
      const tw = ctx.measureText(titleText).width + 60;
      const lh = 54;
      const lx = (WIDTH - tw) / 2;
      const ly = slotBottom + state.textOffsets.t1Y;
      ctx.fillStyle = "#ec0d68";
      ctx.fillRect(lx, ly, tw, lh);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(lx, ly, tw, lh);
      ctx.fillStyle = "#000000";
      ctx.fillText(titleText, WIDTH / 2, ly + lh / 2 + 10);
    }
    const titleText2 = state.builderTitle2;
    if (titleText2 && titleText2.trim() !== "" && titleText2 !== "NONE") {
      const tw2 = ctx.measureText(titleText2).width + 60;
      const lh = 54;
      const lx2 = (WIDTH - tw2) / 2;
      const ly2 = slotBottom + state.textOffsets.t2Y;
      ctx.fillStyle = "#f8e31a";
      ctx.fillRect(lx2, ly2, tw2, lh);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(lx2, ly2, tw2, lh);
      ctx.fillStyle = "#116c3b";
      ctx.fillText(titleText2, WIDTH / 2, ly2 + lh / 2 + 10);
    }
  }

  // --- Format C: Team ID Card ---
  // Photo slot in 1.png: x:129-951, y:328-862 (822x534)
  function renderFormatC(WIDTH, HEIGHT) {
    ctx.drawImage(bgTeamID, 0, 0, WIDTH, HEIGHT);

    const pX = 129,
      pY = 328,
      pW = 822,
      pH = 534;
    const r = state.teamPhotoRadius;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pX + r, pY);
    ctx.arcTo(pX + pW, pY, pX + pW, pY + pH, r);
    ctx.arcTo(pX + pW, pY + pH, pX, pY + pH, r);
    ctx.arcTo(pX, pY + pH, pX, pY, r);
    ctx.arcTo(pX, pY, pX + pW, pY, r);
    ctx.closePath();
    ctx.clip();
    if (state.photo) {
      const img = state.photo;
      const imgRatio = img.width / img.height;
      const slotRatio = pW / pH;
      let sW, sH;
      if (imgRatio > slotRatio) {
        sH = pH * state.transform.zoom;
        sW = sH * imgRatio;
      } else {
        sW = pW * state.transform.zoom;
        sH = sW / imgRatio;
      }
      ctx.translate(
        pX + pW / 2 + state.transform.x,
        pY + pH / 2 + state.transform.y,
      );
      ctx.rotate((state.transform.rotate * Math.PI) / 180);
      if (state.transform.flip) ctx.scale(-1, 1);
      ctx.filter = `brightness(${state.filters.brightness})`;
      ctx.drawImage(img, -sW / 2, -sH / 2, sW, sH);
    } else {
      ctx.fillStyle = "rgba(180,180,180,0.5)";
      ctx.fillRect(pX, pY, pW, pH);
      ctx.fillStyle = "#555";
      ctx.textAlign = "center";
      ctx.font = '700 26px "Space Mono", monospace';
      ctx.fillText("UPLOAD PHOTO", pX + pW / 2, pY + pH / 2 + 10);
    }
    ctx.restore();

    // Team name in green box below photo
    if (state.teamName) {
      ctx.textAlign = "center";
      ctx.font = '700 54px "Space Mono", monospace';
      ctx.fillStyle = "#f8e31a";
      ctx.fillText(state.teamName.toUpperCase(), WIDTH / 2, state.teamNameY);
    }

    // Draggable member name labels drawn on top
    ctx.font = '700 38px "Space Mono", monospace';
    state.teamMembers.forEach((name, i) => {
      if (!name) return;
      const label = name.toUpperCase();
      const lw = ctx.measureText(label).width + 60;
      const lh = 54;
      const lx = state.memberPos[i].x - lw / 2;
      const ly = state.memberPos[i].y - lh + 10;
      ctx.fillStyle = i === 0 ? "#ec0d68" : i === 1 ? "#f8e31a" : "#ffffff";
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeRect(lx, ly, lw, lh);
      ctx.fillStyle = i === 1 ? "#116c3b" : "#000000";
      ctx.textAlign = "center";
      ctx.fillText(label, state.memberPos[i].x, state.memberPos[i].y);
    });
  }

  // Shared Footer Badge
  function drawFooterBadge(text, margin, WIDTH, HEIGHT) {
    ctx.fillStyle = "#f8e31a";
    ctx.fillRect(WIDTH - margin - 220, HEIGHT - margin - 80, 180, 60);

    ctx.strokeStyle = "#ec0d68";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(WIDTH - margin - 216, HEIGHT - margin - 76, 172, 52);
    ctx.setLineDash([]);

    ctx.fillStyle = "#116c3b";
    ctx.textAlign = "center";
    ctx.font = '700 22px "Space Mono", monospace';
    ctx.fillText(text, WIDTH - margin - 130, HEIGHT - margin - 42);

    ctx.textAlign = "left";
  }

  // Download Handler
  downloadBtn.addEventListener("click", () => {
    if (!generatedImageUrl) return;
    const a = document.createElement("a");
    a.href = generatedImageUrl;
    const prefix =
      state.template === "frame"
        ? "HH_GOA_PFP_FRAME"
        : state.template === "teamID"
          ? "HH_GOA_TEAM_ID"
          : "HH_GOA_BUILDER_ID";
    a.download = `${prefix}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // Share to X Handler
  shareBtn.addEventListener("click", () => {
    const textStr =
      state.template === "frame"
        ? "Just framed my profile picture for HH Goa 2026! 🌴🌊\n\nCreate yours at hhgoa.com\n\n#FrameInGoa"
        : "Just claimed my official HH Goa 2026 Builder ID. Let's ship. 🚢🔥\n\nCheck your radar at hhgoa.com\n\n#FrameInGoa";
    const text = encodeURIComponent(textStr);
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, "_blank");
  });

  // Initial Header Title for selection screen
  if (heroTitle) heroTitle.textContent = "BUILDER ID & PFP FRAME GENERATOR";
  if (heroSubtitle)
    heroSubtitle.textContent =
      "Less Noise. More Signal. Select an option to start.";
});
