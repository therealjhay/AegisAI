import { SiteNav } from "@/components/home/SiteNav";
import { Hero } from "@/components/home/Hero";
import { PillarPipeline } from "@/components/home/PillarPipeline";
import { ConsoleSection } from "@/components/home/ConsoleSection";
import { TrustSection } from "@/components/home/TrustSection";
import { CtaBand } from "@/components/home/CtaBand";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <PillarPipeline />
        <ConsoleSection />
        <TrustSection />
        <CtaBand />
      </main>
    </>
  );
}
