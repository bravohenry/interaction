const formatLine = (
  level: "I" | "W" | "E" | "S",
  msg: string,
  requestId?: string
) => {
  const id = requestId ? requestId.slice(0, 8) : "";
  return [level, id, msg].filter(Boolean).join(" ");
};

export const logger = {
  info: (msg: string, requestId?: string) =>
    console.info(formatLine("I", msg, requestId)),
  warn: (msg: string, requestId?: string) =>
    console.warn(formatLine("W", msg, requestId)),
  error: (msg: string, requestId?: string) =>
    console.error(formatLine("E", msg, requestId)),
  success: (msg: string, requestId?: string) =>
    console.info(formatLine("S", msg, requestId)),
  start: (msg: string, requestId?: string) =>
    console.info(formatLine("I", msg, requestId)),
};
