"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Resource = ({
  icon: Icon,
  title,
  description,
  link,
  buttonText = "Learn More",
}) => {
  return (
    <Card className="border-primary/20 hover:border-primary/50 transition-colors">
      <CardHeader>
        {Icon && <Icon className="w-8 h-8 text-primary mb-2" />}
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="default"
          className="w-full gap-2"
          onClick={() => window.open(link, "_blank")}
        >
          <ExternalLink className="w-4 h-4" />
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};
