import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, MapPin, Clock, Lock } from "lucide-react";
import { cn } from "@/utils/utils";
import { useTranslations } from "next-intl";

export const WhatToReport = ({ className }) => {
  const t = useTranslations("reporting");
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("notice")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1">{t("subTitle1")}</p>
            <p className="text-sm text-muted-foreground">{t("info1")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1">{t("subTitle2")}</p>
            <p className="text-sm text-muted-foreground">{t("info2")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1"> {t("subTitle3")}</p>
            <p className="text-sm text-muted-foreground">{t("info3")}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1"> {t("subTitle4")}</p>
            <p className="text-sm text-muted-foreground">{t("info4")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
