"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { database, storage } from "../firebase";
import { ref, onValue } from "firebase/database";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { formatDate } from "@/utils/dateTimeHandling";

const PendingContext = createContext();

export function PendingProvider({ children }) {
  const [pendingLocations, setPendingLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const pendingRef = ref(database, "pending");

    const unsubscribe = onValue(
      pendingRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Convert Firebase object to array and add Firebase IDs
          const pendingArray = Object.entries(data).map(([id, location]) => {
            return {
              id,
              ...location,
              originalAddedAt: location.addedAt, // Keep original for sorting
            };
          });

          // Sort by original addedAt date (most recent first) BEFORE formatting
          const sortedPending = pendingArray.sort((a, b) => {
            return new Date(b.originalAddedAt) - new Date(a.originalAddedAt);
          });

          // Convert image paths to download URLs and format dates
          const formattedPending = await Promise.all(
            sortedPending.map(async (location) => {
              let imgUrl = location.imagePath;
              
              // Convert Firebase Storage path to download URL if imagePath exists
              if (location.imagePath) {
                try {
                  const imageRef = storageRef(storage, location.imagePath);
                  imgUrl = await getDownloadURL(imageRef);
                  console.log("Generated download URL:", imgUrl, "for path:", location.imagePath);
                } catch (error) {
                  console.error("Error getting download URL for image:", location.imagePath, error);
                  // Keep original path as fallback
                  imgUrl = location.imagePath;
                }
              }

              const result = {
                ...location,
                imgUrl, // Add the download URL
                addedAt: formatDate(location.originalAddedAt), // Format for display
              };
              
              console.log("Formatted pending location:", result);
              return result;
            })
          );

          setPendingLocations(formattedPending);
        } else {
          console.log("No pending locations found in Firebase");
          setPendingLocations([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching pending locations from Firebase:", error);
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <PendingContext.Provider value={{ pendingLocations, isLoading }}>
      {children}
    </PendingContext.Provider>
  );
}

export function usePending() {
  const context = useContext(PendingContext);
  if (context === undefined) {
    throw new Error("usePending must be used within a PendingProvider");
  }
  return context;
}
