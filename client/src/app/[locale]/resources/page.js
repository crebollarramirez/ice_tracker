"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Resource } from "@/components/Resource";
import { Scale, FileText, Phone, Users, Shield } from "lucide-react";
import { PageTitle, PageDescription, PageHeader } from "@/components/ui/page";

export default function ResourcePage() {
  const t = useTranslations("resourcesPage");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        {/* Page Header */}
        <PageHeader>
          <PageTitle>{t("title")}</PageTitle>
          <PageDescription>{t("description")}</PageDescription>
        </PageHeader>

        {/* Steps to Take if a Loved One is Detained */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-15 h-15 md:w-7 md:h-7 text-primary" />
            {t("subTitle1")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Resource
              icon={Phone}
              title={t("resource1.title")}
              description={t("resource1.description")}
              link="https://locator.ice.gov/"
              buttonText={t("resource1.button")}
            />

            <Resource
              icon={Phone}
              title={t("resource2.title")}
              description={t("resource2.description")}
              link="https://ice.gov/detention-facilities"
              buttonText={t("resource2.button")}
            />
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">{t("subTitle2")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Resource
              icon={Scale}
              title={t("resource3.title")}
              description={t("resource3.description")}
              link="https://www.immigrationadvocates.org/nonprofit/legaldirectory/"
              buttonText={t("resource3.title")}
            />

            <Resource
              icon={FileText}
              title={t("resource3.title")}
              description={t("resource3.description")}
              link="https://www.ilrc.org/sites/default/files/resources/imm_enf_pock_card_2017-eng-final.pdf"
              buttonText={t("resource3.button")}
            />

            <Resource
              icon={Shield}
              title={t("resource4.title")}
              description={t("resource3.description")}
              link="https://www.wehaverightsnyc.org/"
              buttonText={t("resource4.button")}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
