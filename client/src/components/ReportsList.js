"use client";

import { ReportCard } from "./ReportCard";
import { mockReports } from "@/utils/mockData";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { cn } from "@/utils/utils";

export const ReportsList = ({ className }) => {
  const handleReportClick = (report) => {
    console.log("Report clicked:", report);
    // TODO: Implement map zoom or modal
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Recent Reports</CardTitle>
        </div>
        <CardDescription>Latest community alerts in your area</CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
        {mockReports.map((report, index) => (
          <ReportCard
            key={`${report.address}-${index}`}
            report={report}
            onClick={() => handleReportClick(report)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
