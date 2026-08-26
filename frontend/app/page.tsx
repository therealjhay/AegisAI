import { SiteNav } from "@/components/home/SiteNav";
import { Hero } from "@/components/home/Hero";
import { PillarPipeline } from "@/components/home/PillarPipeline";
import { ConsoleSection } from "@/components/home/ConsoleSection";
import { TrustSection } from "@/components/home/TrustSection";
import { CtaBand } from "@/components/home/CtaBand";
import { SiteFooter } from "@/components/home/SiteFooter";

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
      <SiteFooter />
    </>
  );
}
