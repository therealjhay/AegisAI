import type { Metadata } from "next";
import { Suspense } from "react";
import { CommandCenter } from "@/components/CommandCenter";

export const metadata: Metadata = {
  title: "AegisAI Command Center",
  description: "Live geospatial triage console for NGO response operations",
};

export default function CommandPage() {
  return (
    <div className="theme-command">
      <Suspense>
        <CommandCenter />
      </Suspense>
    </div>
  );
}
