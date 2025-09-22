"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTranslations } from "next-intl";
import { useLocations } from "../contexts/LocationsContext";

// Fix for default markers not showing in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function MapComponent() {
  const t = useTranslations();
  const { locations, isLoading } = useLocations();

  // Use locations from context
  const allLocations = [...locations];

  // Show loading state while fetching Firebase data
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div
          className="border-2 border-gray-800 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100 w-full"
          style={{ height: "40vh", minHeight: "300px" }}
        >
          <div className="text-gray-600">{t("map.loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <div
        className="border-2 border-gray-800 rounded-lg overflow-hidden w-full"
        style={{ height: "40vh", minHeight: "300px" }}
      >
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
          maxBounds={[
            [18.0, -170.0], // Southwest corner (includes Alaska and Hawaii)
            [72.0, -60.0], // Northeast corner
          ]}
          maxBoundsViscosity={1.0}
          minZoom={3}
          maxZoom={18}
          whenCreated={(mapInstance) => {
            // Ensure map is properly initialized
            setTimeout(() => {
              mapInstance.invalidateSize();
            }, 100);
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {allLocations.map((loc) => (
            <Marker key={loc.id} position={[loc.lat, loc.lng]}>
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-red-600">
                    {t("map.popup.title")}
                  </div>
                  <div className="mt-1">{loc.address}</div>
                  {loc.additionalInfo && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border-l-2 border-blue-300">
                      <div className="text-xs font-medium text-blue-700 mb-1">
                        {t("map.popup.additionalDetails")}
                      </div>
                      <div className="text-xs text-blue-800">
                        {loc.additionalInfo}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {t("map.popup.reported", {
                      date: new Date(loc.addedAt).toLocaleDateString(),
                    })}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
