"use client";

import * as React from "react";
import { cn } from "@/utils/utils";

const PageHeader = React.forwardRef(({className, ...props}, ref) => (
    <div className={cn("mb-8 w-full flex flex-col items-center justify-center", className)} ref={ref} {...props} />
))
PageHeader.displayName = "PageHeader";

const PageTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "text-3xl md:text-5xl font-bold mb-4 text-foreground",
      className
    )}
    {...props}
  />
));

PageTitle.displayName = "PageTitle";

const PageDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-lg md:text-xl text-muted-foreground max-w-2xl text-center",
      className
    )}
    {...props}
  />
));

PageDescription.displayName = "PageDescription";

export { PageTitle, PageDescription, PageHeader };
