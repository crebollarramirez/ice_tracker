import { useTranslations } from "next-intl";
import Navbar from "@/components/Navbar";
import Resource from "@/components/Resource";
import Disclaimer from "@/components/Disclaimer";

export default function ResourcePage() {
  const t = useTranslations();

  const additionalResourcesLinks = t.raw("resources.additionalResources") || {};
  const additonalResources = Object.values(additionalResourcesLinks);

  const resourcesLinks = t.raw("resources.resourcesLinks") || {};
  const resources = Object.values(resourcesLinks);

  return (
    // Make the page at least viewport height and stack vertically
    <main className="min-h-screen flex flex-col">
      {/* constrain width and center horizontally */}
      <div className="container mx-auto w-full lg:w-2/3 flex flex-col items-center gap-4 md:gap-6 flex-1">
        <Navbar />

        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-red-600 mb-2">
            {t("resources.title")}
          </h1>
          <p className="text-lg md:text-xl font-semibold text-gray-400/70 mb-4">
            {t("resources.subtitle")}
          </p>
        </div>

        <div className="w-full flex flex-col items-center justify-center gap-4">
          <div className="w-full">
            {/* first header */}
            <div className="w-full flex justify-start border-b border-red-600 pb-4 mb-2">
              <h2 className="text-red-600 font-bold">
                {t("resources.resourceSection1")}
              </h2>
            </div>
            {/* resources */}
            <div className="w-full flex flex-col gap-4 px-2 md:px-0">
              {resources.map((r, i) => (
                <Resource key={i} title={r.title} link={r.link} />
              ))}
            </div>
          </div>

          <div className="w-full">
            {/* second header */}
            <div className="w-full flex justify-start border-b border-red-600 pb-4 mb-2 font-bold">
              <h2 className="text-red-600">{t('resources.resourceSection2')}</h2>
            </div>

            {/* resources */}
            <div className="w-full flex flex-col gap-4 px-2 md:px-0">
              {additonalResources.map((r, i) => (
                <Resource
                  key={i}
                  title={r.title}
                  description={r.description}
                  link={r.link}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Push the Disclaimer to the bottom when content is short */}

        <Disclaimer />
      </div>
    </main>
  );
}
