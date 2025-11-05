import { useTranslations } from "next-intl";
import Navbar from "@/components/Navbar";
import Resource from "@/components/Resource";
import Disclaimer from "@/components/Disclaimer";
import { Header } from "@/components/Header";

export default function ResourcePage() {
  const t = useTranslations();

  const additionalResourcesLinks = t.raw("resources.additionalResources") || {};
  const additonalResources = Object.values(additionalResourcesLinks);

  const resourcesLinks = t.raw("resources.resourcesLinks") || {};
  const resources = Object.values(resourcesLinks);

  return (
    // Make the page at least viewport height and stack vertically
    <main className="w-full min-h-screen bg-background">
      <Header />
    </main>
  );
}
