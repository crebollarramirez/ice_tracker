"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import { formatDate } from "@/utils/dateTimeHandling";

const LocationsContext = createContext();

export function LocationsProvider({ children }) {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const locationsRef = ref(database, "verified");

    const unsubscribe = onValue(
      locationsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Convert Firebase object to array and add Firebase IDs
          const locationsArray = Object.entries(data).map(([id, location]) => {
            return {
              id,
              ...location,
              originalAddedAt: location.addedAt, // Keep original for sorting
            };
          });

          // Sort by original addedAt date (most recent first) BEFORE formatting
          const sortedLocations = locationsArray.sort((a, b) => {
            return new Date(b.originalAddedAt) - new Date(a.originalAddedAt);
          });

          // Now format the dates for display
          const formattedLocations = sortedLocations.map((location) => ({
            ...location,
            addedAt: formatDate(location.originalAddedAt), // Format for display
          }));

          setLocations(formattedLocations);
        } else {
          console.log("No locations found in Firebase");
          setLocations([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching locations from Firebase:", error);
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <LocationsContext.Provider value={{ locations, isLoading }}>
      {children}
    </LocationsContext.Provider>
  );
}

export function useLocations() {
  const context = useContext(LocationsContext);
  if (context === undefined) {
    throw new Error("useLocations must be used within a LocationsProvider");
  }
  return context;
}
