import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";
import { cn } from "@/utils/utils";

export const EmergencyInfo = ({ className }) => {
  const t = useTranslations("emergencyContacts");
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-primary" />
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </div>
        <CardDescription>{t("top")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-sm mb-2">{t("subTitle1")}</p>
          <p className="text-sm text-muted-foreground">{t("info1")}</p>
        </div>

        <div>
          <p className="font-medium text-sm mb-2">{t("subTitle2")}</p>
          <p className="text-sm text-muted-foreground">{t("info2")}</p>
        </div>

        <div>
          <p className="font-medium text-sm mb-2">{t("subTitle3")}</p>
          <p className="text-sm text-muted-foreground">{t("info3")}</p>
        </div>

        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground italic">{t("bottom")}</p>
        </div>
      </CardContent>
    </Card>
  );
};
