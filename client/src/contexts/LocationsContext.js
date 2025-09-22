"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";

const LocationsContext = createContext();

export function LocationsProvider({ children }) {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const locationsRef = ref(database, "locations");

    const unsubscribe = onValue(
      locationsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Convert Firebase object to array and add Firebase IDs
          const locationsArray = Object.entries(data).map(([id, location]) => ({
            id,
            ...location,
          }));

          // Sort by addedAt date (most recent first)
          const sortedLocations = locationsArray.sort((a, b) => {
            return new Date(b.addedAt) - new Date(a.addedAt);
          });

          console.log("Loaded locations from Firebase:", sortedLocations);
          setLocations(sortedLocations);
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
