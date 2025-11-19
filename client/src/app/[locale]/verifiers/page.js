"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VerifiersLogin } from "@/components/Verifiers/VerifiersLogin";
import { Verifier } from "@/components/Verifiers/Verifier";
import { PendingProvider } from "@/contexts/PendingContext";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function VerifiersPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVerifier, setIsVerifier] = useState(false);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Get the user's custom claims to check role
        const idTokenResult = await currentUser.getIdTokenResult();
        const role = idTokenResult.claims.role;

        setUser(currentUser);
        setIsVerifier(role === "verifier");
      } else {
        setUser(null);
        setIsVerifier(false);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {isVerifier ? (
        <PendingProvider>
          <Verifier user={user} />
        </PendingProvider>
      ) : (
        <VerifiersLogin />
      )}

      <Footer />
    </div>
  );
}
