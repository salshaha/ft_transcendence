import { useState } from "react";
import { loginUser, registerUser } from "../services/authService";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(credentials, mode) {
    setIsLoading(true);
    setError("");
    try {
      return await (mode === "login" ? loginUser(credentials) : registerUser(credentials));
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  return { submit, isLoading, error, clearError: () => setError("") };
}
