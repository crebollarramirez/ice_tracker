"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
const MapComponent = dynamic(() => import("../../components/MapComponent"), {
  ssr: false,
});
import { Header } from "../../components/Header";
import { InformationSection } from "../../components/InformationSection";

export default function Home() {
  const t = useTranslations();

  // Set this to true to show maintenance message for Map and Form section only
  const isMapFormMaintenanceMode =
    process.env.NEXT_PUBLIC_MAP_FORM_MAINTENANCE === "true";

  return (
    <main className="w-full min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <InformationSection />
      </div>
    </main>
  );
}
