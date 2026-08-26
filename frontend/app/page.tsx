import { SiteNav } from "@/components/home/SiteNav";
import { Hero } from "@/components/home/Hero";
import { PillarPipeline } from "@/components/home/PillarPipeline";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <PillarPipeline />
      </main>
    </>
  );
}
