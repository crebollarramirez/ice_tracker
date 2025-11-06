"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Resource } from "@/components/Resource";
import { Scale, FileText, Phone, Users, Shield } from "lucide-react";

export default function ResourcePage() {
  const t = useTranslations();

  const additionalResourcesLinks = t.raw("resources.additionalResources") || {};
  const additonalResources = Object.values(additionalResourcesLinks);

  const resourcesLinks = t.raw("resources.resourcesLinks") || {};
  const resources = Object.values(resourcesLinks);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Resources
          </h1>
          <p className="text-lg text-muted-foreground">
            Here are some helpful resources to know your rights and find legal
            assistance.
          </p>
        </div>

        {/* Steps to Take if a Loved One is Detained */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-15 h-15 md:w-7 md:h-7 text-primary" />
            Steps to Take if a Loved One is Detained
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Resource
              icon={Phone}
              title="Confirming Detainment by ICE"
              description="Use the ICE Detainee Locator System to confirm their location and status. Have the person's full name, date of birth, and country of origin ready."
              link="https://locator.ice.gov/"
              buttonText="ICE Detainee Locator"
            />

            <Resource
              icon={Phone}
              title="Reach Your Loved One"
              description="Find detention facility contact information, visitation rules, and communication guidelines to stay connected with detained loved ones."
              link="https://ice.gov/detention-facilities"
              buttonText="Detention Facilities"
            />
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Additional Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Resource
              icon={Scale}
              title="Find Legal Help Near You"
              description="Search the National Immigration Legal Services Directory to locate free or low-cost legal aid organizations across the U.S."
              link="https://www.immigrationadvocates.org/nonprofit/legaldirectory/"
              buttonText="Find Legal Services"
            />

            <Resource
              icon={FileText}
              title="Carry Your Rights With You"
              description="Wallet-sized Know Your Rights card from the Immigrant Legal Resource Center (ILRC). Available in multiple languages."
              link="https://www.ilrc.org/sites/default/files/resources/imm_enf_pock_card_2017-eng-final.pdf"
              buttonText="Download Card"
            />

            <Resource
              icon={Shield}
              title="We Have Rights"
              description="Emergency Plan and Resources from Brooklyn Defender Services. Step-by-step guide for ICE encounters with videos and legal resources."
              link="https://www.wehaverightsnyc.org/"
              buttonText="View Resources"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
