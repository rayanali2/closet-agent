"use client";

import { useEffect, useRef, useState } from "react";
import { defaultPlans, garments, wardrobeAgent, type Recommendation } from "@/lib/wardrobe-agent";
import { IMAGE_ERROR, MAX_IMAGE_BYTES } from "@/lib/image-validation";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const API_ERROR = "Magic Hour couldn't generate this preview. Try another photo.";
const steps = ["Reading your day...", "Checking your closet...", "Trying it on with Magic Hour..."];
type Job = { status?: string; projectId?: string; imageUrl?: string; error?: string; demo?: boolean };
type Result = Recommendation & { imageUrl: string; demo: boolean };
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readResponse(response: Response): Promise<Job> {
  const data = await response.json().catch(() => ({ error: API_ERROR })) as Job;
  if (!response.ok) throw new Error(data.error || API_ERROR);
  return data;
}

function Arrow({ className = "" }: { className?: string }) {
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function ClosetAgent() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [plans, setPlans] = useState(defaultPlans);
  const [result, setResult] = useState<Result | null>(null);
  const [pick, setPick] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resultSection = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!photo) { setPhotoUrl(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStep((current) => current === 2 ? 2 : current + 1), 850);
    return () => clearInterval(timer);
  }, [busy]);

  function changePhoto(file?: File) {
    if (!file || lock.current) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) {
      setError(IMAGE_ERROR); return;
    }
    setPhoto(file); setError(""); setResult(null); setPick(null); setPendingProject(null);
  }

  async function styleDay() {
    if (lock.current) return;
    if (!photo) { setError("Add your photo first, then let your agent take it from here."); input.current?.focus(); return; }
    lock.current = true;
    setBusy(true); setStep(pendingProject ? 2 : 0); setError(""); setResult(null);
    const recommendation = pendingProject && pick ? pick : wardrobeAgent(plans);
    setPick(recommendation);
    let projectId = pendingProject;
    try {
      let job: Job;
      if (projectId) {
        job = { projectId };
      } else {
        const form = new FormData();
        form.set("person", photo);
        form.set("garment", recommendation.garment.id);
        form.set("garment_type", "upper_body");
        job = await readResponse(await fetch("/api/try-on", { method: "POST", body: form, signal: AbortSignal.timeout(110_000) }));
        projectId = job.projectId ?? null;
        setPendingProject(projectId);
      }
      // Poll only the existing project, never resubmit the paid generation.
      const deadline = Date.now() + 180_000;
      while (!job.imageUrl && projectId) {
        if (Date.now() >= deadline) throw new Error("Your preview is taking a little longer. Check again to keep waiting on the same preview.");
        setStep(2);
        await pause(2500);
        job = await readResponse(await fetch(`/api/try-on/${encodeURIComponent(projectId)}`, { cache: "no-store", signal: AbortSignal.timeout(25_000) }));
      }
      if (!job.imageUrl) throw new Error(API_ERROR);
      // Let the short reading/closet steps remain visible in demo mode, too.
      if (job.demo) { await pause(1800); }
      setResult({ ...recommendation, imageUrl: job.imageUrl, demo: job.demo === true });
      setPendingProject(null);
      setTimeout(() => resultSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : API_ERROR);
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  function changePlans() {
    setResult(null); setPick(null); setPendingProject(null); setError("");
    textarea.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.current?.focus({ preventScroll: true });
  }

  return (
    <main className="shell">
      <header className="header flex items-center justify-between">
        <a href="/" className="wordmark" aria-label="Closet Agent home"><svg width="29" height="25" viewBox="0 0 32 28" fill="none" aria-hidden="true"><path d="M13 7a3 3 0 1 1 4 2.8v3.1L28 21a1.5 1.5 0 0 1-.9 2.7H5A1.5 1.5 0 0 1 4.1 21L15 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>Closet Agent<span className="wordmark-dot">.</span></a>
        <span className="header-note"><span className="status-dot" /> {DEMO_MODE ? "DEMO MODE" : "YOUR DAILY WARDROBE AGENT"}</span>
      </header>

      <section className="intro">
        <div className="eyebrow"><span className="small-line" /> GOOD PLANS. BETTER OUTFITS.</div>
        <h1>One day.<br /><span>One less decision.</span></h1>
        <p>An agent that dresses around your day.</p>
      </section>

      <div className="workspace">
        <section className="you-section" aria-labelledby="you-heading">
          <div className="section-heading"><h2 id="you-heading"><span>01</span> YOU</h2><span>The starting point</span></div>
          <input ref={input} id="person-photo" type="file" className="file-input" accept="image/jpeg,image/png" disabled={busy} aria-label="Upload your JPG or PNG photo" onChange={(event) => { changePhoto(event.target.files?.[0]); event.target.value = ""; }} />
          <button type="button" className={`upload-area ${dragging ? "dragging" : ""} ${photoUrl ? "has-photo" : ""}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); changePhoto(event.dataTransfer.files[0]); }} aria-label={photo ? "Change your photo" : "Upload your photo"}>
            {photoUrl ? <><img src={photoUrl} alt="Your uploaded photo" /><span className="change-photo">Change photo <Arrow /></span></> : <div className="upload-content"><div className="photo-frame"><svg width="31" height="31" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="5" y="7" width="22" height="19" rx="3" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.3" /><path d="m7 24 7-7 4 4 4-5 4 5M16 3v7M12.5 6.5 16 3l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg></div><strong>A photo of you.</strong><span>Drop it here, or click to upload</span><small>JPG / PNG · UP TO 4 MB</small></div>}
          </button>
          <p className="photo-tip">A clear, front-facing photo works best.<br /> Make sure your upper body is visible.</p>
        </section>

        <div className="day-and-closet">
          <section aria-labelledby="today-heading">
            <div className="section-heading"><h2 id="today-heading"><span>02</span> TODAY</h2><span>What&apos;s on the agenda?</span></div>
            <label htmlFor="plans" className="sr-only">Your plans today</label>
            <textarea ref={textarea} id="plans" value={plans} maxLength={2000} disabled={busy || !!pendingProject} onChange={(event) => { setPlans(event.target.value); setResult(null); setPick(null); }} placeholder="A lecture, a coffee, a night out. Tell me about your day." />
            <p className="field-note">Your plans set the vibe. Your closet does the rest.</p>
          </section>

          <section className="closet-section" aria-labelledby="closet-heading">
            <div className="section-heading"><h2 id="closet-heading"><span>03</span> CLOSET</h2><span>3 everyday essentials</span></div>
            <div className="garment-grid">
              {garments.map((garment, index) => <article className={`garment-card ${pick?.garment.id === garment.id ? "selected" : ""}`} key={garment.id}>
                <div className="garment-image"><img src={garment.image} alt={garment.name} /><span className="garment-number">0{index + 1}</span>{pick?.garment.id === garment.id && <span className="pick-badge">AGENT PICK</span>}</div>
                <div className="garment-info"><h3>{garment.name}</h3><p>{garment.mood}</p></div>
              </article>)}
            </div>
          </section>

          <div className="action-area">
            <button type="button" className="style-button" disabled={busy} onClick={styleDay}><span>{busy ? steps[step] : pendingProject ? "CHECK AGAIN" : "STYLE MY DAY"}</span>{busy ? <span className="spinner" /> : <Arrow />}</button>
            <span className="action-note">{DEMO_MODE ? "Demo fallback · sample preview" : "Picked for your plans. Tried on with Magic Hour."}</span>
          </div>
          {error && <div className="error-message" role="alert"><p>{error}</p>{pendingProject && <button onClick={changePlans} type="button">Change Plans</button>}</div>}
        </div>
      </div>

      {busy && <section className="loading-panel" role="status" aria-live="polite"><div className="loading-top"><span className="eyebrow">YOUR AGENT IS ON IT</span><span className="loading-dots"><i /><i /><i /></span></div><div className="loading-steps">{steps.map((text, index) => <div key={text} className={step >= index ? "active" : ""}><span>{step > index ? "✓" : `0${index + 1}`}</span>{text}</div>)}</div><p>A good fit takes a moment. You can stay right here.</p></section>}

      {result && <section ref={resultSection} className="result-section" aria-labelledby="result-heading">
        <div className="result-intro"><div><p className="eyebrow">Your agent picked</p><h2 id="result-heading">{result.garment.name.toUpperCase()}<span className="result-period">.</span></h2></div><p className="recommendation">{result.reason}</p></div>
        <div className="result-grid">
          <figure><figcaption>YOUR PHOTO <span>01</span></figcaption><div className="result-photo original"><img src={photoUrl} alt="Your original uploaded photo" /></div></figure>
          <span className="result-arrow"><Arrow /></span>
          <figure><figcaption>AGENT PICK <span>02</span></figcaption><div className="result-photo chosen"><img src={result.garment.image} alt={result.garment.name} /></div></figure>
          <span className="result-arrow"><Arrow /></span>
          <figure className="generated-figure"><figcaption>PREVIEW <span>03</span></figcaption><div className="result-photo generated"><img src={result.imageUrl} alt={result.demo ? "Sample outfit preview for demo mode" : `Magic Hour try-on of you wearing the ${result.garment.name.toLowerCase()}`} onError={() => setError("The preview image couldn't load. Try Again to make a new preview.")} /></div><p className="generated-credit">{result.demo ? "Demo preview · sample photo, not a generated try-on" : "Generated with Magic Hour"}</p></figure>
        </div>
        <div className="result-actions"><button className="secondary-button" type="button" onClick={styleDay}>Try Again <Arrow /></button><button className="text-button" type="button" onClick={changePlans}>Change Plans <span>↗</span></button></div>
      </section>}

      <footer><span>YOUR PLANS. YOUR CLOSET. YOUR DAY.</span><span>Local wardrobe rules <span className="footer-divider">/</span> Magic Hour try-on</span></footer>
    </main>
  );
}
