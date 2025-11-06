"use client";

import { useState } from "react";
import {
  MapPin,
  Clock,
  Copy,
  Share2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRelativeTime, isNew } from "@/lib/dateUtils";
import { copyToClipboard, shareReport } from "@/lib/shareUtils";
import { useToast } from "@/hooks/use-toast";

export const ReportCard = ({ report, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  const showNew = isNew(report.addedAt);
  const shouldTruncate = report.additionalInfo.length > 120;

  const handleCopyAddress = async (e) => {
    e.stopPropagation();
    const success = await copyToClipboard(report.address);
    if (success) {
      toast({
        title: "Address copied to clipboard",
      });
    } else {
      toast({
        title: "Failed to copy address",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const success = await shareReport(report.address, report.additionalInfo);
    if (success) {
      toast({
        title: "Shared successfully",
      });
    }
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
      {/* Image */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        {report.imgUrl && !imageError ? (
          <img
            src={report.imgUrl}
            alt={`Report from ${report.address}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        {showNew && (
          <Badge className="absolute top-3 right-3 bg-badge-new text-badge-new-foreground">
            New
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <h3 className="font-semibold text-foreground line-clamp-2">
            {report.address}
          </h3>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{getRelativeTime(report.addedAt)}</span>
        </div>

        {/* Additional Info */}
        <div className="text-sm text-foreground/80">
          {shouldTruncate && !expanded ? (
            <>
              {report.additionalInfo.slice(0, 120)}...
              <button
                onClick={toggleExpand}
                className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
              >
                Read more
                <ChevronDown className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              {report.additionalInfo}
              {shouldTruncate && (
                <button
                  onClick={toggleExpand}
                  className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
                >
                  Show less
                  <ChevronUp className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAddress}
            className="gap-2 flex-1"
          >
            <Copy className="w-3 h-3" />
            Copy Address
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="gap-2 flex-1"
          >
            <Share2 className="w-3 h-3" />
            Share
          </Button>
        </div>
      </div>
    </Card>
  );
};
