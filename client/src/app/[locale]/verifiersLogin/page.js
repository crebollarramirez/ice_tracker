"use client";

import { useState, useEffect } from "react";
import Navbar from "../../../components/Navbar";

// import Firebase Auth helpers
import { signInWithEmailPasswordAndMfa } from "@/auth/authHelper";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function VerifierLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔥 Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      // Redirect if user is already authenticated
      if (currentUser) {
        console.log("User already authenticated, redirecting to verifiers...");
        window.location.href = "/verifiers";
      }
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // 🧠 Handle sign-in
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      // Simple Firebase Auth sign-in
      const user = await signInWithEmailPasswordAndMfa(
        email,
        password,
        async () => {
          const code = window.prompt("Enter the 6-digit SMS code");
          if (!code) throw new Error("No code entered");
          return code;
        }
      );

      console.log("User signed in:", user.email);
      setSuccess(true);

      // Redirect to verifiers page after successful login
      setTimeout(() => {
        window.location.href = "/verifiers";
      }, 1000);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container flex items-center justify-center min-h-screen">
      <div className="w-full lg:w-2/3 flex flex-col items-center gap-4 md:gap-6 min-h-screen">
        <Navbar />
        <div
          className={`flex items-center w-full min-h-screen flex-col ${
            authLoading ? "justify-center" : "justify-start"
          }`}
        >
          {/* Show only loading if checking auth or user is authenticated */}
          {authLoading || user ? (
            <div className="flex flex-col items-center justify-center py-16">
              {/* Loading Spinner */}
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mb-6"></div>
              <p className="text-gray-600 text-lg">
                {authLoading
                  ? "Checking authentication status..."
                  : "Redirecting to dashboard..."}
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl md:text-4xl font-bold text-red-600 mb-2">
                Welcome Verifier
              </h1>

              <p className="text-gray-600 mb-2">Please sign in to continue</p>

              <div className="w-full max-w-md">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col p-4 md:p-6 border border-gray-300 rounded-lg bg-white shadow-md space-y-4"
                >
                  {/* Email Field */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-black"
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-black"
                      required
                    />
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md font-medium text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </button>

                  {/* Error / Success */}
                  {error && (
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  )}
                  {success && (
                    <p className="text-sm text-green-600 text-center">
                      Login successful! Redirecting...
                    </p>
                  )}
                </form>

                {/* Required for MFA reCAPTCHA */}
                <div id="recaptcha-container"></div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
