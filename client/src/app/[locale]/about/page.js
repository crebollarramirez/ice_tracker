import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Heart, Users, Shield, Mail } from "lucide-react";
import { VerificationTimeline } from "@/components/VerificationTimeline";
import { PageTitle, PageDescription, PageHeader } from "@/components/ui/page";
import { useTranslations } from "next-intl";

export default function AboutPage() {
  const t = useTranslations("aboutPage");
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <PageHeader>
          <PageTitle>{t("title")}</PageTitle>
          <PageDescription>{t("description")}</PageDescription>
        </PageHeader>

        {/* Mission Statement Card */}
        <Card className="max-w-4xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl text-center flex items-center justify-center gap-3">
              <Heart className="w-7 h-7 text-primary" />
              {t("missionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center px-6 md:px-12">
            <p className="text-base md:text-lg leading-relaxed text-foreground/90">
              {t("missionDescription")}
            </p>
          </CardContent>
        </Card>

        {/* Core Values */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{t("cTitle1")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("cDescription1")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{t("cTitle2")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("cDescription2")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">{t("cTitle3")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("cDescription3")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Why the Website Changed - Emphasized Section */}
        <div className="bg-primary/5 border-t-4 border-primary py-12 md:py-16 -mx-4 px-4 mb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-foreground">
              {t("webTitle")}
            </h2>
            <div className="space-y-6">
              <p className="text-lg md:text-xl leading-relaxed text-foreground text-center">
                {t("webPara1")}{" "}
                <strong className="text-primary">{t("webPara2")}</strong>
                {t("webPara3")}{" "}
                <strong className="text-primary">
                  {t("webPara4")}
                </strong>{" "}
                {t("webPara5")}
              </p>
              <p className="text-lg md:text-xl leading-relaxed text-foreground text-center">
                {t("webPara6")}{" "}
                <strong className="text-primary">
                  {t("webPara7")}
                </strong>{" "}
                {t("webPara8")}{" "}
                <strong className="text-primary">
                  {t("webPara9")}
                </strong>{" "}
                {t("webPara10")}
              </p>
            </div>
          </div>
        </div>

        {/* Verification Process Timeline - Emphasized Section */}
        <div className="bg-gradient-to-b from-primary/5 to-background border-t-4 border-primary py-16 md:py-24 -mx-4 px-4 mb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center text-foreground">
              {t("verifyTitle")}
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
              {t('verifyDescription')}
            </p>
            <VerificationTimeline />
          </div>
        </div>

        {/* Contact Us Section */}
        <Card className="max-w-4xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl text-center flex items-center justify-center gap-3">
              <Mail className="w-7 h-7 text-primary" />
              {t("contactTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center px-6 md:px-12">
            <p className="text-base md:text-lg text-muted-foreground mb-4">
              {t('contactP1')}
            </p>
            <a
              href="mailto:support@iceinmyarea.org"
              className="text-lg md:text-xl font-medium text-primary hover:underline"
            >
              support@iceinmyarea.org
            </a>
          </CardContent>
          <CardFooter className="text-base md:text-lg text-muted-foreground/80">
              {t('contactP2')}
          </CardFooter>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
