import { useTranslations } from "next-intl";
import Navbar from "@/components/Navbar";
import Resource from "@/components/Resource";
import Disclaimer from "@/components/Disclaimer";

export default function ResourcePage() {
  const t = useTranslations();

  // get all resources from resourceLinks
  const resourceLinks = t.raw("resources.resourceLinks") || {};
  const resources = Object.values(resourceLinks);

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

        <div className="w-full flex flex-col gap-4 px-2 md:px-0">
          {resources.map((r, i) => (
            <Resource
              key={i}
              title={r.title}
              description={r.description}
              link={r.link}
            />
          ))}
        </div>

        <Disclaimer />
      </div>
    </main>
  );
}
