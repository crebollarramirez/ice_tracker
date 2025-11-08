"use client";

import { useState, useEffect } from "react";
import { ReportCard } from "@/components/ReportCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Check, LogOut } from "lucide-react";
import { mockReports } from "@/utils/mockData";
import { useToast } from "@/hooks/use-toast";

export function Verifier({ onLogout }) {
  const { toast } = useToast();
  const [queue, setQueue] = useState([...mockReports]);
  const [currentReport, setCurrentReport] = useState(null);
  const [animationClass, setAnimationClass] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");

  // Mock verifier name for testing
  const verifierName = "Jane Doe";

  useEffect(() => {
    if (queue.length > 0) {
      setCurrentReport(queue[0]);
    } else {
      setCurrentReport(null);
    }
  }, [queue]);

  const handleDeny = async (e) => {
    e.stopPropagation();
    if (isAnimating || !currentReport) return;

    setIsAnimating(true);
    setAnimationClass("animate-deny-shake");
    setAnnounceMessage("Report denied. Loading next...");

    // Wait for shake animation
    setTimeout(() => {
      setAnimationClass("animate-deny-exit");

      // Wait for exit animation
      setTimeout(() => {
        toast({
          title: "Report denied",
          variant: "destructive",
        });
        setQueue((prev) => prev.slice(1));
        setAnimationClass("");
        setIsAnimating(false);
      }, 300);
    }, 300);
  };

  const handleVerify = async (e) => {
    e.stopPropagation();
    if (isAnimating || !currentReport) return;

    setIsAnimating(true);
    setAnimationClass("animate-verify-scale");
    setAnnounceMessage("Report verified. Loading next...");

    // Wait for scale animation
    setTimeout(() => {
      setAnimationClass("animate-verify-exit");

      // Wait for exit animation
      setTimeout(() => {
        toast({
          title: "Report verified",
          description: "Report has been successfully verified",
        });
        setQueue((prev) => prev.slice(1));
        setAnimationClass("");
        setIsAnimating(false);
      }, 300);
    }, 300);
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <>
      {/* ARIA live region for announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announceMessage}
      </div>

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Report Review</h1>
            <p className="text-muted-foreground">Welcome, {verifierName}</p>
            <p className="text-muted-foreground">
              {queue.length > 0
                ? `${queue.length} report${
                    queue.length === 1 ? "" : "s"
                  } remaining`
                : "All reports reviewed"}
            </p>
          </div>

          {currentReport ? (
            <ReportCard
              report={currentReport}
              animationClass={animationClass}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeny}
                    disabled={isAnimating}
                    className="gap-2 flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-red-500"
                    aria-label="Deny this report"
                  >
                    <X className="w-4 h-4" />
                    Deny
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerify}
                    disabled={isAnimating}
                    className="gap-2 flex-1 border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-500 focus-visible:ring-green-500"
                    aria-label="Verify this report"
                  >
                    <Check className="w-4 h-4" />
                    Verify
                  </Button>
                </>
              }
            />
          ) : (
            <Card className="p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-success/10">
                  <Check className="w-12 h-12 text-success" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold">All Done!</h2>
              <p className="text-muted-foreground">
                No more reports to review at this time.
              </p>
              <Button
                onClick={() => setQueue([...mockReports])}
                className="mt-4"
              >
                Reset Queue
              </Button>
            </Card>
          )}

          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
