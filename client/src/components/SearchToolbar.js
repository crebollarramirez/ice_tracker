"use client";

import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const SearchToolbar = ({
  searchQuery,
  onSearchChange,
  sortNewest,
  onSortToggle,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by address..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button
        variant="outline"
        onClick={onSortToggle}
        className="gap-2 whitespace-nowrap"
      >
        <ArrowUpDown className="w-4 h-4" />
        {sortNewest ? "Newest First" : "Oldest First"}
      </Button>
    </div>
  );
};
