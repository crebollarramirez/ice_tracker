"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VerifiersLogin } from "@/components/Verifiers/VerifiersLogin";
import { Verifier } from "@/components/Verifiers/Verifier";

export default function VerifiersPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      {isLoggedIn ? (
        <Verifier onLogout={handleLogout} />
      ) : (
        <VerifiersLogin onLoginSuccess={handleLoginSuccess} />
      )}

      <Footer />
    </div>
  );
}
