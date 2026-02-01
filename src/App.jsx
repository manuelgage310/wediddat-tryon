import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * We Did Dat Try-On (Barber Only)
 * - PIN gate
 * - Works on Android phone + Samsung tablet later (PWA)
 * - Option B: server renders a finished JPG, then app shares it
 */

const STYLES = [
  { id: "low-taper", name: "Low Taper Fade", tags: ["clean", "everyday"] },
  { id: "mid-fade", name: "Mid Fade", tags: ["sharp", "modern"] },
  { id: "high-fade", name: "High Fade", tags: ["bold", "crisp"] },
  { id: "drop-fade", name: "Drop Fade", tags: ["trendy", "clean"] },
  { id: "burst-fade", name: "Burst Fade", tags: ["modern", "fresh"] },
  { id: "temple-fade", name: "Temple Fade (Brook)", tags: ["classic", "clean"] },
  { id: "bald-fade", name: "Skin / Bald Fade", tags: ["ultra clean", "sharp"] },
  { id: "waves-lineup", name: "360 Waves + Lineup", tags: ["waves", "lineup"] },
  { id: "curly-top-taper", name: "Curly Top + Taper", tags: ["texture", "taper"] },
  { id: "afro-taper", name: "Afro Taper", tags: ["natural", "clean"] },
  { id: "sponge-twists", name: "Sponge Twists + Taper", tags: ["twists", "taper"] },
  { id: "two-strand-twists", name: "Two-Strand Twists", tags: ["protective", "style"] },
];

function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) return void setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function Card({ children }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(10,10,12,0.55)",
      borderRadius: 18,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)"
    }}>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.25)",
      fontSize: 12,
      color: "rgba(255,255,255,0.85)"
    }}>{children}</span>
  );
}

function Button({ children, onClick, disabled, variant = "primary", title }) {
  const base = {
    width: "100%",
    borderRadius: 16,
    padding: "12px 14px",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.10)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "transform .08s ease",
  };
  const styles =
    variant === "primary"
      ? { ...base, background: "rgba(16, 185, 129, 0.95)", color: "#08110c", border: "0" }
      : { ...base, background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.9)" };

  return (
    <button
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={styles}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.99)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

export default function App() {
  // PIN gate
  const APP_PIN = "2330";
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);

  // PWA install prompt
  const [installEvt, setInstallEvt] = useState(null);
  const [isKiosk, setIsKiosk] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Photo + style
  const [selfieFile, setSelfieFile] = useState(null);
  const selfieUrl = useObjectUrl(selfieFile);

  const [selectedStyleId, setSelectedStyleId] = useState(STYLES[0].id);
  const selectedStyle = useMemo(
    () => STYLES.find((s) => s.id === selectedStyleId) || STYLES[0],
    [selectedStyleId]
  );

  // Render (Option B)
  const API_BASE = ""; // same-origin; set to https://api.yourdomain.com if separate
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

  const imgRef = useRef(null);
  const canPreview = Boolean(selfieUrl);

  async function sendToMyPhone() {
    if (!selfieFile) {
      setRenderError("Add a selfie first.");
      return;
    }

    setRenderError(null);
    setRendering(true);

    try {
      // 1) Create render job
      const fd = new FormData();
      fd.append("image", selfieFile);
      fd.append("styleId", selectedStyle.id);
      fd.append("format", "jpg");

      const createRes = await fetch(`${API_BASE}/api/render`, { method: "POST", body: fd });
      if (!createRes.ok) throw new Error(`Render request failed (${createRes.status}).`);

      const createData = await createRes.json();
      const jobId = createData.jobId;
      if (!jobId) throw new Error("No jobId returned.");

      // 2) Poll status
      const started = Date.now();
      const TIMEOUT_MS = 60_000;
      let resultUrl = null;

      while (Date.now() - started < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 900));
        const statusRes = await fetch(`${API_BASE}/api/render/${jobId}`);
        if (!statusRes.ok) throw new Error(`Status check failed (${statusRes.status}).`);

        const s = await statusRes.json();
        if (s.status === "done" && s.resultUrl) {
          resultUrl = s.resultUrl;
          break;
        }
        if (s.status === "failed") throw new Error(s.error || "Render failed.");
      }

      if (!resultUrl) throw new Error("Render timed out. Try again.");

      // 3) Download finished JPG and share
      const imgRes = await fetch(resultUrl);
      if (!imgRes.ok) throw new Error("Could not download finished image.");
      const blob = await imgRes.blob();

      const file = new File([blob], `wediddat-preview-${selectedStyle.id}.jpg`, { type: "image/jpeg" });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({
            title: "We Did Dat Preview",
            text: `We Did Dat Barbershop • ${selectedStyle.name}`,
            files: [file],
          });

          // Privacy: auto-delete selfie after export/share
          setSelfieFile(null);
          return;
        } catch {
          // user cancelled -> fall through to download
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);

      // Privacy: auto-delete selfie after export/download
      setSelfieFile(null);
    } catch (e) {
      setRenderError(e?.message || "Something went wrong.");
    } finally {
      setRendering(false);
    }
  }

  const bg = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #050506 0%, #0b0b0c 30%, #050506 100%)",
    color: "rgba(255,255,255,0.92)",
    padding: 16,
  };

  if (!unlocked) {
    return (
      <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <Card>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>We Did Dat • Barber Only</div>
            <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800 }}>Enter PIN</div>
            <div style={{ marginTop: 8, fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
              This app is locked for staff use only.
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <input
                value={pin}
                inputMode="numeric"
                placeholder="2330"
                onChange={(e) => {
                  setPinError(false);
                  setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                }}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: pinError ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.25)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              />
              <button
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  fontWeight: 800,
                  border: 0,
                  background: "rgba(16, 185, 129, 0.95)",
                  color: "#08110c",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (pin === APP_PIN) {
                    setUnlocked(true);
                    setPin("");
                  } else {
                    setPinError(true);
                  }
                }}
              >
                Unlock
              </button>
            </div>

            {pinError && <div style={{ marginTop: 10, color: "rgba(252,165,165,0.95)" }}>Wrong PIN. Try again.</div>}

            <div style={{ marginTop: 16, fontSize: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.20)", color: "rgba(255,255,255,0.75)" }}>
              Tip: When you get your Samsung tablet, open the same link and tap <b>Install</b> to add it to the home screen.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={bg}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "6px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.3 }}>We Did Dat Try-On</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
              Barber-only consult tool • PIN protected • Send finished JPG to your phone
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>#PrecisionModeActivated</Pill>
            <Pill>We Did Dat Barbershop</Pill>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: isKiosk ? "1fr" : "1.05fr 1.5fr", gap: 14 }}>
          <Card>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 18, fontWeight: 850 }}>1) Add your photo</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setIsKiosk((v) => !v)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: isKiosk ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.9)",
                    cursor: "pointer",
                  }}
                  title="Bigger layout for tablet"
                >
                  {isKiosk ? "Kiosk: ON" : "Kiosk: OFF"}
                </button>

                <button
                  disabled={!installEvt}
                  onClick={async () => {
                    if (!installEvt) return;
                    installEvt.prompt();
                    try { await installEvt.userChoice; } finally { setInstallEvt(null); }
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    color: installEvt ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
                    cursor: installEvt ? "pointer" : "not-allowed",
                    opacity: installEvt ? 1 : 0.6,
                  }}
                  title="Android only"
                >
                  {installEvt ? "Install App" : "Install (Android)"}
                </button>

                <button
                  onClick={() => setUnlocked(false)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.9)",
                    cursor: "pointer",
                  }}
                >
                  Lock
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.70)" }}>Upload / take selfie</label>
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                style={{ marginTop: 8, width: "100%" }}
              />
              <div style={{ marginTop: 10, fontSize: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.20)", color: "rgba(255,255,255,0.75)" }}>
                Tip: Face the camera, good lighting, no heavy angles.
              </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 18, fontWeight: 850 }}>2) Pick a style</div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: isKiosk ? "1fr" : "1fr 1fr", gap: 10 }}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyleId(s.id)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 16,
                    border: selectedStyleId === s.id ? "1px solid rgba(16,185,129,0.65)" : "1px solid rgba(255,255,255,0.08)",
                    background: selectedStyleId === s.id ? "rgba(16,185,129,0.10)" : "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.92)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{s.name}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {s.tags.map((t) => (
                      <span key={t} style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.80)",
                      }}>{t}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              <b>Note:</b> This Option B build expects your server to return the finished JPG. (We’ll wire that up on Netlify.)
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 18, fontWeight: 850 }}>Preview</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>Style: <b>{selectedStyle.name}</b></div>
            </div>

            <div style={{ marginTop: 12 }}>
              {!canPreview ? (
                <div style={{ borderRadius: 16, border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.15)", padding: 28, textAlign: "center", color: "rgba(255,255,255,0.75)" }}>
                  Upload a selfie to start.
                </div>
              ) : (
                <div style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", aspectRatio: "4 / 5", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#000" }}>
                  <img
                    ref={imgRef}
                    src={selfieUrl}
                    alt="Selfie"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", left: 12, top: 12 }}>
                    <Pill>We Did Dat Barbershop</Pill>
                  </div>
                  <div style={{ position: "absolute", right: 12, bottom: 12 }}>
                    <Pill>#PrecisionModeActivated</Pill>
                  </div>
                </div>
              )}
            </div>

            {renderError && (
              <div style={{ marginTop: 12, borderRadius: 14, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.10)", padding: 12, color: "rgba(254,202,202,0.95)" }}>
                {renderError}
              </div>
            )}

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: isKiosk ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
              <Button
                variant="primary"
                disabled={!canPreview || rendering}
                onClick={sendToMyPhone}
                title="Renders a finished JPG on the server, then shares it."
              >
                {rendering ? "Rendering…" : "Send to My Phone"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => setSelfieFile(null)}
                disabled={rendering}
                title="Clears the photo (privacy)."
              >
                Clear Photo
              </Button>

              <Button
                variant="secondary"
                onClick={() => setIsKiosk((v) => !v)}
                disabled={rendering}
                title="Toggle tablet layout."
              >
                Toggle Kiosk
              </Button>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.20)", color: "rgba(255,255,255,0.75)" }}>
              <b>Tablet-ready:</b> When you get your Samsung tablet, open this same link in Chrome and tap <b>Install</b>.
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          © We Did Dat Barbershop • Barber-only • Auto-delete after export enabled
        </div>
      </div>
    </div>
  );
}