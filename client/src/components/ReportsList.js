"use client";

import { useState, useMemo } from "react";
import { ReportCard } from "./ReportCard";
import { SearchToolbar } from "./SearchToolbar";
import { useLocations } from "@/contexts/LocationsContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils/utils";
import { StatusBadge } from "@/components/ui/status-badge";

export const ReportsList = ({ className }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { locations, isLoading } = useLocations();

  const handleReportClick = (report) => {
    console.log("Report clicked:", report);
    // TODO: Implement map zoom or modal
  };

  // Filter and sort reports
  const filteredAndSortedReports = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    // Filter by search query
    let filtered = locations.filter((report) =>
      report.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort by date - using originalAddedAt for proper sorting
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.originalAddedAt || a.addedAt).getTime();
      const dateB = new Date(b.originalAddedAt || b.addedAt).getTime();
      return sortNewest ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [locations, searchQuery, sortNewest]);

  // Get reports to display (first 6 or all if showAll is true)
  const reportsToShow = useMemo(() => {
    if (showAll || filteredAndSortedReports.length <= 6) {
      return filteredAndSortedReports;
    }
    return filteredAndSortedReports.slice(0, 6);
  }, [filteredAndSortedReports, showAll]);

  const hasMoreReports = filteredAndSortedReports.length > 6;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Recent Reports</CardTitle>
          <StatusBadge color="warning" animate={true}>
            Beta
          </StatusBadge>
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

        {isLoading ? (
          <div className="text-center py-12 lg:min-h-[700px] lg:flex lg:items-center lg:justify-center">
            <p className="text-muted-foreground">Loading verified reports...</p>
          </div>
        ) : filteredAndSortedReports.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:min-h-[700px]">
              {reportsToShow.map((report) => (
                <ReportCard
                  key={report.id || `${report.address}-${report.addedAt}`}
                  report={report}
                  onClick={() => handleReportClick(report)}
                />
              ))}
            </div>

            {hasMoreReports && !showAll && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                  className="gap-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  View More ({filteredAndSortedReports.length - 6} more reports)
                </Button>
              </div>
            )}

            {showAll && hasMoreReports && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(false)}
                  className="gap-2"
                >
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 lg:min-h-[700px] lg:flex lg:items-center lg:justify-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? `No reports found matching "${searchQuery}"`
                : "No Reports"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
