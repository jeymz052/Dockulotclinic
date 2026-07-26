"use client";

import { useState, useEffect, useRef } from "react";

export default function AnimatedText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    setShowCursor(true);

    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const type = () => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerRef.current = setTimeout(type, 60);
      } else {
        timerRef.current = setTimeout(() => setShowCursor(false), 2500);
        timerRef.current = setTimeout(() => {
          setShowCursor(true);
          i = 0;
          setDisplayed("");
          timerRef.current = setTimeout(type, 400);
        }, 3000);
      }
    };

    timerRef.current = setTimeout(type, 400);
    return clear;
  }, [text]);

  return (
    <span style={{ display: "inline" }}>
      {displayed}
      {showCursor && (
        <span
          style={{
            display: "inline-block",
            width: "3px",
            height: "0.85em",
            background: "#fff",
            marginLeft: "2px",
            verticalAlign: "text-bottom",
            animation: "blink 0.7s steps(1) infinite",
          }}
        />
      )}
    </span>
  );
}
