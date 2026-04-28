"use client";

import React, { useEffect, useMemo, useState } from "react";

type TeleIntroProps = {
  logoSrc?: string;
  title?: string;
  sessionKey?: string;
};

export default function TeleIntro({
  logoSrc = "/brand/telegpt-logo.png",
  title = "Tele•GPT",
  sessionKey = "telegpt_intro_seen_v1",
}: TeleIntroProps) {
  const [visible, setVisible] = useState(false);
  const [exit, setExit] = useState(false);
  const [color, setColor] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [pulse, setPulse] = useState(false);

  const shouldShow = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(sessionKey);
  }, [sessionKey]);

  useEffect(() => {
    if (!shouldShow) return;

    setVisible(true);

    const t1 = window.setTimeout(() => setShimmer(true), 560);
    const t2 = window.setTimeout(() => setPulse(true), 1250);
    const t3 = window.setTimeout(() => setColor(true), 1500);
    const t4 = window.setTimeout(() => setExit(true), 1860);
    const t5 = window.setTimeout(() => {
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {}
      setVisible(false);
    }, 2140);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [shouldShow, sessionKey]);

  if (!shouldShow || !visible) return null;

  return (
    <div className={`telegpt-intro ${exit ? "isExit" : ""}`} aria-hidden="true">
      <div className="telegpt-intro__stack">
        <div className="telegpt-intro__logoWrap">
          <div className={`telegpt-intro__lamp telegpt-intro__lamp--head ${pulse ? "pulse2" : ""}`} />
          <div className={`telegpt-intro__lamp telegpt-intro__lamp--chest ${pulse ? "pulse2" : ""}`} />

          <img
            className={`telegpt-intro__logo ${color ? "isColor" : ""}`}
            src={logoSrc}
            alt="Tele•GPT"
            draggable={false}
          />
        </div>

        <h1 className="telegpt-intro__title">
          <span className="telegpt-intro__titleBase">{title}</span>
          <span className={`telegpt-intro__titleShimmer ${shimmer ? "run" : ""}`}>{title}</span>
        </h1>
      </div>
    </div>
  );
}
