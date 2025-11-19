"use client";

import { useState, useEffect } from "react";
import { ReportCard } from "@/components/ReportCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Check, LogOut, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, verifyFunction, denyFunction, deleteFunction } from "@/firebase";
import { signOut } from "firebase/auth";
import { usePending } from "@/contexts/PendingContext";

export function Verifier({ user }) {
  const { toast } = useToast();
  const { pendingLocations, isLoading } = usePending();
  const [queue, setQueue] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [animationClass, setAnimationClass] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");

  // Get verifier name from user object
  const verifierName = user?.displayName || user?.email || "Verifier";

  // Update queue when pendingLocations change
  useEffect(() => {
    if (!isLoading && pendingLocations) {
      setQueue([...pendingLocations]);
    }
  }, [pendingLocations, isLoading]);

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

    try {
      // Call the denyFunction with the report ID
      console.log("Denying report ID:", currentReport.id);
      await denyFunction({
        reportId: currentReport.id,
      });

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
    } catch (error) {
      console.error("Error denying report:", error);
      toast({
        title: "Deny failed",
        description: "Failed to deny the report. Please try again.",
        variant: "destructive",
      });
      setAnimationClass("");
      setIsAnimating(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (isAnimating || !currentReport) return;

    setIsAnimating(true);
    setAnimationClass("animate-deny-shake");
    setAnnounceMessage("Report deleted. Loading next...");

    try {
      // Call the deleteFunction with the report ID
      console.log("Deleting report ID:", currentReport.id);
      await deleteFunction({
        reportId: currentReport.id,
      });

      // Wait for shake animation
      setTimeout(() => {
        setAnimationClass("animate-deny-exit");

        // Wait for exit animation
        setTimeout(() => {
          toast({
            title: "Report deleted",
            description: "Report has been permanently deleted",
            variant: "destructive",
          });
          setQueue((prev) => prev.slice(1));
          setAnimationClass("");
          setIsAnimating(false);
        }, 300);
      }, 300);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Delete failed",
        description: "Failed to delete the report. Please try again.",
        variant: "destructive",
      });
      setAnimationClass("");
      setIsAnimating(false);
    }
  };

  const handleVerify = async (e) => {
    e.stopPropagation();
    if (isAnimating || !currentReport) return;

    setIsAnimating(true);
    setAnimationClass("animate-verify-scale");
    setAnnounceMessage("Report verified. Loading next...");

    try {
      // Call the verifyFunction with the report ID and user info

      console.log("Verifying report ID:", currentReport.id);
      await verifyFunction({
        reportId: currentReport.id,
      });

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
    } catch (error) {
      console.error("Error verifying report:", error);
      toast({
        title: "Verification failed",
        description: "Failed to verify the report. Please try again.",
        variant: "destructive",
      });
      setAnimationClass("");
      setIsAnimating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    }
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
                    onClick={handleDelete}
                    disabled={isAnimating}
                    className="gap-2 flex-1 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-500 focus-visible:ring-orange-500"
                    aria-label="Delete this report"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
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
              <h2 className="text-2xl font-semibold">
                {isLoading ? "Loading..." : "All Done!"}
              </h2>
              <p className="text-muted-foreground">
                {isLoading
                  ? "Loading pending reports..."
                  : "No more reports to review at this time."}
              </p>
              {!isLoading && pendingLocations.length === 0 && (
                <Button
                  onClick={() => setQueue([...pendingLocations])}
                  className="mt-4"
                >
                  Refresh
                </Button>
              )}
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
