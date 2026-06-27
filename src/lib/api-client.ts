'use client';

import { useAuth } from "@clerk/nextjs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  };

  return { fetchWithAuth };
}