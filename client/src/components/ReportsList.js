"use client";

import { useState, useMemo } from "react";
import { ReportCard } from "./ReportCard";
import { SearchToolbar } from "./SearchToolbar";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  const handleReportClick = (report) => {
    console.log("Report clicked:", report);
    // TODO: Implement map zoom or modal
  };

  // Filter and sort reports
  const filteredAndSortedReports = useMemo(() => {
    // Filter by search query
    let filtered = mockReports.filter((report) =>
      report.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort by date
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.addedAt).getTime();
      const dateB = new Date(b.addedAt).getTime();
      return sortNewest ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [searchQuery, sortNewest]);

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Recent Reports</CardTitle>
        </div>
        <CardDescription>Latest community alerts in your area</CardDescription>
      </CardHeader>

      <CardContent className="px-6">
        <SearchToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortNewest={sortNewest}
          onSortToggle={() => setSortNewest(!sortNewest)}
        />

        {filteredAndSortedReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedReports.map((report, index) => (
              <ReportCard
                key={`${report.address}-${index}`}
                report={report}
                onClick={() => handleReportClick(report)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No reports found matching &quot;{searchQuery}&quot;
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
