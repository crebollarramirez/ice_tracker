"use client";

import { useState, useEffect } from "react";
import PotentialReport from "@/components/PotentialReport";
import Navbar from "@/components/Navbar";
import { auth } from "@/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function VerifiersPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔒 Protected route - check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      // Redirect to login if not authenticated
      if (!currentUser) {
        console.log("User not authenticated, redirecting to login...");
        window.location.href = "/verifiersLogin";
      }
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // 🚪 Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out successfully");
      // The onAuthStateChanged listener will automatically redirect to login
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleVerify = () => {
    // TODO: Implement verify logic
    console.log("Verified report for:", address);
  };

  const handleDeny = () => {
    // TODO: Implement deny logic
    console.log("Denied report for:", address);
  };

  const data = [
    {
      id: 1,
      url: "https://media.cnn.com/api/v1/images/stellar/prod/ap25027710663013.jpg?c=16x9&q=h_833,w_1480,c_fill",
      address: "address",
      addedAt: "timestamp",
    },
    {
      id: 2,
      url: "https://media.wired.com/photos/68b87ec383f3b038b8117fa7/master/w_2560%2Cc_limit/GettyImages-2224826548.jpg",
      address: "address2",
      addedAt: "timestamp2",
    },
  ];

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <main className="container flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </main>
    );
  }

  // Don't render anything if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <main className="container flex items-center justify-center">
      <div className="w-full lg:w-2/3 flex flex-col items-center gap-4 md:gap-6">
        <Navbar />

        {/* Header with welcome message and logout */}
        <div className="w-full flex flex-col items-center gap-4">
          <h1 className="text-2xl md:text-4xl font-bold text-red-600 mb-2 text-center">
            Welcome {user.email}
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Logout
          </button>
        </div>

        <div className="w-full md:w-2/3">
          {data.map((report) => (
            <PotentialReport
              key={report.id}
              url={report.url}
              address={report.address}
              addedAt={report.addedAt}
            />
          ))}
        </div>
        {/* Action buttons */}
        <div className="flex gap-3 mt-4 px-2">
          <button
            onClick={handleDeny}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md font-medium text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Deny
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md font-medium text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Verify
          </button>
        </div>
      </div>
    </main>
  );
}
