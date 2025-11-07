"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Users, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/utils";

const steps = [
  {
    id: 1,
    title: "Report Submitted",
    description:
      "A community member submits a report with details and location.",
    icon: FileText,
  },
  {
    id: 2,
    title: "Reviewed by a Person",
    description: "A real verifier checks accuracy and context.",
    icon: Users,
  },
  {
    id: 3,
    title: "Visible in Real Time",
    description: "Verified reports appear live for everyone.",
    icon: Globe,
  },
];

export const VerificationTimeline = () => {
  const [stepStates, setStepStates] = useState([
    "upcoming",
    "upcoming",
    "upcoming",
  ]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const stepRefs = useRef([]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const observers = stepRefs.current.map((ref, index) => {
      if (!ref) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setStepStates((prev) => {
                const newStates = [...prev];
                // Mark all previous as complete
                for (let i = 0; i < index; i++) {
                  newStates[i] = "complete";
                }
                // Mark current as active (or complete if last step)
                if (newStates[index] !== "complete") {
                  newStates[index] =
                    index === steps.length - 1 ? "complete" : "active";
                }
                return newStates;
              });
            } else if (entry.boundingClientRect.top < 0) {
              // Scrolled past this step (below viewport) - mark as complete
              setStepStates((prev) => {
                const newStates = [...prev];
                if (newStates[index] !== "complete") {
                  newStates[index] = "complete";
                }
                return newStates;
              });
            }
          });
        },
        {
          threshold: 0.5,
          rootMargin: "-20% 0px -20% 0px",
        }
      );

      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer) => observer?.disconnect());
    };
  }, []);

  const progressPercentage = () => {
    const completeCount = stepStates.filter((s) => s === "complete").length;
    const hasActive = stepStates.includes("active");
    if (
      completeCount === steps.length ||
      stepStates[steps.length - 1] === "active"
    )
      return 100;
    if (hasActive) return ((completeCount + 0.5) / steps.length) * 100;
    return (completeCount / steps.length) * 100;
  };

  return (
    <div className="relative max-w-3xl mx-auto py-8">
      {/* Timeline line */}
      <div className="absolute left-8 md:left-12 top-0 bottom-0 w-1 bg-border">
        <div
          className={cn(
            "absolute top-0 left-0 w-full bg-primary transition-all duration-700 ease-out",
            prefersReducedMotion && "transition-none"
          )}
          style={{ height: `${progressPercentage()}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-24 md:space-y-32">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const state = stepStates[index];

          return (
            <div
              key={step.id}
              ref={(el) => (stepRefs.current[index] = el)}
              className="relative min-h-[200px] md:min-h-[240px]"
            >
              {/* Icon marker */}
              <div
                className={cn(
                  "absolute left-8 md:left-12 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-4 transition-all duration-500 z-10 bg-background",
                  prefersReducedMotion && "transition-none",
                  state === "upcoming" && "border-border",
                  state === "active" &&
                    "border-primary shadow-xl shadow-primary/30 scale-110",
                  state === "complete" && "bg-primary border-primary"
                )}
              >
                <Icon
                  className={cn(
                    "w-7 h-7 md:w-9 md:h-9 transition-colors duration-500",
                    prefersReducedMotion && "transition-none",
                    state === "upcoming" && "text-muted-foreground",
                    state === "active" && "text-primary",
                    state === "complete" && "text-primary-foreground"
                  )}
                />
              </div>

              {/* Content card */}
              <Card
                className={cn(
                  "ml-24 md:ml-36 transition-all duration-700 cursor-default hover:shadow-lg",
                  prefersReducedMotion &&
                    "transition-none opacity-100 translate-y-0",
                  !prefersReducedMotion &&
                    state === "upcoming" &&
                    "opacity-40 translate-y-4",
                  !prefersReducedMotion &&
                    (state === "active" || state === "complete") &&
                    "opacity-100 translate-y-0",
                  state === "active" && "ring-2 ring-primary/30 shadow-xl"
                )}
              >
                <CardContent className="p-8 md:p-10">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-4">
                    <h3 className="text-2xl md:text-3xl font-semibold flex-1">
                      {step.title}
                    </h3>
                    {step.id === 3 && state !== "upcoming" && (
                      <span
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary whitespace-nowrap",
                          !prefersReducedMotion && "animate-pulse"
                        )}
                      >
                        Live Updates
                      </span>
                    )}
                  </div>
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {/* Additional details based on step */}
                  {state !== "upcoming" && (
                    <div
                      className={cn(
                        "mt-6 pt-6 border-t border-border transition-opacity duration-500",
                        state === "active" ? "opacity-100" : "opacity-70"
                      )}
                    >
                      {step.id === 1 && (
                        <p className="text-sm text-muted-foreground">
                          Reports include location, time, optional additional
                          information, and photo evidence.
                        </p>
                      )}
                      {step.id === 2 && (
                        <p className="text-sm text-muted-foreground">
                          Our verification team cross-references details, checks
                          for duplicates, and confirms authenticity.
                        </p>
                      )}
                      {step.id === 3 && (
                        <p className="text-sm text-muted-foreground">
                          Verified reports appear on the map instantly, helping
                          communities stay informed and safe.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};
