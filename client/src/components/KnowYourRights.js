"use client";

import { Scale, FileText, Phone, UserX, Search, Ban } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

export const KnowYourRights = () => {
  const t = useTranslations("knowYourRights");
  return (
    <Card className="mb-8 border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-6 h-6 text-primary" />
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </div>
        <CardDescription className="text-base">
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3">
            <UserX className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">{t("infoT1")}</p>
              <p className="text-sm text-muted-foreground">{t("infoD1")}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">{t("infoT2")}</p>
              <p className="text-sm text-muted-foreground">{t("infoD2")}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Search className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">{t("infoT3")}</p>
              <p className="text-sm text-muted-foreground">{t("infoD3")}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Scale className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">{t('infoT4')}</p>
              <p className="text-sm text-muted-foreground">
                {t('infoD4')}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Ban className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">
                {t('infoT5')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('infoD5')}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">{t('infoT6')}</p>
              <p className="text-sm text-muted-foreground">
                {t('infoD6')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
