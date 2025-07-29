import { useState, useEffect } from "react";
import { database } from "../firebase";
import { ref, onValue } from "firebase/database";
import { useTranslations } from "next-intl";
import { filterAddresses } from "../utils/filterAddresses";
import ReportNumbers from "./ReportNumbers";

export default function AddressList() {
  const t = useTranslations();
  const [addresses, setAddresses] = useState([]);
  const [filteredAddresses, setFilteredAddresses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
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

  // Handle search functionality - now triggers on every search term change
  useEffect(() => {
    setFilteredAddresses(filterAddresses(addresses, searchTerm));
  }, [searchTerm, addresses]);

  // Handle search button click (now just for explicit search action)
  const handleSearch = () => {
    // The filtering is now handled by the useEffect above
    // This function can be used for additional search actions if needed
  };

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

  useEffect(() => {
    setFilteredAddresses(addresses);
  }, [addresses]);

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
    <div className="flex flex-col gap-3 md:gap-4 px-3 pt-2 pb-1 md:pt-3 md:pb-2 border border-gray-300 rounded-lg bg-white shadow-md h-80 md:h-96">
      <div className="flex items-center justify-between">
        <h3 className="text-base md:text-lg font-semibold text-red-600">
          {t("reportsList.title")}
        </h3>
        <button
          onClick={() => setIsSearchVisible(!isSearchVisible)}
          className="text-red-600 hover:bg-red-50 p-1 rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {isSearchVisible && (
        <div className="flex">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("reportsList.searchPlaceholder")}
            className="flex-1 text-xs md:text-sm border border-gray-300 rounded-l-md px-2 py-1 focus:outline-none focus:border-red-500 text-black"
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          <button
            onClick={handleSearch}
            className="bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm px-3 py-1 rounded-r-md"
          >
            {t("reportsList.search")}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {(filteredAddresses || addresses).map((address, index) => (
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
                </div>
                <div className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded flex-shrink-0">
                  #{index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500 border-t">
        {searchTerm && filteredAddresses.length !== addresses.length ? (
          <p className="pt-2">{t("reportsList.filtered")} {filteredAddresses.length}</p>
        ) : (
          <ReportNumbers />
        )}
      </div>
    </div>
  );
}
