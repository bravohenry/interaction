/**
 * Server-side time utilities that can be used in SSR
 */

export function getGreeting(hour?: number): string {
  const currentHour = hour ?? new Date().getHours();
  if (currentHour < 12) return "Good morning";
  if (currentHour < 18) return "Good afternoon";
  return "Good evening";
}

export function getFormattedDate(date?: Date): string {
  const currentDate = date ?? new Date();
  return currentDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getUserDisplayName(fullName?: string | null): string {
  return fullName?.split(" ")[0] || "there";
}
