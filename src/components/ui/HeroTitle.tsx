"use client";

import AnimatedText from "./AnimatedText";

export default function HeroTitle({ line1, line2 }: { line1: string; line2: string }) {
  const fullText = `${line1} ${line2}`;
  return (
    <h1 className="mt-4 text-3xl font-black leading-tight text-white drop-shadow-xl sm:mt-5 sm:text-5xl lg:text-7xl">
      <AnimatedText text={fullText} />
    </h1>
  );
}
