import { useState, useEffect } from "react";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useTranslations } from "next-intl";

export default function AddressList() {
  const t = useTranslations();
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch addresses from Firebase
  useEffect(() => {
    const locationsRef = ref(database, "locations");

    const unsubscribe = onValue(
      locationsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Convert Firebase object to array and add Firebase IDs
          const addressesArray = Object.entries(data).map(([id, location]) => ({
            id,
            ...location,
          }));

          // Sort by addedAt date (most recent first)
          const sortedAddresses = addressesArray.sort((a, b) => {
            return new Date(b.addedAt) - new Date(a.addedAt);
          });

          console.log("Loaded addresses from Firebase:", sortedAddresses);
          setAddresses(sortedAddresses);
        } else {
          console.log("No addresses found in Firebase");
          setAddresses([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching addresses from Firebase:", error);
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 md:gap-4 p-3 md:p-4 border border-gray-300 rounded-lg bg-white shadow-md h-80 md:h-96">
        <h3 className="text-base md:text-lg font-semibold text-red-600">
          {t("reportsList.title")}
        </h3>
        <div className="text-gray-600 text-sm">{t("reportsList.loading")}</div>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="flex flex-col gap-3 md:gap-4 p-3 md:p-4 border border-gray-300 rounded-lg bg-white shadow-md h-80 md:h-96">
        <h3 className="text-base md:text-lg font-semibold text-red-600">
          {t("reportsList.title")}
        </h3>
        <div className="text-gray-600 text-sm">
          {t("reportsList.noReports")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4 p-3 md:p-4 border border-gray-300 rounded-lg bg-white shadow-md h-80 md:h-96">
      <h3 className="text-base md:text-lg font-semibold text-red-600">
        {t("reportsList.title")}
      </h3>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {addresses.map((address, index) => (
            <div
              key={address.id}
              className="border-b border-gray-200 pb-3 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium text-black truncate">
                    🚨 {address.address}
                  </div>
                  <div className="text-xs text-red-600 mt-1 font-medium">
                    {t("reportsList.reported", {
                      date: formatDate(address.addedAt),
                    })}
                  </div>
                  {address.additionalInfo && (
                    <div className="text-xs text-blue-700 mt-1 bg-blue-50 p-1 rounded">
                      {t("reportsList.additionalInfo", {
                        info: address.additionalInfo,
                      })}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1 hidden md:block">
                    {t("reportsList.coordinates", {
                      lat: address.lat.toFixed(4),
                      lng: address.lng.toFixed(4),
                    })}
                  </div>
                </div>
                <div className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded flex-shrink-0">
                  #{index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500 border-t pt-2">
        {t("reportsList.total", { count: addresses.length })}
        <div className="text-xs text-red-600 mt-1">
          {t("reportsList.warning")}
        </div>
      </div>
    </div>
  );
}
