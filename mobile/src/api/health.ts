import { getJson } from "@/api/client";

export type HealthStatus = "UP" | "DOWN" | "OUT_OF_SERVICE" | "UNKNOWN";

export type Health = {
  status: HealthStatus;
};

export function getHealth(): Promise<Health> {
  return getJson<Health>("/actuator/health");
}
