import { useTranslations } from "next-intl";
import Navbar from "@/components/Navbar";
import Resource from "@/components/Resource";
import Disclaimer from "@/components/Disclaimer";

export default function ResourcePage() {
  const t = useTranslations();

  // get all resources from resourceLinks
  const additionalResourcesLinks = t.raw("resources.additionalResources") || {};
  const additonalResources = Object.values(additionalResourcesLinks);

  const resourcesLinks = t.raw("resources.resourcesLinks") || {};
  const resources = Object.values(resourcesLinks);
  return (
    <main className="container flex items-center justify-center">
      <div className="w-full lg:w-2/3 flex flex-col items-center gap-4 md:gap-6">
        <Navbar />
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-red-600 mb-2">
            {t("resources.title")}
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-4">
            {t("resources.subtitle")}
          </p>
        </div>

        <div className="w-full flex flex-col items-center justify-center">
          <div className="w-full flex justify-start border-b border-red-300 pb-4">
            <h2 className="text-red-300">
              Steps to Take if a Loved One is Detained
            </h2>
          </div>
          <div className="w-full flex flex-col gap-4 px-2 md:px-0">
            {resources.map((r, i) => (
              <Resource
                key={i}
                title={r.title}
                link={r.link}
              />
            ))}
          </div>

          <div className="w-full flex justify-start border-b border-red-300 pb-4">
            <h2 className="text-red-300">Additonal Resources</h2>
          </div>

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

        <Disclaimer />
      </div>
    </main>
  );
}
