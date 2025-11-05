"use client";

import { MapPin, Phone, Shield, Clock, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

export const InformationSection = () => {
  const t = useTranslations("");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Reporting ICE Activity */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">{t("reporting.title")}</CardTitle>
          </div>
          <CardDescription>{t("reporting.notice")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">
                {t("reporting.subTitle1")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("reporting.info1")}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">
                {t("reporting.subTitle2")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("reporting.info2")}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">
                {" "}
                {t("reporting.subTitle3")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("reporting.info3")}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">
                {" "}
                {t("reporting.subTitle4")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("reporting.info4")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">
              {t("emergencyContacts.title")}
            </CardTitle>
          </div>
          <CardDescription>{t("emergencyContacts.top")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium text-sm mb-2">
              {t("emergencyContacts.subTitle1")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("emergencyContacts.info1")}
            </p>
          </div>

          <div>
            <p className="font-medium text-sm mb-2">
              {t("emergencyContacts.subTitle2")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("emergencyContacts.info2")}
            </p>
          </div>

          <div>
            <p className="font-medium text-sm mb-2">
              {t("emergencyContacts.subTitle3")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("emergencyContacts.info3")}
            </p>
          </div>

          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground italic">
              {t("emergencyContacts.bottom")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
