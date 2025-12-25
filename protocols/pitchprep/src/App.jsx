import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from "@spotify/basic-pitch";
import { Midi } from "@tonejs/midi";

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function hzToMidi(hz){ return 69 + 12 * Math.log2(hz / 440); }

function getTheme(){
  // Align with cantara.html: data-theme dark/light, localStorage key "theme"
  const saved = localStorage.getItem("theme");
  return saved === "light" ? "light" : "dark";
}
function toggleTheme(){
  const html = document.documentElement;
  const next = (html.getAttribute("data-theme") === "dark") ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  return next;
}

/**
 * Cleanup heuristics for "Ace-ready" MIDI:
 * - remove micro-notes
 * - merge adjacent notes if gap small and pitch almost same
 */
function cleanupNotes(inputNotes, opts){
  const { minMs, mergeGapMs, mergeSemitones } = opts;

  let notes = inputNotes.filter(n => (n.end - n.start) * 1000 >= minMs);
  notes.sort((a,b)=>a.start-b.start);

  const merged = [];
  for(const n of notes){
    const last = merged[merged.length-1];
    if(!last){ merged.push({...n}); continue; }

    const gap = (n.start - last.end) * 1000;
    const dp = Math.abs(n.midi - last.midi);

    if(gap <= mergeGapMs && dp <= mergeSemitones){
      last.end = Math.max(last.end, n.end);
      last.velocity = Math.max(last.velocity ?? 0.9, n.velocity ?? 0.9);
      continue;
    }
    merged.push({...n});
  }
  return merged;
}

export default function App(){
  const [theme, setTheme] = useState(getTheme());
  const [tab, setTab] = useState("BLOBS");

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("STANDBY");
  const [progress, setProgress] = useState(0);

  const [rawNotes, setRawNotes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [duration, setDuration] = useState(0);

  // pitch contour diagnostic
  const [f0, setF0] = useState(null);

  // cleanup parameters
  const [minMs, setMinMs] = useState(60);
  const [mergeGapMs, setMergeGapMs] = useState(40);
  const [mergeSemitones, setMergeSemitones] = useState(0.75);

  const canvasBlobsRef = useRef(null);
  const canvasContourRef = useRef(null);

  useEffect(() => {
    // initialize theme to match site convention
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  useEffect(() => {
    const cleaned = cleanupNotes(rawNotes, { minMs, mergeGapMs, mergeSemitones });
    setNotes(cleaned);
  }, [rawNotes, minMs, mergeGapMs, mergeSemitones]);

  // Model asset path: put TFJS model files in /public/models/
  const modelPaths = useMemo(() => ({
    modelUrl: "./models/model.json"
  }), []);

  async function decodeAudioToBuffer(audioFile){
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // Basic Pitch requires 22050 Hz sample rate
    const TARGET_SR = 22050;
    if (audioBuffer.sampleRate === TARGET_SR) {
      return audioBuffer;
    }
    
    // Resample using OfflineAudioContext
    const duration = audioBuffer.duration;
    const offlineCtx = new OfflineAudioContext(
      1, // mono
      Math.ceil(duration * TARGET_SR),
      TARGET_SR
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    const resampledBuffer = await offlineCtx.startRendering();
    return resampledBuffer;
  }

  function getMonoFromBuffer(audioBuffer){
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
    const mono = new Float32Array(audioBuffer.length);
    for(let i=0;i<audioBuffer.length;i++){
      mono[i] = ch1 ? 0.5*(ch0[i]+ch1[i]) : ch0[i];
    }
    return mono;
  }

  // Quick diagnostic pitch (not used for MIDI export)
  function computeF0Quick(mono, sampleRate){
    const frameSize = Math.floor(sampleRate * 0.046);
    const hop = Math.floor(sampleRate * 0.010);
    const fmin = 70;
    const fmax = 1000;

    const times = [];
    const hz = [];

    function autocorrPitch(frame){
      let mean = 0;
      for(let i=0;i<frame.length;i++) mean += frame[i];
      mean /= frame.length;
      const x = new Float32Array(frame.length);
      for(let i=0;i<frame.length;i++) x[i] = frame[i] - mean;

      let energy = 0;
      for(let i=0;i<x.length;i++) energy += x[i]*x[i];
      if(energy / x.length < 1e-5) return null;

      const minLag = Math.floor(sampleRate / fmax);
      const maxLag = Math.floor(sampleRate / fmin);

      let bestLag = -1;
      let best = 0;

      for(let lag=minLag; lag<=maxLag; lag++){
        let c = 0;
        for(let i=0;i<x.length-lag;i++) c += x[i]*x[i+lag];
        if(c > best){ best = c; bestLag = lag; }
      }
      if(bestLag <= 0) return null;
      return sampleRate / bestLag;
    }

    for(let start=0; start + frameSize < mono.length; start += hop){
      const frame = mono.subarray(start, start + frameSize);
      const f = autocorrPitch(frame);
      times.push(start / sampleRate);
      hz.push(f);
    }
    return { times, hz };
  }

  async function run(){
    if(!file) return;

    setStatus("ACTIVE");
    setProgress(0);
    setRawNotes([]);
    setNotes([]);
    setF0(null);

    try{
      // Decode audio to AudioBuffer (what Basic Pitch expects)
      const audioBuffer = await decodeAudioToBuffer(file);
      const mono = getMonoFromBuffer(audioBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const seconds = audioBuffer.duration;

      setDuration(seconds);
      setF0(computeF0Quick(mono, sampleRate));

      // Basic Pitch uses callbacks, not return values
      const frames = [];
      const onsets = [];
      const contours = [];

      const bp = new BasicPitch(modelPaths.modelUrl);
      
      await bp.evaluateModel(
        audioBuffer,
        (f, o, c) => {
          // Accumulate frames, onsets, contours
          frames.push(...f);
          onsets.push(...o);
          contours.push(...c);
        },
        (p) => {
          // Progress callback (0-1)
          setProgress(Math.round(p * 100));
        }
      );

      // Convert raw model output to note events
      const noteEvents = noteFramesToTime(
        addPitchBendsToNoteEvents(
          contours,
          outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)
        )
      );

      const extracted = noteEvents
        .map(n => ({
          start: n.startTimeSeconds,
          end: n.endTimeSeconds,
          midi: n.pitchMidi,
          velocity: clamp(n.amplitude ?? 0.9, 0.05, 1.0)
        }))
        .filter(n => Number.isFinite(n.start) && Number.isFinite(n.end) && Number.isFinite(n.midi) && n.end > n.start)
        .sort((a,b)=>a.start-b.start);

      setRawNotes(extracted);
      setStatus("CONFIRMED");
    }catch(e){
      console.error(e);
      setStatus("FAILED");
    }
  }

  function exportMidi(){
    if(!notes.length) return;

    const midi = new Midi();
    midi.header.setTempo(120);
    const track = midi.addTrack();

    notes.forEach(n => {
      track.addNote({
        midi: Math.round(n.midi),
        time: n.start,
        duration: Math.max(0.02, n.end - n.start),
        velocity: n.velocity
      });
    });

    const bytes = midi.toArray();
    const blob = new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name ? file.name.replace(/\.[^.]+$/, "") : "vocal") + "_aceprep.mid";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Draw blobs
  useEffect(() => {
    const c = canvasBlobsRef.current;
    if(!c) return;

    const ctx = c.getContext("2d");
    const w = c.width = 1600;
    const h = c.height = 380;

    const styles = getComputedStyle(document.documentElement);
    const BG = styles.getPropertyValue("--bg").trim();
    const GRID = styles.getPropertyValue("--border").trim();
    const ACCENT = styles.getPropertyValue("--cyan").trim();
    const TEXT = styles.getPropertyValue("--text").trim();
    const MUTED = styles.getPropertyValue("--muted").trim();

    ctx.fillStyle = BG;
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = GRID;
    ctx.globalAlpha = 0.35;
    for(let i=0;i<=10;i++){
      const y = (i/10)*h;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = MUTED;
    ctx.font = "12px 'Fira Code', monospace";
    ctx.fillText("[ NOTE BLOBS ]", 14, 20);

    if(!notes.length || !duration){
      ctx.fillStyle = MUTED;
      ctx.fillText("No notes yet. Upload a stem and DISPATCH.", 14, 44);
      return;
    }

    const minMidi = 36;
    const maxMidi = 96;
    const leftPad = 14;
    const topPad = 34;
    const usableW = w - leftPad*2;
    const usableH = h - topPad - 16;

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.25;

    notes.forEach(n => {
      const x1 = leftPad + (n.start / duration) * usableW;
      const x2 = leftPad + (n.end / duration) * usableW;
      const y = topPad + (1 - (n.midi - minMidi)/(maxMidi-minMidi)) * usableH;

      const width = Math.max(2, x2-x1);
      const height = 10;

      ctx.beginPath();
      ctx.roundRect(x1, y - height/2, width, height, 4);
      ctx.stroke();
    });

    ctx.fillStyle = TEXT;
    ctx.fillText(`notes(clean)=${notes.length}  notes(raw)=${rawNotes.length}  duration=${duration.toFixed(2)}s`, 14, h-10);

  }, [notes, rawNotes.length, duration, theme]);

  // Draw contour
  useEffect(() => {
    const c = canvasContourRef.current;
    if(!c) return;

    const ctx = c.getContext("2d");
    const w = c.width = 1600;
    const h = c.height = 380;

    const styles = getComputedStyle(document.documentElement);
    const BG = styles.getPropertyValue("--bg").trim();
    const GRID = styles.getPropertyValue("--border").trim();
    const ACCENT = styles.getPropertyValue("--cyan").trim();
    const MUTED = styles.getPropertyValue("--muted").trim();

    ctx.fillStyle = BG;
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = GRID;
    ctx.globalAlpha = 0.35;
    for(let i=0;i<=10;i++){
      const y = (i/10)*h;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = MUTED;
    ctx.font = "12px 'Fira Code', monospace";
    ctx.fillText("[ PITCH CONTOUR ]", 14, 20);

    if(!f0 || !duration){
      ctx.fillStyle = MUTED;
      ctx.fillText("No contour yet. Upload a stem and DISPATCH.", 14, 44);
      return;
    }

    const leftPad = 14;
    const topPad = 34;
    const usableW = w - leftPad*2;
    const usableH = h - topPad - 16;

    const hzMin = 70;
    const hzMax = 1000;

    function hzToY(v){
      const t = (Math.log(v) - Math.log(hzMin)) / (Math.log(hzMax) - Math.log(hzMin));
      return topPad + (1 - clamp(t,0,1)) * usableH;
    }

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let started = false;
    for(let i=0;i<f0.times.length;i++){
      const t = f0.times[i];
      const v = f0.hz[i];
      if(!v || v < hzMin || v > hzMax){ started = false; continue; }

      const x = leftPad + (t / duration) * usableW;
      const y = hzToY(v);

      if(!started){ ctx.moveTo(x,y); started = true; }
      else { ctx.lineTo(x,y); }
    }
    ctx.stroke();
  }, [f0, duration, theme]);

  const themeLabel = (theme === "dark") ? "[ LUX ]" : "[ NOX ]";

  return (
    <>
      <header className="hdr">
        <div className="brand">
          <div className="gradus">▌▌▌</div>
          <h1 className="title">Grey Stratum</h1>
          <div className="tag">Instrumentum 003 – AcePrep</div>
        </div>

        <div className="toolbar">
          <span className="pill">theme: <b style={{color:"var(--cyan)"}}>{theme === "dark" ? "NOX" : "LUX"}</b></span>
          <button
            className="btn"
            onClick={()=>{
              const next = toggleTheme();
              setTheme(next);
            }}
          >
            {themeLabel}
          </button>
        </div>
      </header>

      <div className="main">
        <div className="card">
          <div className="label">[ INPUT ]</div>
          <input
            className="input"
            type="file"
            accept="audio/*"
            onChange={(e)=>setFile(e.target.files?.[0] || null)}
          />

          <div className="kv">
            <div className="small">status: <b style={{color:"var(--cyan)"}}>{status}{status === "ACTIVE" && progress > 0 ? ` (${progress}%)` : ""}</b></div>
            <div className="small">{file ? file.name : ""}</div>
          </div>

          <div className="btnRow">
            <button className="btn btnSolid" onClick={run} disabled={!file || status==="ACTIVE"}>[ DISPATCH ]</button>
            <button className="btn" onClick={exportMidi} disabled={!notes.length}>[ EXPORT MIDI ]</button>
          </div>

          <div className="hr"></div>

          <div className="label">[ CLEANUP ]</div>

          <div className="sliderRow">
            <div className="small">remove micro-notes under (ms)</div>
            <input className="range" type="range" min="10" max="180" value={minMs} onChange={(e)=>setMinMs(Number(e.target.value))} />
          </div>
          <div className="small">minMs = <b style={{color:"var(--cyan)"}}>{minMs}</b></div>

          <div className="sliderRow">
            <div className="small">merge adjacent notes if gap ≤ (ms)</div>
            <input className="range" type="range" min="0" max="120" value={mergeGapMs} onChange={(e)=>setMergeGapMs(Number(e.target.value))} />
          </div>
          <div className="small">mergeGapMs = <b style={{color:"var(--cyan)"}}>{mergeGapMs}</b></div>

          <div className="sliderRow">
            <div className="small">merge if pitch diff ≤ (semitones)</div>
            <input className="range" type="range" min="0" max="2" step="0.05" value={mergeSemitones} onChange={(e)=>setMergeSemitones(Number(e.target.value))} />
          </div>
          <div className="small">mergeSemitones = <b style={{color:"var(--cyan)"}}>{mergeSemitones.toFixed(2)}</b></div>

          <div className="hr"></div>

          <div className="label">[ GUIDANCE ]</div>
          <div className="small">
            Ace import likes stable, syllable-length notes. If BLOBS show fragments, raise <b>minMs</b> and <b>mergeGapMs</b>.
            If distinct notes merge incorrectly, reduce <b>mergeSemitones</b>.
          </div>
        </div>

        <div className="card">
          <div className="tabs">
            <button className={`tab ${tab==="BLOBS" ? "tabActive" : ""}`} onClick={()=>setTab("BLOBS")}>[ BLOBS ]</button>
            <button className={`tab ${tab==="CONTOUR" ? "tabActive" : ""}`} onClick={()=>setTab("CONTOUR")}>[ CONTOUR ]</button>
          </div>

          <div className="canvasWrap">
            {tab === "BLOBS" ? (
              <canvas ref={canvasBlobsRef}></canvas>
            ) : (
              <canvas ref={canvasContourRef}></canvas>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
