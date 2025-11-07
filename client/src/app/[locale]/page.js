"use client";

import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import AddressForm from "@/components/AddressForm";
import { ReportsList } from "@/components/ReportsList";
import { LocationsProvider } from "@/contexts/LocationsContext";
import { DonateProvider } from "@/contexts/DonateContext";
import { DonatePopUp } from "@/components/Donate/DonatePopUp";
import { WhatToReport } from "@/components/WhatToReport";
import { EmergencyInfo } from "@/components/EmergencyInfo";
import { KnowYourRights } from "@/components/KnowYourRights";
import { Footer } from "@/components/Footer";
import { PageHeader, PageTitle, PageDescription } from "@/components/ui/page";

export default function Home() {
  // Set this to true to show maintenance message for Map and Form section only

  const MapComponent = dynamic(() => import("../../components/MapComponent"), {
    ssr: false,
  });

  const isMapFormMaintenanceMode =
    process.env.NEXT_PUBLIC_MAP_FORM_MAINTENANCE === "true";

  return (
    <main className="w-full min-h-screen bg-background">
      <DonateProvider>
        <LocationsProvider>
          <Header />

          <div className="container mx-auto px-4 py-8">
            <PageHeader>
              <PageTitle>ICE Activity Tracker</PageTitle>
              <PageDescription>
                The most reliable way to track ICE activity near you.
              </PageDescription>
            </PageHeader>
            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 gap-8">
              {/* Information Grid - Two columns on large screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <WhatToReport />
                <EmergencyInfo />
              </div>

              {/* Map Component */}
              <MapComponent />

              {/* Reports List */}
              <ReportsList />

              {/* Address Form */}
              <AddressForm />

              {/* Know Your Rights */}
              <KnowYourRights />
            </div>
          </div>
          <Footer />

          {/* Donate Popup - renders when triggered */}
          <DonatePopUp />
        </LocationsProvider>
      </DonateProvider>
    </main>
  );
}
