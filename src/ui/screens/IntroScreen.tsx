import { useEffect, useState, useRef, useCallback } from "react";
import "./IntroScreen.css";

interface IntroScreenProps {
  onStart: () => void;
}

// page flash
function pageFlash() {
  document.body.animate(
    [
      { filter: "brightness(1)" },
      { filter: "brightness(1.8)" },
      { filter: "brightness(1)" },
    ],
    { duration: 700, easing: "ease-out" },
  );
}

export function IntroScreen({ onStart }: IntroScreenProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const [coolVal, setCoolVal] = useState(42);
  const [coolBarW, setCoolBarW] = useState(40);
  const [oreVal, setOreVal] = useState(412);
  const [oreBarW, setOreBarW] = useState(55);
  const [showRipple, setShowRipple] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  // Scale 1448×1086 frame to fit viewport
  // useEffect(() => {
  //   const fit = () => {
  //     const sx = window.innerWidth / 1448;
  //     const sy = window.innerHeight / 1086;
  //     setScale(Math.min(sx, sy));
  //   };
  //   fit();
  //   window.addEventListener('resize', fit);
  //   return () => window.removeEventListener('resize', fit);
  // }, []);

  // Wiggle live stat values
  useEffect(() => {
    const t1 = setInterval(() => {
      const v = 38 + Math.round(Math.random() * 10);
      setCoolVal(v);
      setCoolBarW((v - 30) * 4);
    }, 2200);
    const t2 = setInterval(() => {
      const v = 405 + Math.round(Math.random() * 20);
      setOreVal(v);
      setOreBarW(Math.round((v / 750) * 100));
    }, 2600);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  function animateTitle() {
    titleRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.03)" },
        { transform: "scale(1)" },
      ],
      { duration: 500, easing: "ease-out" },
    );
  }

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleStart();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(() => {
    setShowRipple(true);
    pageFlash();
    animateTitle();
    setTimeout(() => onStart(), 800);
  }, [onStart]);

  const toggleHotspot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveHotspot((prev) => (prev === id ? null : id));
  };

  return (
    <div className="is-stage" onClick={() => setActiveHotspot(null)}>
      <div className="is-frame">
        {/* Background */}
        <div className="is-bg" />
        <div className="is-vignette" />
        <div className="is-grain" />
        <div className="is-scan" />

        {/* Corner brackets */}
        <div className="is-bracket is-tl" />
        <div className="is-bracket is-tr" />
        <div className="is-bracket is-bl" />
        <div className="is-bracket is-br" />

        {/* HUD top */}
        <div className="is-hud-top">
          <div className="is-l">
            <div className="is-pill is-cyan">
              <span className="is-dot" />
              Sector 07 // Cavern B-12
            </div>
            <div style={{ opacity: 0.55 }}>N 14°22′ · 0.82 atm · O₂ 19.4%</div>
          </div>
          <div className="is-r">
            <div className="is-pill">
              <span className="is-dot" />
              Unit M-07 «PANGOLIN» · online
            </div>
            <div style={{ opacity: 0.55 }}>
              Ore veins detected ·{" "}
              <span style={{ color: "var(--is-amber)" }}>14</span>
            </div>
          </div>
        </div>

        {/* Title block */}
        <div className="is-title-block">
          <div className="is-kicker">
            A subterranean mining saga
            <span className="is-dot" />
            2026
          </div>
          <div className="is-title" ref={titleRef}>
            DRONE&nbsp;LOOP
          </div>
          <div className="is-sub">
            Dig deep&nbsp;&nbsp;·&nbsp;&nbsp;Refine the <b>ore</b>
            &nbsp;&nbsp;·&nbsp;&nbsp;Survive the dark
          </div>
        </div>

        {/* Hotspot 1 — Optical scanner */}
        <div
          className={`is-hotspot is-cyan${activeHotspot === "eye" ? " is-active" : ""}`}
          style={{ left: "51%", top: "36%" }}
          onClick={(e) => toggleHotspot("eye", e)}
        >
          <div className="is-ring" />
          <div className="is-core" />
        </div>
        <div className="is-callout is-cyan" style={{ left: "53%", top: "30%" }}>
          <div className="is-stem" />
          <div className="is-panel">
            <div className="is-tag">
              <span>// 01 · Optic</span>
              <span>SCAN</span>
            </div>
            <h4>HALO-IV Lens</h4>
            <p>
              Adaptive plasma optic. Maps ore veins through 14 m of cold rock
              and reads thermal signatures.
            </p>
            <div className="is-bars">
              <div className="is-b">
                <i style={{ width: "82%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "64%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "91%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Hotspot 2 — Floodlight */}
        <div
          className={`is-hotspot${activeHotspot === "lamp" ? " is-active" : ""}`}
          style={{ left: "28%", top: "21%" }}
          onClick={(e) => toggleHotspot("lamp", e)}
        >
          <div className="is-ring" />
          <div className="is-core" />
        </div>
        <div className="is-callout" style={{ left: "6%", top: "14%" }}>
          <div className="is-stem is-left" />
          <div className="is-panel">
            <div className="is-tag">
              <span>// 02 · Floodlight</span>
              <span>ON</span>
            </div>
            <h4>Tungsten Beam Mk.II</h4>
            <p>
              4800-lumen swivel cone. Cuts spore dust and lights ore deposits up
              to 30 m ahead.
            </p>
            <div className="is-bars">
              <div className="is-b">
                <i style={{ width: "88%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "88%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "88%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Hotspot 3 — Grapple claw */}
        <div
          className={`is-hotspot is-orange${activeHotspot === "claw" ? " is-active" : ""}`}
          style={{ left: "75%", top: "67%" }}
          onClick={(e) => toggleHotspot("claw", e)}
        >
          <div className="is-ring" />
          <div className="is-core" />
        </div>
        <div
          className="is-callout is-orange"
          style={{ left: "49%", top: "46%" }}
        >
          <div className="is-stem" />
          <div className="is-panel">
            <div className="is-tag">
              <span>// 03 · Manipulator</span>
              <span>READY</span>
            </div>
            <h4>Hydraulic Pincer</h4>
            <p>
              Three-finger grapple rated at 2.4 ton crush. Carbide tips chip raw
              veins straight off the wall.
            </p>
            <div className="is-bars">
              <div className="is-b">
                <i style={{ width: "72%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "55%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "48%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Hotspot 4 — Tracks */}
        {/* <div
          className={`is-hotspot${activeHotspot === "tracks" ? " is-active" : ""}`}
          style={{ left: "46%", top: "72%" }}
          onClick={(e) => toggleHotspot("tracks", e)}
        >
          <div className="is-ring" />
          <div className="is-core" />
        </div>
        <div className="is-callout" style={{ left: "25%", top: "78%" }}>
          <div className="is-stem is-left" />
          <div className="is-panel">
            <div className="is-tag">
              <span>// 04 · Chassis</span>
              <span>DUAL TRACK</span>
            </div>
            <h4>Crawler Mk.7</h4>
            <p>
              Twin reinforced treads with thermal grousers. Climbs 38° slopes
              and ignores ankle-deep rubble.
            </p>
            <div className="is-bars">
              <div className="is-b">
                <i style={{ width: "65%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "90%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "78%" }} />
              </div>
            </div>
          </div>
        </div> */}

        {/* Hotspot 5 — Ore deposit */}
        {/* <div
          className={`is-hotspot is-orange${activeHotspot === "ore" ? " is-active" : ""}`}
          style={{ left: "38%", top: "88%" }}
          onClick={(e) => toggleHotspot("ore", e)}
        >
          <div className="is-ring" />
          <div className="is-core" />
        </div>
        <div
          className="is-callout is-orange"
          style={{ left: "18%", top: "80%" }}
        >
          <div className="is-stem is-left" />
          <div className="is-panel">
            <div className="is-tag">
              <span>// 05 · Resource</span>
              <span>HOT</span>
            </div>
            <h4>Pyric Crystal</h4>
            <p>
              Self-heating ore. Smelts into Core Plasma — the only fuel
              deep-cavern reactors accept.
            </p>
            <div className="is-bars">
              <div className="is-b">
                <i style={{ width: "94%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "77%" }} />
              </div>
              <div className="is-b">
                <i style={{ width: "66%" }} />
              </div>
            </div>
          </div>
        </div> */}

        {/* Stat card — Reactor (left) */}
        <div className="is-stat" style={{ left: 56, top: 200 }}>
          <div className="is-panel">
            <h5>Reactor</h5>
            <div className="is-row">
              <span>Core</span>
              <span>78%</span>
            </div>
            <div className="is-bar">
              <i style={{ width: "78%" }} />
            </div>
            <div className="is-row" style={{ marginTop: 10 }}>
              <span>Cooling</span>
              <span>{coolVal}°C</span>
            </div>
            <div className="is-bar is-cyan">
              <i style={{ width: `${coolBarW}%` }} />
            </div>
            <div className="is-row" style={{ marginTop: 10 }}>
              <span>Pressure</span>
              <span>1.2 atm</span>
            </div>
            <div className="is-bar is-orange">
              <i style={{ width: "62%" }} />
            </div>
          </div>
        </div>

        {/* Stat card — Cargo (right) */}
        <div
          className="is-stat"
          style={{ right: 56, top: 200, textAlign: "right" }}
        >
          <div className="is-panel">
            <h5 style={{ textAlign: "left" }}>Cargo</h5>
            <div className="is-row">
              <span>Pyric ore</span>
              <span>{oreVal} kg</span>
            </div>
            <div className="is-bar is-orange">
              <i style={{ width: `${oreBarW}%` }} />
            </div>
            <div className="is-row" style={{ marginTop: 10 }}>
              <span>Capacity</span>
              <span>750 kg</span>
            </div>
            <div className="is-bar">
              <i style={{ width: "55%" }} />
            </div>
            <div className="is-row" style={{ marginTop: 10 }}>
              <span>Drone bay</span>
              <span>02 / 04</span>
            </div>
            <div className="is-bar is-cyan">
              <i style={{ width: "50%" }} />
            </div>
          </div>
        </div>

        {/* Boot log */}
        <div className="is-boot">
          <div>
            <span className="is-ok">[OK]</span> Booting kernel · v0.4.2
          </div>
          <div>
            <span className="is-ok">[OK]</span> Mounting tracks · dual-crawler
          </div>
          <div>
            <span className="is-ok">[OK]</span> Calibrating optic HALO-IV
          </div>
          <div>
            <span className="is-warn">[!]</span> Foliage interference ·
            resolving…
          </div>
          <div>
            <span className="is-ok">[OK]</span> Ore signatures locked · 14 veins
          </div>
          <div>
            &gt; standby<span className="is-blink">_</span>
          </div>
        </div>

        <div className="is-copyright">
          <b>AURORA WORKS</b>
          v 0.4.2 · build 21071
          <br />© 2026 · independent studio
        </div>

        {/* Start button */}
        <div className="is-start-wrap">
          <div className="is-start-help">
            Press <kbd>SPACE</kbd> or <kbd>ENTER</kbd>
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="is-start-halo" />
            {showRipple && <div className="is-ripple" />}
            <button className="is-start" onClick={handleStart}>
              <span>Press Start</span>
              <span className="is-glyph" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

